import { ShareLinksService } from './share-links.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AppConfigService } from '../config/app-config.service';
import type { AppLogger } from '../common/logging/app-logger.service';
import type { CardsService } from './cards.service';
import type { ContactsService } from '../contacts/contacts.service';
import type { OutboxService } from '../outbox/outbox.service';
import type { TaskEnqueuer } from '../outbox/task-enqueuer';

/**
 * `ensureActiveLinkAndNotify` — when a card-share WhatsApp goes out, and when it must not.
 *
 * ## The bug this pins
 * An owner pressing Send for someone who already held the card got their existing link back and
 * no message: the function returned early for any ACTIVE link. The dialog said "Link created" and
 * nothing arrived, so from the owner's side the card could not be sent to anyone twice. The
 * owner's share now passes `forceNotify`, as "Send to my phone" does.
 *
 * ## The case that must NOT change
 * The OTP-verify connect calls the same function without the flag: verifying twice is a safe
 * no-op, not a request for a second message. The default-off case is asserted as carefully as
 * the forced one.
 */

const CARD = { id: 'card-1', currentVersion: 4, name: 'Work' };
const CONTACT = {
  id: 'contact-1',
  phoneE164: '+919347243575',
  displayName: 'Aayush',
};

type Row = {
  id: string;
  token: string;
  cardId: string;
  contactId: string;
  status: 'ACTIVE' | 'REVOKED';
  revokedAt: Date | null;
  lastNotifiedVersion: number | null;
  viewCount: number;
  firstViewedAt: Date | null;
  lastViewedAt: Date | null;
  createdAt: Date;
};

const row = (over: Partial<Row> = {}): Row => ({
  id: 'link-1',
  token: 'tok-existing',
  cardId: CARD.id,
  contactId: CONTACT.id,
  status: 'ACTIVE',
  revokedAt: null,
  lastNotifiedVersion: 2,
  viewCount: 3,
  firstViewedAt: null,
  lastViewedAt: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  ...over,
});

/**
 * A service over hand-rolled doubles. Returns the spies a test asserts on: every outbox row
 * enqueued (its dedupe key and payload), every transport kick, and every link write.
 */
function harness(existing: Row | null) {
  const enqueued: Array<{
    dedupeKey: string;
    payload: { shareToken: string };
  }> = [];
  const kicked: string[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const creates: Array<Record<string, unknown>> = [];

  const tx = {
    shareLink: {
      update: (args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return Promise.resolve({ ...(existing as Row), ...args.data });
      },
      create: (args: { data: Record<string, unknown> }) => {
        creates.push(args.data);
        return Promise.resolve(
          row({ ...(args.data as Partial<Row>), id: 'link-new' }),
        );
      },
    },
  };

  const prisma = {
    shareLink: { findUnique: () => Promise.resolve(existing) },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  const outbox = {
    enqueue: (
      _tx: unknown,
      input: { dedupeKey: string; payload: { shareToken: string } },
    ) => {
      enqueued.push(input);
      return Promise.resolve({ id: `outbox-${enqueued.length}` });
    },
  };
  const enqueuer = { enqueue: (id: string) => void kicked.push(id) };
  const logger = {
    info: () => undefined,
    error: () => undefined,
    warn: () => undefined,
  };
  const config = { shareBaseUrl: 'https://cards.example.test' };

  const service = new ShareLinksService(
    prisma as unknown as PrismaService,
    config as unknown as AppConfigService,
    logger as unknown as AppLogger,
    {} as CardsService,
    {} as ContactsService,
    outbox as unknown as OutboxService,
    enqueuer as unknown as TaskEnqueuer,
  );
  return { service, enqueued, kicked, updates, creates };
}

describe('ShareLinksService.ensureActiveLinkAndNotify', () => {
  it('re-sends to someone who already holds the card when the owner asks — same link, no new one', async () => {
    const h = harness(row());

    const result = await h.service.ensureActiveLinkAndNotify(
      CARD,
      CONTACT,
      'Vansh',
      {
        forceNotify: true,
      },
    );

    expect(h.enqueued).toHaveLength(1);
    expect(h.kicked).toEqual(['outbox-1']);
    /* The SAME token goes out again. A second link would split one person's history across two
       revocable rows, and the (cardId, contactId) unique constraint forbids it anyway. */
    expect(h.enqueued[0].payload.shareToken).toBe('tok-existing');
    expect(result.url).toBe('https://cards.example.test/c/tok-existing');
    expect(h.creates).toHaveLength(0);
    /* Status is left alone — only the version marker moves, because they are about to receive a
       link to live data and are therefore caught up. */
    expect(h.updates).toEqual([{ lastNotifiedVersion: CARD.currentVersion }]);
  });

  it('re-sends as many times as the owner asks, each as its own message', async () => {
    const h = harness(row());

    for (let i = 0; i < 3; i += 1) {
      await h.service.ensureActiveLinkAndNotify(CARD, CONTACT, 'Vansh', {
        forceNotify: true,
      });
    }

    expect(h.enqueued).toHaveLength(3);
    /* Distinct dedupe keys, or the outbox would collapse the second and third into the first. */
    expect(new Set(h.enqueued.map((e) => e.dedupeKey)).size).toBe(3);
  });

  it('stays silent for an active link when the caller did not ask to re-send (the OTP-verify connect)', async () => {
    const h = harness(row());

    const result = await h.service.ensureActiveLinkAndNotify(
      CARD,
      CONTACT,
      'Vansh',
    );

    expect(h.enqueued).toHaveLength(0);
    expect(h.kicked).toHaveLength(0);
    expect(h.updates).toHaveLength(0);
    expect(result.url).toBe('https://cards.example.test/c/tok-existing');
  });

  it('restores a revoked link and sends it, with or without the flag', async () => {
    for (const options of [undefined, { forceNotify: true }]) {
      const h = harness(row({ status: 'REVOKED', revokedAt: new Date() }));

      await h.service.ensureActiveLinkAndNotify(
        CARD,
        CONTACT,
        'Vansh',
        options,
      );

      expect(h.enqueued).toHaveLength(1);
      expect(h.updates[0]).toMatchObject({ status: 'ACTIVE', revokedAt: null });
    }
  });

  it('mints and sends a first link for someone new', async () => {
    const h = harness(null);

    await h.service.ensureActiveLinkAndNotify(CARD, CONTACT, 'Vansh', {
      forceNotify: true,
    });

    expect(h.creates).toHaveLength(1);
    expect(h.enqueued).toHaveLength(1);
  });
});
