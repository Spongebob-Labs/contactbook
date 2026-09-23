import { describe, expect, it } from "vitest";

import type { DashboardResponseDto } from "@/lib/api/schema";
import { openLevers, reachScore } from "@/lib/dashboard/reach-score";

/**
 * An account, stated as `GET /dashboard` returns it.
 *
 * ⚠ **These fixtures name their totals outright instead of reducing a link list into them**, and
 * that is the point of the rewrite rather than a convenience. The reduction — which links are
 * ACTIVE, which contacts are distinct, who is behind — is the API's job now, computed in one
 * pass precisely so the client cannot hold a second, divergent copy of it. A test that rebuilt
 * that reduction here would be asserting against a copy of the server's logic that nobody keeps
 * in step, which is the defect the endpoint exists to delete.
 *
 * So each case below says what the account *is*, and the assertions are about the score.
 */
function dto(over: {
  cards?: ReadonlyArray<{ id: string; name: string; empty?: boolean }>;
  peopleReached?: number;
  peopleOpened?: number;
  behind?: number | null;
}): DashboardResponseDto {
  const cards = over.cards ?? [];
  return {
    totals: {
      cards: cards.length,
      contacts: 0,
      fields: 0,
      peopleReached: over.peopleReached ?? 0,
      peopleOpened: over.peopleOpened ?? 0,
      totalOpens: 0,
      neverOpened: 0,
      behind: over.behind === undefined ? null : over.behind,
    },
    /* One row per non-archived card, which is what the API guarantees — including the
       zero-activity ones. The "ready" lever counts off exactly this roster. */
    cardReach: cards.map((c) => ({
      cardId: c.id,
      cardName: c.name,
      opens: 0,
      recipients: 0,
    })),
    /* An empty card is reported by the API as `no-fields`; the score reads that verdict rather
       than re-deriving it from a field list it is no longer sent. */
    attention: cards
      .filter((c) => c.empty === true)
      .map((c) => ({ kind: "no-fields" as const, cardId: c.id, cardName: c.name, count: 0 })),
    sharingActivity: [],
    groups: [],
  };
}

const lever = (s: ReturnType<typeof reachScore>, id: string) =>
  s.levers.find((l) => l.id === id)!;

