import { BUILDER_NEW_CARD_NAME } from "@/components/builder/builder-reducer";

import type { DashboardResponseDto } from "@/lib/api/schema";

/**
 * THE REACH SCORE — one number for "is this card doing its job", and the actions that raise it.
 *
 * ## Why a score at all
 *
 * The dashboard was five tiles of identical weight, three of which were counts nobody acts on.
 * Nothing on it said whether the owner was doing well, and nothing said what to do next. A score
 * is the smallest thing that answers both, *provided it decomposes* — a bare number with no
 * breakdown is a horoscope.
 *
 * So the unit of this module is not the score, it is the **lever**: each one names a real ratio,
 * carries the points it is worth, and the UI turns the incomplete ones into the next-best-action
 * queue. The score is defined as the sum of the levers, never computed separately — see
 * {@link ReachScore.score} for why that direction matters.
 *
 * ## ⚠ Every input is already computed — **by the API**. Nothing here is invented.
 *
 * `metrics.ts` opens with a warning that bears repeating: `ShareLink` carries a counter and two
 * bookends, **not a log**, so opens-over-time is not computable and must not be drawn. The same
 * discipline binds a score: XP, levels and streaks were all considered and all rejected, because
 * none of them measures anything the API knows. A score made of invented numbers is worse than
 * no score, because it looks like measurement.
 *
 * The three levers below are ratios over fields of `GET /dashboard` — `totals.peopleReached`,
 * `totals.peopleOpened`, `totals.behind`, and the cards named in `cardReach`/`attention`. This
 * module reads the **raw response** rather than the trimmed view, because `toDashboardView` caps
 * `cardReach` at five rows for chart width and the "ready" lever must count every card.
 *
 * ## ⚠ THE RULE THAT SHAPES EVERYTHING: UNKNOWN IS NOT ZERO
 *
 * Two of the three levers can be unmeasurable, and the difference between "you scored badly"
 * and "there is nothing to score yet" is the whole credibility of the number:
 *
 * - `behind` is `null` when there is nothing to compute it from — an account with no cards at
 *   all. The API is explicit that this is never `0`, which would mean "checked, nobody's
 *   behind".
 * - An owner who has never shared a card has **0 of 0** links opened. Scoring that as 0/40 tells
 *   someone with a perfectly good card that they are failing at something they have not done.
 *
 * So an unmeasurable lever is `state: "unknown"` and is **dropped from the denominator**, with
 * its weight redistributed across the levers that can be measured ({@link distribute}). A brand
 * new owner is therefore rated only on the cards they have built, which is the only thing about
 * them that exists.
 */

/** Base weights, before any redistribution. They sum to 100 and are the only tunable here. */
const WEIGHTS = { opened: 40, told: 30, ready: 30 } as const;

export type LeverId = keyof typeof WEIGHTS;

export interface ScoreLever {
  id: LeverId;
  /** `done` of `total` — the ratio itself, so the UI never recomputes it from points. */
  done: number;
  total: number;
  /**
   * How many things are actually left to do — the number the owner is asked to act on.
   *
   * ⚠ **Usually `total - done`, and deliberately NOT that for `told`.** The scoring ratio is
   * clamped into range so a contradictory `behind` cannot produce negative progress, but the
   * clamp must not reach the copy: with `behind: 3` against two people reached, a clamped
   * sentence reads "Tell 2 people" while the attention list immediately below it names three.
   * Two numbers for one backlog on one screen is precisely the defect the clamp exists to
   * avoid, just moved. So the score stays clamped and the instruction stays truthful.
   */
  outstanding: number;
  /** Points earned, and the points this lever is worth AFTER redistribution. */
  earned: number;
  available: number;
  /**
   * `done` — nothing left to do here.
   * `open` — measurable, and incomplete: this is what becomes a next-best action.
   * `unknown` — not measurable; contributes nothing and takes no weight.
   */
  state: "done" | "open" | "unknown";
}

export interface ReachScore {
  /**
   * 0–100, or `null` when not one lever is measurable — an owner with no cards at all.
   *
   * ⚠ `null` rather than `0`, and the surface must render it as an invitation rather than a
   * grade. Someone who signed up ninety seconds ago has not scored zero; they have not played.
   * Rendering their empty account as a big red 0 is the single most likely way to make this
   * feature worse than the tiles it replaces.
   *
   * ⚠ And it is the **sum of the levers**, not a parallel calculation. The surface prints the
   * levers ("+30", "+15") next to the score, so a score derived independently would eventually
   * disagree with its own breakdown by a point of rounding and quietly destroy trust in the
   * whole panel. Summing rounded integers makes the arithmetic the reader can do come out.
   */
  score: number | null;
  levers: readonly ScoreLever[];
}

/**
 * Split 100 points across the measurable levers by their base weight, as whole numbers.
 *
 * Largest-remainder rather than naive rounding: with two measurable levers weighted 40 and 30,
 * proportional shares are 57.14 and 42.86, and rounding each independently gives 57 + 43 = 100
 * here but 33+33+33 = 99 in the three-way case. A score whose parts sum to 99 is a bug the
 * reader can see, because the parts are printed beside it.
 */
