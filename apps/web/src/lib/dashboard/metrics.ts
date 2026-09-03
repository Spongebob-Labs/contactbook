/**
 * Everything the dashboard shows, derived from what the API actually returns.
 *
 * ## Why this is a pure module and not logic inside the screen
 * Every number here is an assertion about the owner's data, and a wrong one is invisible — a
 * count that is quietly off by the revoked links nobody filtered reads exactly like a correct
 * one. Pure functions over plain inputs are testable without rendering anything, so each claim
 * gets a test that names the trap it avoids.
 *
 * ## ⚠ What the API cannot tell us, and therefore what is NOT here
 * `ShareLink` carries `viewCount`, `firstViewedAt` and `lastViewedAt` — **a counter and two
 * bookends, not a log**. There is no per-view record, so "opens over time" is not computable and
 * must not be drawn: any such chart would be invented. What IS a real time series is when links
 * were *created* (`createdAt`), which is the sharing-activity chart.
 *
 * If opens-over-time is ever wanted, it needs a new API — a `LinkEvent` table, which
 * `schema.prisma` already lists as not yet built.
 */

import type { ContactShare } from "@/types/domain";

/** A share link as these metrics need it — the subset every caller already has. */
export interface MetricLink {
  cardId: string;
  contactId: string;
  status: ContactShare["status"];
  viewCount: number;
  createdAt: string;
}

export interface MetricCard {
  id: string;
  name: string;
  fieldIds: readonly string[];
}

export interface DashboardTotals {
  cards: number;
  contacts: number;
  fields: number;
  /** Distinct people holding an ACTIVE link. Not the contact count — most contacts hold none. */
  peopleReached: number;
  /** Summed across ACTIVE links only; a revoked link's opens are history, not reach. */
  totalOpens: number;
  /** ACTIVE links never opened. The actionable one: a card sent that nobody looked at. */
  neverOpened: number;
  /** Recipients on a card version older than its current one. `null` when audience is unavailable. */
  behind: number | null;
}

export function totals(input: {
  cards: readonly MetricCard[];
  contactCount: number;
  fieldCount: number;
  links: readonly MetricLink[];
  behind: number | null;
}): DashboardTotals {
  const active = input.links.filter((l) => l.status === "ACTIVE");
  return {
    cards: input.cards.length,
    contacts: input.contactCount,
    fields: input.fieldCount,
    /* A contact can hold links to several cards; they are still one person reached. */
    peopleReached: new Set(active.map((l) => l.contactId)).size,
    totalOpens: active.reduce((sum, l) => sum + l.viewCount, 0),
    neverOpened: active.filter((l) => l.viewCount === 0).length,
    behind: input.behind,
  };
}

/* ── the two charts ──────────────────────────────────────────────────────────────────── */

export interface WeekBucket {
  /** ISO date of that week's Monday — the bucket key, and what the axis labels format. */
  weekStart: string;
  count: number;
}

/** Monday 00:00 UTC of the week containing `iso`. UTC throughout, so a bucket never shifts. */
function weekStartOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
  return new Date(monday).toISOString().slice(0, 10);
}

/**
 * Links minted per week, oldest first, **including the empty weeks**.
 *
 * ⚠ The gaps are the point. Bucketing only the weeks that happen to have data draws a
 * continuous line over a month of silence and turns a quiet period into a busy one — the axis
 * has to be time, not "weeks that had activity".
 */
export function sharingByWeek(
  links: readonly MetricLink[],
  now: Date,
  weeks = 12,
): readonly WeekBucket[] {
  const counts = new Map<string, number>();
  for (const link of links) {
    const key = weekStartOf(link.createdAt);
    if (key !== "") counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const thisMonday = weekStartOf(now.toISOString());
  const out: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(thisMonday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    out.push({ weekStart: key, count: counts.get(key) ?? 0 });
  }
  return out;
}

export interface CardReach {
  cardId: string;
  cardName: string;
  opens: number;
  recipients: number;
}

/**
 * Cards ranked by opens, then by recipients, then by name.
 *
 * Cards with no links are included at zero rather than dropped: "this card has never been
 * shared" is a thing the owner needs to see, and a chart that silently omits it hides the
 * emptiest cards — the exact ones worth acting on.
 */
export function cardReach(
  cards: readonly MetricCard[],
  links: readonly MetricLink[],
  limit = 5,
): readonly CardReach[] {
  const active = links.filter((l) => l.status === "ACTIVE");
  return cards
    .map((card) => {
      const mine = active.filter((l) => l.cardId === card.id);
      return {
        cardId: card.id,
        cardName: card.name,
        opens: mine.reduce((sum, l) => sum + l.viewCount, 0),
        recipients: mine.length,
      };
    })
    .sort(
      (a, b) =>
        b.opens - a.opens || b.recipients - a.recipients || a.cardName.localeCompare(b.cardName),
    )
    .slice(0, limit);
}

/* ── the "needs attention" list ──────────────────────────────────────────────────────── */

export interface Attention {
  kind: "behind" | "never-opened" | "no-fields" | "never-shared";
  cardId: string;
  cardName: string;
  count: number;
}

/**
 * What the owner should actually do something about, worst first.
 *
 * This replaces the "Recent contacts" list that used to sit here. A reverse-chronological list of
 * names answers no question — the owner already knows who they added. These four states each
 * have an action attached, which is what earns a row on a dashboard.
 */
export function attention(
  cards: readonly MetricCard[],
  links: readonly MetricLink[],
  behindByCardId: ReadonlyMap<string, number>,
): readonly Attention[] {
  const active = links.filter((l) => l.status === "ACTIVE");
  const out: Attention[] = [];

  for (const card of cards) {
    const mine = active.filter((l) => l.cardId === card.id);
    const behind = behindByCardId.get(card.id) ?? 0;

    if (card.fieldIds.length === 0) {
      out.push({ kind: "no-fields", cardId: card.id, cardName: card.name, count: 0 });
      continue; // An empty card's reach problems are downstream of it being empty.
    }
    if (behind > 0) {
      out.push({ kind: "behind", cardId: card.id, cardName: card.name, count: behind });
    }
    if (mine.length === 0) {
      out.push({ kind: "never-shared", cardId: card.id, cardName: card.name, count: 0 });
    } else {
      const unopened = mine.filter((l) => l.viewCount === 0).length;
      if (unopened > 0) {
        out.push({ kind: "never-opened", cardId: card.id, cardName: card.name, count: unopened });
      }
    }
  }

  const rank: Record<Attention["kind"], number> = {
    "no-fields": 0,
    behind: 1,
    "never-opened": 2,
    "never-shared": 3,
  };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || b.count - a.count);
}
