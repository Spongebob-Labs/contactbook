/**
 * The dashboard's view types — **and nothing that computes one.**
 *
 * ## ⚠ Every number on this screen comes from `GET /dashboard`
 *
 * This module used to derive all of them: totals, weekly buckets, per-card reach and the
 * attention queue, reduced on the client from `GET /cards` + `GET /contacts` +
 * `GET /share-links` + one `GET /cards/{id}/audience` per card. That is gone, and the reason is
 * not the request count.
 *
 * `peopleReached` and `behind` were reduced from two different collections here, so a contact
 * behind on two cards was counted once in one and twice in the other — `behind` could exceed
 * `peopleReached`, which is not a state that can exist. The API now computes both from one pass
 * over one ACTIVE-link query, which rules that out structurally instead of by keeping two
 * client-side filters in step forever.
 *
 * **So nothing here may reduce, re-sort or re-bucket a response.** Re-deriving one number would
 * put the second source of truth straight back. What remains is the vocabulary the components
 * are written against, plus {@link toDashboardView}, which renames wire shapes into it and
 * applies the one presentational rule the API deliberately leaves to the client.
 *
 * ## ⚠ What the API still cannot tell us
 * `ShareLink` carries `viewCount` and two bookends — **a counter, not a log**. There is no
 * per-view record (`LinkEvent` does not exist), so "opens over time" is not computable and must
 * not be drawn: `sharingActivity` counts links *created*, and the chart has to say so. Any
 * opens-per-week chart would be invented.
 */

import type {
  AttentionItemDto,
  CardReachItemDto,
  DashboardResponseDto,
  DashboardTotalsDto,
  SharingActivityBucketDto,
} from "@/lib/api/schema";

/**
 * The totals, as the panel reads them.
 *
 * A straight alias of the wire shape rather than a mapped copy: a second structure would be a
 * second place for a field to go stale, and there is no presentational difference to justify it.
 * In particular `behind: number | null` keeps its wire meaning — **`null` is "no cards yet, so
 * nothing to compute this from", never "nobody is behind"** — and `<ReachPanel>` renders the two
 * differently.
 */
export type DashboardTotals = DashboardTotalsDto;

/** One weekly bucket. ⚠ `count` is links **created** that week, never opens — see the ⚠ above. */
export type WeekBucket = SharingActivityBucketDto;

export type CardReach = CardReachItemDto;

export type Attention = AttentionItemDto;

/** Every profile group with its field count — what `<ProfileStrength>` reads. */
export interface ProfileGroupSummary {
  id: string;
  name: string;
  fieldCount: number;
}

export interface DashboardView {
  totals: DashboardTotals;
  weeks: readonly WeekBucket[];
  reach: readonly CardReach[];
  attention: readonly Attention[];
  groups: readonly ProfileGroupSummary[];
}

/**
 * How many cards the reach chart draws.
 *
 * ⚠ The API returns **every** non-archived card, including the zero-activity ones, and that is
 * correct — a card nobody has opened is the most actionable row, not one to hide. The cap is
 * purely about how many bars fit before each is too thin to compare, so it is applied here, at
 * the surface that has the width problem, and nowhere else. The attention queue is **not**
 * capped: it is the list of things to act on, and truncating it would hide work.
 */
const REACH_ROWS = 5;

/**
 * The response, in the components' own vocabulary.
 *
 * ⚠ **Renaming and one deliberate truncation — no arithmetic, and no re-sorting.** `attention`
 * arrives in kind-priority order, worst-first within each kind, and `sharingActivity` arrives
 * oldest-first and Monday-aligned. Sorting either again here would be a second answer to a
 * question the API has already answered, and the one nobody updates when the other changes.
 *
 * `cardReach` is likewise returned in the API's order; only its length is trimmed, for the
 * width reason {@link REACH_ROWS} gives.
 */
export function toDashboardView(dto: DashboardResponseDto): DashboardView {
  return {
    totals: dto.totals,
    weeks: dto.sharingActivity,
    reach: dto.cardReach.slice(0, REACH_ROWS),
    attention: dto.attention,
    groups: dto.groups,
  };
}