function distribute(ids: readonly LeverId[]): Record<string, number> {
  const totalWeight = ids.reduce((sum, id) => sum + WEIGHTS[id], 0);
  if (totalWeight === 0) return {};

  const exact = ids.map((id) => ({ id, value: (WEIGHTS[id] / totalWeight) * 100 }));
  const out: Record<string, number> = {};
  for (const e of exact) out[e.id] = Math.floor(e.value);

  /* Hand the leftover points to the largest fractional parts, biggest first. */
  let remainder = 100 - Object.values(out).reduce((a, b) => a + b, 0);
  const byFraction = [...exact].sort((a, b) => (b.value % 1) - (a.value % 1));
  for (const e of byFraction) {
    if (remainder <= 0) break;
    out[e.id] += 1;
    remainder -= 1;
  }
  return out;
}

/**
 * How many cards would actually be worth receiving.
 *
 * ⚠ Read off `cardReach` and `attention` rather than off a card list, because those are what
 * `GET /dashboard` returns — and `cardReach` carries **one row per non-archived card**,
 * including the zero-activity ones, so it is a complete roster and not just the active cards.
 *
 * Two separate failures, and both are real. A card with no fields shares nothing — the API
 * reports exactly those as `attention.kind === "no-fields"`, so that judgement is the server's
 * and is not re-derived here. A card still called "Untitled card" has been abandoned mid-build,
 * which the builder's own comments record as a shipped defect ("card after card still called
 * Untitled card"); that one is a naming rule the API has no opinion about, so it stays here.
 * Trimmed and compared case-insensitively so "untitled card " does not sneak past.
 */
function readyCardCount(dto: DashboardResponseDto): number {
  const empty = new Set(
    dto.attention.filter((row) => row.kind === "no-fields").map((row) => row.cardId),
  );
  return dto.cardReach.filter(
    (card) =>
      !empty.has(card.cardId) &&
      card.cardName.trim().toLowerCase() !== BUILDER_NEW_CARD_NAME.toLowerCase(),
  ).length;
}

/**
 * @param dto the **raw** `GET /dashboard` response — not `toDashboardView`'s output, whose
 *   `reach` is capped at five rows for chart width. Scoring off a truncated roster would rate an
 *   owner with nine cards as though they had five.
 */
export function reachScore(dto: DashboardResponseDto): ReachScore {
  /* ── Lever 1 — opened, measured in PEOPLE rather than links ───────────────────────────
     One person holding links to three cards is one person reached, which is how
     `totals.peopleReached` counts them. Measuring this lever in links instead would let a single
     enthusiastic recipient with several cards outweigh three silent ones, and the panel would
     print a people-count beside a link-derived rate that disagrees with it.

     ⚠ This is why the score reads `peopleOpened` and **not** `neverOpened`: the latter counts
     LINKS, and one person may hold three and have opened one. Neither is derivable from the
     other, which is why the API returns both. */
  const reachedCount = dto.totals.peopleReached;
  const openedCount = dto.totals.peopleOpened;

  /* ── Lever 2 — told ───────────────────────────────────────────────────────────────────
     ⚠ The clamp stays, although the bug that forced it is fixed. Live data used to carry
     `behind: 3` against `peopleReached: 2` — three people behind on cards only two people hold —
     because the two were reduced from different client-side collections. `GET /dashboard`
     computes both from one pass, so `behind` can no longer exceed `peopleReached`. The clamp
     costs nothing and keeps a future upstream regression from printing "-1 people up to date" on
     an owner's dashboard rather than merely being wrong in a log. */
  const behind = dto.totals.behind;
  const behindCount = behind === null ? 0 : Math.min(Math.max(behind, 0), reachedCount);
  const toldMeasurable = behind !== null && reachedCount > 0;

  /* ── Lever 3 — ready ──────────────────────────────────────────────────────────────────
     The only lever an owner with no links can move, and therefore the only thing a brand new
     account is rated on. */
  const readyCards = readyCardCount(dto);
  const cardCount = dto.totals.cards;

  const raw: Record<
    LeverId,
    { done: number; total: number; outstanding: number; measurable: boolean }
  > = {
    opened: {
      done: openedCount,
      total: reachedCount,
      outstanding: reachedCount - openedCount,
      measurable: reachedCount > 0,
    },
    told: {
      done: reachedCount - behindCount,
      total: reachedCount,
      /* The UNCLAMPED backlog — what the owner must actually notify. See `outstanding`. */
      outstanding: Math.max(behind ?? 0, 0),
      measurable: toldMeasurable,
    },
    ready: {
      done: readyCards,
      total: cardCount,
      outstanding: cardCount - readyCards,
      measurable: cardCount > 0,
    },
  };

  const measurable = (Object.keys(WEIGHTS) as LeverId[]).filter((id) => raw[id].measurable);
  const available = distribute(measurable);

  const levers: ScoreLever[] = (Object.keys(WEIGHTS) as LeverId[]).map((id) => {
    const r = raw[id];
    if (!r.measurable) {
      return {
        id,
        done: r.done,
        total: r.total,
        outstanding: r.outstanding,
        earned: 0,
        available: 0,
        state: "unknown",
      };
    }
    const worth = available[id] ?? 0;
    const earned = Math.round(worth * (r.done / r.total));
    return {
      id,
      done: r.done,
      total: r.total,
      outstanding: r.outstanding,
      earned,
      available: worth,
      state: r.done >= r.total ? "done" : "open",
    };
  });

  return {
    score: measurable.length === 0 ? null : levers.reduce((sum, l) => sum + l.earned, 0),
    levers,
  };
}

/** The levers worth acting on, biggest win first — the next-best-action queue. */
export function openLevers(score: ReachScore): readonly ScoreLever[] {
  return score.levers
    .filter((l) => l.state === "open")
    .sort((a, b) => b.available - b.earned - (a.available - a.earned));
}
