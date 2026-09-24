import { DashboardService } from './dashboard.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The dashboard aggregation — the arithmetic the whole endpoint exists to own.
 *
 * ## Why this matters more than a typical service test
 *
 * Every number here is an assertion about the owner's data presented as a fact, and a wrong one
 * is invisible: a count quietly off by the revoked links nobody filtered reads exactly like a
 * correct one. The frontend used to derive all of these from four endpoints plus one audience
 * call per card, and shipped the defect this endpoint was built to delete — `peopleReached` and
 * `behind` reduced from *different* collections, so a contact behind on two cards was counted
 * once in one and twice in the other and `behind` could exceed `peopleReached`, which is not a
 * state that can exist.
 *
 * So the load-bearing test below is not any single count; it is
 * {@link https://example.invalid | the invariant} that the people-shaped totals all come from
 * one pass over one ACTIVE-link set and therefore cannot contradict each other.
 *
 * ## The Prisma double
 *
 * Hand-rolled rather than a mocking framework: the service makes exactly six reads and each one
 * is named below, so a change in what it queries shows up as an obviously-missing stub rather
 * than as an inscrutable `undefined`.
 */
interface Rows {
  cards?: Array<{
    id: string;
    name: string;
    currentVersion: number;
    _count: { fields: number };
  }>;
  links?: Array<{
    cardId: string;
    contactId: string;
    viewCount: number;
    lastNotifiedVersion: number | null;
  }>;
  activity?: Array<{ createdAt: Date }>;
  groups?: Array<{
    id: string;
    tag: string | null;
    category: string;
    fields: Array<{ id: string }>;
  }>;
  contacts?: number;
  fields?: number;
}

function service(rows: Rows): DashboardService {
  let shareLinkCall = 0;
  const prisma = {
    card: { findMany: () => Promise.resolve(rows.cards ?? []) },
    contact: { count: () => Promise.resolve(rows.contacts ?? 0) },
    profileField: { count: () => Promise.resolve(rows.fields ?? 0) },
    profileFieldGroup: { findMany: () => Promise.resolve(rows.groups ?? []) },
    shareLink: {
      /* ⚠ Called TWICE, and the two are different queries: first every ACTIVE link (the one pass
         every people-shaped total comes from), then every link created inside the 12-week window
         regardless of status — because a link that was shared and later revoked was still
         shared that week. Returning the same rows to both would hide a mix-up between them. */
      findMany: () => {
        shareLinkCall += 1;
        return Promise.resolve(
          shareLinkCall === 1 ? (rows.links ?? []) : (rows.activity ?? []),
        );
      },
    },
  };
  return new DashboardService(prisma as unknown as PrismaService);
}

const card = (
  id: string,
  over: Partial<{ name: string; version: number; fields: number }> = {},
) => ({
  id,
  name: over.name ?? id,
  currentVersion: over.version ?? 1,
  _count: { fields: over.fields ?? 3 },
});

const link = (
  cardId: string,
  contactId: string,
  over: Partial<{ viewCount: number; lastNotifiedVersion: number | null }> = {},
) => ({
  cardId,
  contactId,
  viewCount: over.viewCount ?? 0,
  lastNotifiedVersion:
    over.lastNotifiedVersion === undefined ? 1 : over.lastNotifiedVersion,
});

describe('DashboardService', () => {
  describe('the people-shaped totals', () => {
    it('counts one contact once, however many cards they hold', async () => {
      /* Summing links is the obvious mistake and it inflates the headline number the dashboard
         leads on: a single enthusiastic recipient would read as three people reached. */
      const result = await service({
        cards: [card('c1'), card('c2'), card('c3')],
        links: [
          link('c1', 'same', { viewCount: 4 }),
          link('c2', 'same', { viewCount: 0 }),
          link('c3', 'other', { viewCount: 0 }),
        ],
      }).getDashboard('u1');

      expect(result.totals.peopleReached).toBe(2);
      /* Opened at least ONE link — the same person, counted once, not once per opened link. */
      expect(result.totals.peopleOpened).toBe(1);
      /* Links, not people: three links exist and two of them have never been opened. */
      expect(result.totals.neverOpened).toBe(2);
      expect(result.totals.totalOpens).toBe(4);
    });

    /**
     * ⚠ THE REGRESSION THIS ENDPOINT WAS BUILT FOR.
     *
     * A contact behind on two different cards used to be counted twice in one aggregate and once
     * in the other, letting `behind` exceed `peopleReached`. Both now come from the same pass
     * over the same rows, so the impossible state is unreachable by construction — and this is
     * the exact scenario that produced it.
     */
    it('never reports more people behind than were reached', async () => {
      const result = await service({
        cards: [card('c1', { version: 5 }), card('c2', { version: 5 })],
        links: [
          link('c1', 'p1', { lastNotifiedVersion: 1 }),
          link('c2', 'p1', { lastNotifiedVersion: 1 }),
          link('c1', 'p2', { lastNotifiedVersion: 1 }),
        ],
      }).getDashboard('u1');

      expect(result.totals.peopleReached).toBe(2);
      expect(result.totals.behind).toBe(2);
      expect(result.totals.behind!).toBeLessThanOrEqual(
        result.totals.peopleReached,
      );
    });

    it('holds peopleOpened at or below peopleReached', async () => {
      const result = await service({
        cards: [card('c1')],
        links: [
          link('c1', 'p1', { viewCount: 9 }),
          link('c1', 'p2', { viewCount: 0 }),
        ],
      }).getDashboard('u1');

      expect(result.totals.peopleOpened).toBeLessThanOrEqual(
        result.totals.peopleReached,
      );
      expect(result.totals.peopleOpened).toBe(1);
    });

    /**
     * ⚠ `null` is "nothing to compute this from", NOT "nobody is behind". The UI renders the two
     * differently, and collapsing them reports a confident all-clear to an account that has
     * simply never been used.
     */
    it('answers behind: null — never 0 — for an owner with no cards', async () => {
      const empty = await service({ cards: [] }).getDashboard('u1');
      expect(empty.totals.behind).toBeNull();

      const hasCards = await service({ cards: [card('c1')] }).getDashboard(
        'u1',
      );
      expect(hasCards.totals.behind).toBe(0);
    });
  });

  describe('cardReach', () => {
    it('includes every card, including the ones with no activity at all', async () => {
      /* A card nobody has opened is the most actionable row on the screen, not one to filter
         out — the chart's job is to show the gaps. */
      const result = await service({
        cards: [card('busy'), card('silent')],
        links: [link('busy', 'p1', { viewCount: 7 })],
      }).getDashboard('u1');

      expect(result.cardReach).toHaveLength(2);
      expect(result.cardReach).toContainEqual({
        cardId: 'silent',
        cardName: 'silent',
        opens: 0,
        recipients: 0,
      });
    });
  });

  describe('attention', () => {
    it('orders by kind priority, worst first within each kind', async () => {
      const result = await service({
        cards: [
          card('empty', { fields: 0 }),
          card('stale', { version: 9 }),
          card('cold'),
          card('unshared'),
        ],
        links: [
          link('stale', 'p1', { lastNotifiedVersion: 1 }),
          link('stale', 'p2', { lastNotifiedVersion: 1 }),
          link('cold', 'p3', { viewCount: 0 }),
        ],
      }).getDashboard('u1');

      expect(result.attention.map((row) => row.kind)).toEqual([
        'no-fields',
        'behind',
        'never-opened',
        'never-opened',
        'never-shared',
      ]);
      expect(result.attention[0]).toMatchObject({ cardId: 'empty', count: 0 });
      expect(result.attention[1]).toMatchObject({ cardId: 'stale', count: 2 });
      expect(result.attention.at(-1)).toMatchObject({
        cardId: 'unshared',
        count: 0,
      });
    });

    it('does not also report an empty card as never shared', async () => {
      /* An empty card's reach problems are downstream of it being empty — two rows for one card
         would have the owner fix the same thing twice. */
      const result = await service({
        cards: [card('empty', { fields: 0 })],
      }).getDashboard('u1');

      expect(result.attention).toHaveLength(1);
      expect(result.attention[0].kind).toBe('no-fields');
    });
  });

  describe('sharingActivity', () => {
    it('returns 12 Monday-aligned buckets, oldest first, including the empty weeks', async () => {
      /* ⚠ The gaps are the point. Bucketing only the weeks that happen to have data draws a
         continuous line over a month of silence and turns a quiet period into a busy one. */
      const now = new Date();
      const result = await service({
        cards: [card('c1')],
        activity: [{ createdAt: now }, { createdAt: now }],
      }).getDashboard('u1');

      expect(result.sharingActivity).toHaveLength(12);
      expect(result.sharingActivity.at(-1)!.count).toBe(2);
      expect(result.sharingActivity.filter((b) => b.count === 0)).toHaveLength(
        11,
      );

      const days = result.sharingActivity.map((b) =>
        new Date(b.weekStart).getUTCDay(),
      );
      expect(new Set(days)).toEqual(new Set([1])); // every bucket starts on a Monday

      const ordered = [...result.sharingActivity].sort((a, b) =>
        a.weekStart.localeCompare(b.weekStart),
      );
      expect(result.sharingActivity).toEqual(ordered); // oldest first
    });
  });

  describe('groups', () => {
    it('returns every group, including empty ones, and never a null name', async () => {
      /* An empty group is a gap in every card at once, so dropping it would report a profile as
         complete precisely when it is not. An untagged group falls back to its category rather
         than to an empty heading. */
      const result = await service({
        groups: [
          { id: 'g1', tag: 'Studio', category: 'WORK', fields: [{ id: 'f1' }] },
          { id: 'g2', tag: null, category: 'FINANCIAL', fields: [] },
        ],
      }).getDashboard('u1');

      expect(result.groups).toEqual([
        { id: 'g1', name: 'Studio', fieldCount: 1 },
        { id: 'g2', name: 'Financial', fieldCount: 0 },
      ]);
    });
  });
});
