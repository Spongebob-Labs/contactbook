import { describe, expect, it } from "vitest";

import type { DashboardResponseDto } from "@/lib/api/schema";
import {
  readDashboardSummary,
  readDashboardTotals,
  toDashboardView,
} from "@/lib/dashboard/metrics";

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
 * that is what this file tests — and, above all, that it does **no arithmetic**. Plus
 * {@link readDashboardTotals}, which checks the counts off the wire; see the second block.
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

/**
 * ⚠ The wire boundary. The deployed API can lag this app's DTO — staging on 2026-09-23 sent no
 * `peopleOpened`, `reachScore` computed `2 - undefined`, and the dial printed `NaN`. Every count
 * is checked here, once, before the view or the score sees it, and an unreadable one is `null`:
 * unknown, which the screen renders as unknown. Never `0`, which would be a measurement.
 */
describe("readDashboardTotals", () => {
  it("passes valid totals through unchanged, keeping behind: null distinct from 0", () => {
    const rejected: string[] = [];
    expect(readDashboardTotals(dto().totals, rejected)).toEqual(dto().totals);

    const empty = readDashboardTotals({ ...dto().totals, behind: null }, rejected);
    const clear = readDashboardTotals({ ...dto().totals, behind: 0 }, rejected);
    expect(empty.behind).toBeNull();
    expect(clear.behind).toBe(0);
    /* `behind: null` is the API's own answer ("no cards yet"), not drift — nothing to report. */
    expect(rejected).toEqual([]);
  });

  it("reads a count the API did not send as null — never 0 — and names it", () => {
    const staging: Record<string, unknown> = { ...dto().totals };
    delete staging.peopleOpened;
    const rejected: string[] = [];
    const totals = readDashboardTotals(staging, rejected);

    expect(totals.peopleOpened).toBeNull();
    expect(totals.peopleReached).toBe(5);
    expect(rejected).toEqual(["peopleOpened=undefined"]);
  });

  it("rejects non-numeric and non-finite counts rather than coercing them", () => {
    const rejected: string[] = [];
    const totals = readDashboardTotals(
      {
        ...dto().totals,
        cards: "3",
        contacts: Number.NaN,
        fields: Number.POSITIVE_INFINITY,
        totalOpens: null,
        neverOpened: {},
        behind: "0",
      },
      rejected,
    );

    expect(totals).toEqual({
      cards: null,
      contacts: null,
      fields: null,
      peopleReached: 5,
      peopleOpened: 4,
      totalOpens: null,
      neverOpened: null,
      behind: null,
    });
    expect(rejected).toHaveLength(6);
  });

  it("reads a missing totals object as every count unknown", () => {
    const totals = readDashboardTotals(undefined);
    expect(Object.values(totals).every((v) => v === null)).toBe(true);
  });

  it("validates only the totals, and hands the rest of the response on untouched", () => {
    const cardReach = [reachRow(1)];
    const raw = dto({ cardReach });
    const summary = readDashboardSummary(raw);

    expect(summary.cardReach).toBe(cardReach);
    expect(summary.attention).toBe(raw.attention);
    /* And the view built from a lagging payload carries the unknown through, not a number. */
    const staging: Record<string, unknown> = { ...raw.totals };
    delete staging.peopleOpened;
    const view = toDashboardView(
      readDashboardSummary({ ...raw, totals: staging as unknown as DashboardResponseDto["totals"] }),
    );
    expect(view.totals.peopleOpened).toBeNull();
  });
});