describe("reachScore", () => {
  /**
   * The live account on 2026-09-19, so the number the owner sees is pinned to a real case and
   * not only to constructed ones: two cards (one still called "Untitled card"), two people
   * reached, both opened, three recipients behind.
   */
  it("scores the live account at 55, and its parts add up to exactly that", () => {
    const s = reachScore(
      dto({
        cards: [
          { id: "c1", name: "My Card" },
          { id: "c2", name: "Untitled card" },
        ],
        peopleReached: 2,
        peopleOpened: 2,
        behind: 3,
      }),
    );

    expect(s.score).toBe(55);
    expect(lever(s, "opened").earned).toBe(40);
    expect(lever(s, "told").earned).toBe(0);
    expect(lever(s, "ready").earned).toBe(15);
    /* The panel prints the parts beside the total, so the reader can do this sum themselves. */
    expect(s.levers.reduce((n, l) => n + l.earned, 0)).toBe(s.score);
  });

  /**
   * ⚠ The shape this guards — `behind` exceeding `peopleReached` — is no longer reachable from
   * the API, which computes both from one pass. The clamp stays because it costs nothing and
   * keeps a future upstream regression from printing "-1 of 2 up to date" on a real dashboard.
   */
  it("never reports negative progress when more people are behind than were reached", () => {
    const s = reachScore(
      dto({
        cards: [{ id: "c1", name: "My Card" }],
        peopleReached: 1,
        peopleOpened: 1,
        behind: 99,
      }),
    );

    const told = lever(s, "told");
    expect(told.done).toBe(0);
    expect(told.done).toBeGreaterThanOrEqual(0);
    expect(told.earned).toBe(0);
    expect(s.score).toBeGreaterThanOrEqual(0);
  });

  /* ── unknown is not zero — the rule the module is built around ─────────────────────── */

  it("drops the told lever when the audience is unknown, rather than scoring it zero", () => {
    const base = {
      cards: [{ id: "c1", name: "My Card" }],
      peopleReached: 1,
      peopleOpened: 1,
    };

    const unknown = reachScore(dto({ ...base, behind: null }));
    const zero = reachScore(dto({ ...base, behind: 0 }));

    expect(lever(unknown, "told").state).toBe("unknown");
    expect(lever(unknown, "told").available).toBe(0);
    /* Everything measurable is perfect in both, so both must read 100 — the unknown lever is
       not allowed to quietly cost the owner 30 points for a number that does not exist yet. */
    expect(unknown.score).toBe(100);
    expect(zero.score).toBe(100);
  });

  it("rates an owner who has never shared only on the cards they have built", () => {
    const s = reachScore(
      dto({
        cards: [
          { id: "c1", name: "My Card" },
          { id: "c2", name: "Untitled card" },
        ],
        behind: null,
      }),
    );

    expect(lever(s, "opened").state).toBe("unknown");
    expect(lever(s, "told").state).toBe("unknown");
    /* One of two cards is finished, and `ready` now carries the whole 100. */
    expect(lever(s, "ready").available).toBe(100);
    expect(s.score).toBe(50);
  });

  it("returns null — never 0 — for an owner with nothing yet", () => {
    const s = reachScore(dto({ cards: [], behind: null }));
    expect(s.score).toBeNull();
    expect(s.levers.every((l) => l.state === "unknown")).toBe(true);
  });

  /* ── the readiness rule ────────────────────────────────────────────────────────────── */

  it("counts a card as unready while it is empty or still unnamed", () => {
    const s = reachScore(
      dto({
        cards: [
          { id: "c1", name: "My Card" },
          { id: "c2", name: "Untitled card" },
          { id: "c3", name: "  untitled card  " },
          /* Named, but shares nothing — the API flags it `no-fields`. */
          { id: "c4", name: "Work", empty: true },
        ],
        behind: null,
      }),
    );

    expect(lever(s, "ready").done).toBe(1);
    expect(lever(s, "ready").total).toBe(4);
  });

  /* ── arithmetic that the reader can check ──────────────────────────────────────────── */

  it("always distributes exactly 100 points across whichever levers are measurable", () => {
    const cases = [
      { cards: [{ id: "c1", name: "A" }], peopleReached: 1, peopleOpened: 1, behind: 0 },
      { cards: [{ id: "c1", name: "A" }], peopleReached: 1, peopleOpened: 1, behind: null },
      { cards: [{ id: "c1", name: "A" }], behind: null },
    ];

    for (const input of cases) {
      const s = reachScore(dto(input));
      const total = s.levers.reduce((n, l) => n + l.available, 0);
      expect(total, JSON.stringify(input)).toBe(100);
    }
  });

  it("keeps the score inside 0–100 across a sweep of shapes", () => {
    for (let opened = 0; opened <= 3; opened += 1) {
      for (let behind = 0; behind <= 4; behind += 1) {
        const s = reachScore(
          dto({
            cards: [
              { id: "c1", name: "A" },
              { id: "c2", name: "B" },
            ],
            peopleReached: 3,
            peopleOpened: opened,
            behind,
          }),
        );
        expect(s.score, `opened=${opened} behind=${behind}`).toBeGreaterThanOrEqual(0);
        expect(s.score, `opened=${opened} behind=${behind}`).toBeLessThanOrEqual(100);
      }
    }
  });

  /**
   * ⚠ The opened lever is measured in **people**, and this is the assertion that pins it.
   *
   * `cardReach` below describes two links across two cards, held by one person who opened one of
   * them. Measured in links that is "1 of 2"; measured in people it is "1 of 1" — a single
   * enthusiastic recipient must not outweigh three silent ones, and the panel prints a people
   * count beside this rate. So the lever reads `peopleReached`/`peopleOpened` and must never be
   * rebuilt from `recipients` or from `neverOpened`, which count links.
   */
  it("measures the opened lever in people, never in links", () => {
    const account = dto({
      cards: [
        { id: "c1", name: "A" },
        { id: "c2", name: "B" },
      ],
      peopleReached: 1,
      peopleOpened: 1,
      behind: 0,
    });
    account.cardReach = [
      { cardId: "c1", cardName: "A", opens: 9, recipients: 1 },
      { cardId: "c2", cardName: "B", opens: 0, recipients: 1 },
    ];
    account.totals.neverOpened = 1;

    const s = reachScore(account);
    expect(lever(s, "opened").total).toBe(1);
    expect(lever(s, "opened").done).toBe(1);
    expect(lever(s, "opened").state).toBe("done");
  });

  /* ── the action queue ──────────────────────────────────────────────────────────────── */

  it("queues the incomplete levers by the points still on the table", () => {
    const s = reachScore(
      dto({
        cards: [
          { id: "c1", name: "My Card" },
          { id: "c2", name: "Untitled card" },
        ],
        peopleReached: 2,
        peopleOpened: 1,
        behind: 2,
      }),
    );

    const open = openLevers(s);
    expect(open.map((l) => l.id)).toEqual(["told", "opened", "ready"]);
    /* Never offers an action for something already finished, or unmeasurable. */
    expect(open.every((l) => l.state === "open")).toBe(true);
  });
});
