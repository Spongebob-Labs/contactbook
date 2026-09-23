import { describe, expect, it } from "vitest";

import type { DashboardResponseDto } from "@/lib/api/schema";
import { toDashboardView } from "@/lib/dashboard/metrics";

/**
 * ⚠ **What this file used to assert, and where those assertions went.**
 *
 * It tested `totals()`, `sharingByWeek()`, `cardReach()` and `attention()` — four client-side
 * reductions over `GET /cards` + `GET /contacts` + `GET /share-links` + one audience call per
 * card. All four are gone: `GET /dashboard` computes them in a single pass, which is what makes
 * `behind` structurally unable to exceed `peopleReached` (the live bug that motivated the
 * endpoint — the two were reduced from different collections here and disagreed).
 *
 * Those rules are now asserted in the API's own suite, against the query that implements them.
 * Re-asserting them here would mean rebuilding the reduction in the test, which is exactly the
 * second source of truth the endpoint deleted.
 *
 * What is left on the client is {@link toDashboardView}: renaming, and one width-driven cap. So
 * that is what this file tests — and, above all, that it does **no arithmetic**.
 */
function dto(over: Partial<DashboardResponseDto> = {}): DashboardResponseDto {
  return {
    totals: {
      cards: 3,
      contacts: 8,
      fields: 35,
      peopleReached: 5,
      peopleOpened: 4,
      totalOpens: 47,
      neverOpened: 2,
      behind: 1,
    },
    cardReach: [],
    attention: [],
    sharingActivity: [],
    groups: [],
    ...over,
  };
}

const reachRow = (i: number) => ({
  cardId: `c${i}`,
  cardName: `Card ${i}`,
  opens: i,
  recipients: i,
});

describe("toDashboardView", () => {
  it("passes the totals through untouched, including behind: null", () => {
    /* ⚠ `null` is "no cards yet, nothing to compute this from" — NOT "nobody is behind". A view
       layer that coalesced it to 0 would report a confident all-clear to an empty account. */
    const view = toDashboardView(dto({ totals: { ...dto().totals, behind: null } }));
    expect(view.totals.behind).toBeNull();
    expect(view.totals.peopleReached).toBe(5);
    expect(view.totals.peopleOpened).toBe(4);
    expect(view.totals.totalOpens).toBe(47);
  });

  it("keeps every weekly bucket, in the order the API sent them", () => {
    /* The API sends 12 buckets oldest-first, INCLUDING the empty weeks — the gaps are the point,
       or a month of silence draws as a continuous line. Nothing here may filter or re-sort. */
    const sharingActivity = Array.from({ length: 12 }, (_, i) => ({
      weekStart: `2026-0${i < 3 ? 7 : 8}-${String(i + 1).padStart(2, "0")}`,
      count: i % 3 === 0 ? 0 : i,
    }));
    const view = toDashboardView(dto({ sharingActivity }));

    expect(view.weeks).toEqual(sharingActivity);
    expect(view.weeks.filter((w) => w.count === 0).length).toBeGreaterThan(0);
  });

  it("caps the reach chart at five bars, keeping the API's own order", () => {
    /* The cap is a width rule and nothing else: past five bars each is too thin to compare. It
       is applied here, at the surface with the width problem, and the API still returns every
       card — including the zero-activity ones, which are the actionable rows. */
    const cardReach = Array.from({ length: 9 }, (_, i) => reachRow(i));
    const view = toDashboardView(dto({ cardReach }));

    expect(view.reach).toHaveLength(5);
    expect(view.reach.map((r) => r.cardId)).toEqual(["c0", "c1", "c2", "c3", "c4"]);
  });

  it("never truncates or re-sorts the attention queue", () => {
    /* ⚠ The queue is the list of things to act on, so capping it would hide work — and it
       arrives in kind-priority order, worst-first within each kind. Re-sorting here would be a
       second answer to a question the API has already answered. */
    const attention: DashboardResponseDto["attention"] = [
      { kind: "no-fields", cardId: "c1", cardName: "Empty", count: 0 },
      { kind: "behind", cardId: "c2", cardName: "Work", count: 5 },
      { kind: "behind", cardId: "c3", cardName: "Play", count: 2 },
      { kind: "never-opened", cardId: "c4", cardName: "Cold", count: 9 },
      { kind: "never-shared", cardId: "c5", cardName: "New", count: 0 },
      { kind: "never-shared", cardId: "c6", cardName: "Newer", count: 0 },
    ];
    const view = toDashboardView(dto({ attention }));

    expect(view.attention).toEqual(attention);
  });

  it("keeps every group, including the empty ones", () => {
    /* An empty group is a gap in every card at once — dropping it would report a profile as
       complete precisely when it is not. */
    const groups = [
      { id: "g1", name: "Work", fieldCount: 4 },
      { id: "g2", name: "Personal", fieldCount: 0 },
    ];
    const view = toDashboardView(dto({ groups }));

    expect(view.groups).toEqual(groups);
    expect(view.groups.some((g) => g.fieldCount === 0)).toBe(true);
  });
});
