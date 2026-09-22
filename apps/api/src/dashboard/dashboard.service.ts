import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttentionItemDto,
  CardReachItemDto,
  DashboardGroupDto,
  DashboardResponseDto,
  SharingActivityBucketDto,
} from './dto/dashboard-response.dto';

const SHARING_ACTIVITY_WEEKS = 12;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/** Monday 00:00 UTC of the week containing `date`. ISO weekday: Monday = 1,
 *  Sunday = 7 (getUTCDay() returns 0 for Sunday, hence the `|| 7`). */
function mondayOfWeekUtc(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const isoWeekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (isoWeekday - 1));
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything computed server-side in one pass, replacing what the
   * frontend used to assemble from GET /cards + GET /contacts +
   * GET /share-links + one GET /cards/:id/audience PER CARD (an N+1 on
   * every dashboard load). See the card-appearance backend spec §4 for the
   * exact contract every field below is answering to.
   */
  async getDashboard(userId: string): Promise<DashboardResponseDto> {
    const [cards, contactsCount, fieldsCount, groupRows] = await Promise.all([
      this.prisma.card.findMany({
        where: { userId, archivedAt: null },
        select: {
          id: true,
          name: true,
          currentVersion: true,
          _count: { select: { fields: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contact.count({ where: { ownerId: userId } }),
      this.prisma.profileField.count({ where: { userId, archivedAt: null } }),
      this.prisma.profileFieldGroup.findMany({
        where: { userId, archivedAt: null },
        include: {
          fields: { where: { archivedAt: null }, select: { id: true } },
        },
        orderBy: { position: 'asc' },
      }),
    ]);

    const cardIds = cards.map((c) => c.id);
    const cardById = new Map(cards.map((c) => [c.id, c]));

    // ── ACTIVE-link aggregation — the one query every "reached"/"opens"/
    // "behind" number below is computed from, uniformly. This uniformity is
    // deliberate: the live bug the frontend reported (§4.4 — peopleReached
    // and "recipients behind" disagreeing to the point of being
    // impossible) traces to exactly this — two different aggregates that
    // didn't agree on which links counted. Computing both from the same
    // ACTIVE-only row set here structurally rules that out.
    const activeLinks =
      cardIds.length === 0
        ? []
        : await this.prisma.shareLink.findMany({
            where: { cardId: { in: cardIds }, status: 'ACTIVE' },
            select: {
              cardId: true,
              contactId: true,
              viewCount: true,
              lastNotifiedVersion: true,
            },
          });

    const opensByCard = new Map<string, number>();
    const recipientsByCard = new Map<string, number>();
    const behindByCard = new Map<string, number>();
    const neverOpenedByCard = new Map<string, number>();
    const reachedContacts = new Set<string>();
    const behindContacts = new Set<string>();
    let totalOpens = 0;
    let neverOpened = 0;

    for (const link of activeLinks) {
      reachedContacts.add(link.contactId);
      totalOpens += link.viewCount;
      recipientsByCard.set(
        link.cardId,
        (recipientsByCard.get(link.cardId) ?? 0) + 1,
      );
      opensByCard.set(
        link.cardId,
        (opensByCard.get(link.cardId) ?? 0) + link.viewCount,
      );

      if (link.viewCount === 0) {
        neverOpened += 1;
        neverOpenedByCard.set(
          link.cardId,
          (neverOpenedByCard.get(link.cardId) ?? 0) + 1,
        );
      }

      // card is guaranteed present: activeLinks was queried by cardId IN cardIds.
      const card = cardById.get(link.cardId)!;
      const versionsBehind =
        card.currentVersion - (link.lastNotifiedVersion ?? 0);
      if (versionsBehind > 0) {
        behindByCard.set(link.cardId, (behindByCard.get(link.cardId) ?? 0) + 1);
        behindContacts.add(link.contactId);
      }
    }

    const cardReach: CardReachItemDto[] = cards.map((c) => ({
      cardId: c.id,
      cardName: c.name,
      opens: opensByCard.get(c.id) ?? 0,
      recipients: recipientsByCard.get(c.id) ?? 0,
    }));

    // ── attention — kind-priority order (no-fields, behind, never-opened,
    // never-shared), worst (highest count) first within each kind.
    const noFields = cards
      .filter((c) => c._count.fields === 0)
      .map(
        (c): AttentionItemDto => ({
          kind: 'no-fields',
          cardId: c.id,
          cardName: c.name,
          count: 0,
        }),
      );

    const behind = cards
      .filter((c) => (behindByCard.get(c.id) ?? 0) > 0)
      .map(
        (c): AttentionItemDto => ({
          kind: 'behind',
          cardId: c.id,
          cardName: c.name,
          count: behindByCard.get(c.id)!,
        }),
      )
      .sort((a, b) => b.count - a.count);

    const neverOpenedList = cards
      .filter((c) => (neverOpenedByCard.get(c.id) ?? 0) > 0)
      .map(
        (c): AttentionItemDto => ({
          kind: 'never-opened',
          cardId: c.id,
          cardName: c.name,
          count: neverOpenedByCard.get(c.id)!,
        }),
      )
      .sort((a, b) => b.count - a.count);

    const neverShared = cards
      .filter((c) => (recipientsByCard.get(c.id) ?? 0) === 0)
      .map(
        (c): AttentionItemDto => ({
          kind: 'never-shared',
          cardId: c.id,
          cardName: c.name,
          count: 0,
        }),
      );

    const attention = [
      ...noFields,
      ...behind,
      ...neverOpenedList,
      ...neverShared,
    ];

    // ── sharingActivity — link CREATIONS per week, not opens (no per-view
    // log exists yet — see the backend spec §4.3). 12 buckets, oldest first.
    const thisWeekStart = mondayOfWeekUtc(new Date());
    const rangeStart = new Date(
      thisWeekStart.getTime() - (SHARING_ACTIVITY_WEEKS - 1) * MS_PER_WEEK,
    );

    const linksForActivity =
      cardIds.length === 0
        ? []
        : await this.prisma.shareLink.findMany({
            where: { cardId: { in: cardIds }, createdAt: { gte: rangeStart } },
            select: { createdAt: true },
          });

    const bucketCounts = new Array<number>(SHARING_ACTIVITY_WEEKS).fill(0);
    for (const link of linksForActivity) {
      const weeksAgo = Math.floor(
        (thisWeekStart.getTime() - mondayOfWeekUtc(link.createdAt).getTime()) /
          MS_PER_WEEK,
      );
      const index = SHARING_ACTIVITY_WEEKS - 1 - weeksAgo;
      if (index >= 0 && index < SHARING_ACTIVITY_WEEKS) {
        bucketCounts[index] += 1;
      }
    }

    const sharingActivity: SharingActivityBucketDto[] = bucketCounts.map(
      (count, i) => ({
        weekStart: isoDate(new Date(rangeStart.getTime() + i * MS_PER_WEEK)),
        count,
      }),
    );

    // ── groups — every non-archived group, including empty ones.
    const groups: DashboardGroupDto[] = groupRows.map((g) => ({
      id: g.id,
      name: g.tag ?? titleCase(g.category),
      fieldCount: g.fields.length,
    }));

    return {
      totals: {
        cards: cards.length,
        contacts: contactsCount,
        fields: fieldsCount,
        peopleReached: reachedContacts.size,
        totalOpens,
        neverOpened,
        // null, never 0, when there's nothing to compute "behind" from at
        // all — a fresh account with no cards yet is "we don't know,"
        // never mistaken for "we checked, nobody's behind."
        behind: cards.length === 0 ? null : behindContacts.size,
      },
      cardReach,
      attention,
      sharingActivity,
      groups,
    };
  }
}
