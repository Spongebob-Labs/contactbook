import { describe, expect, it } from "vitest";

import type { MetricCard, MetricLink } from "@/lib/dashboard/metrics";
import { openLevers, reachScore } from "@/lib/dashboard/reach-score";

const link = (over: Partial<MetricLink> = {}): MetricLink => ({
  cardId: "card-1",
  contactId: "c-1",
  status: "ACTIVE",
  viewCount: 0,
  createdAt: "2026-08-24T10:00:00.000Z",
  ...over,
});

const card = (id: string, name: string, fields = 3): MetricCard => ({
  id,
  name,
  fieldIds: Array.from({ length: fields }, (_, i) => `f-${i}`),
});

const lever = (s: ReturnType<typeof reachScore>, id: string) =>
  s.levers.find((l) => l.id === id)!;

describe("reachScore", () => {
  /**
   * The live account on 2026-09-19, so the number the owner sees is pinned to a real case and
   * not only to constructed ones: two cards (one still called "Untitled card"), two people
   * reached, both opened, three recipients behind.
   */
  it("scores the live account at 55, and its parts add up to exactly that", () => {
    const s = reachScore({
      cards: [card("c1", "My Card", 11), card("c2", "Untitled card", 11)],
      links: [
        link({ cardId: "c1", contactId: "p1", viewCount: 12 }),
        link({ cardId: "c2", contactId: "p2", viewCount: 8 }),
      ],
      behind: 3,
    });

    expect(s.score).toBe(55);
    expect(lever(s, "opened").earned).toBe(40);
    expect(lever(s, "told").earned).toBe(0);
    expect(lever(s, "ready").earned).toBe(15);
    /* The panel prints the parts beside the total, so the reader can do this sum themselves. */
    expect(s.levers.reduce((n, l) => n + l.earned, 0)).toBe(s.score);
  });

  /**
   * ⚠ The defect this guards is in the live data, not in this module: `behind: 3` against two
   * people reached. Unclamped, the "up to date" lever reads `2 - 3 = -1` and the dashboard
   * prints "-1 of 2 up to date".
   */
  it("never reports negative progress when more people are behind than were reached", () => {
    const s = reachScore({
      cards: [card("c1", "My Card")],
      links: [link({ contactId: "p1", viewCount: 4 })],
      behind: 99,
    });

    const told = lever(s, "told");
    expect(told.done).toBe(0);
    expect(told.done).toBeGreaterThanOrEqual(0);
    expect(told.earned).toBe(0);
    expect(s.score).toBeGreaterThanOrEqual(0);
  });

  /* ── unknown is not zero — the rule the module is built around ─────────────────────── */

  it("drops the told lever when the audience is unknown, rather than scoring it zero", () => {
    const base = {
      cards: [card("c1", "My Card")],
      links: [link({ contactId: "p1", viewCount: 3 })],
    };

    const unknown = reachScore({ ...base, behind: null });
    const zero = reachScore({ ...base, behind: 0 });

    expect(lever(unknown, "told").state).toBe("unknown");
    expect(lever(unknown, "told").available).toBe(0);
    /* Everything measurable is perfect in both, so both must read 100 — the unknown lever is
       not allowed to quietly cost the owner 30 points for an endpoint being down. */
    expect(unknown.score).toBe(100);
    expect(zero.score).toBe(100);
  });

  it("rates an owner who has never shared only on the cards they have built", () => {
    const s = reachScore({
      cards: [card("c1", "My Card"), card("c2", "Untitled card")],
      links: [],
      behind: null,
    });

    expect(lever(s, "opened").state).toBe("unknown");
    expect(lever(s, "told").state).toBe("unknown");
    /* One of two cards is finished, and `ready` now carries the whole 100. */
    expect(lever(s, "ready").available).toBe(100);
    expect(s.score).toBe(50);
  });

  it("returns null — never 0 — for an owner with nothing yet", () => {
    const s = reachScore({ cards: [], links: [], behind: null });
    expect(s.score).toBeNull();
    expect(s.levers.every((l) => l.state === "unknown")).toBe(true);
  });

  /* ── the readiness rule ────────────────────────────────────────────────────────────── */

  it("counts a card as unready while it is empty or still unnamed", () => {
    const s = reachScore({
      cards: [
        card("c1", "My Card", 5),
        card("c2", "Untitled card", 5),
        card("c3", "  untitled card  ", 5),
        card("c4", "Work", 0),
      ],
      links: [],
      behind: null,
    });

    expect(lever(s, "ready").done).toBe(1);
    expect(lever(s, "ready").total).toBe(4);
  });

  /* ── arithmetic that the reader can check ──────────────────────────────────────────── */

  it("always distributes exactly 100 points across whichever levers are measurable", () => {
    const cases = [
      { cards: [card("c1", "A")], links: [link({ contactId: "p1", viewCount: 1 })], behind: 0 },
      { cards: [card("c1", "A")], links: [link({ contactId: "p1", viewCount: 1 })], behind: null },
      { cards: [card("c1", "A")], links: [], behind: null },
    ];

    for (const input of cases) {
      const s = reachScore(input);
      const total = s.levers.reduce((n, l) => n + l.available, 0);
      expect(total, JSON.stringify(input)).toBe(100);
    }
  });

  it("keeps the score inside 0–100 across a sweep of shapes", () => {
    for (let opened = 0; opened <= 3; opened += 1) {
      for (let behind = 0; behind <= 4; behind += 1) {
        const links = Array.from({ length: 3 }, (_, i) =>
          link({ contactId: `p${i}`, viewCount: i < opened ? 5 : 0 }),
        );
        const s = reachScore({ cards: [card("c1", "A"), card("c2", "B")], links, behind });
        expect(s.score, `opened=${opened} behind=${behind}`).toBeGreaterThanOrEqual(0);
        expect(s.score, `opened=${opened} behind=${behind}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("counts one person holding several cards once, not once per link", () => {
    const s = reachScore({
      cards: [card("c1", "A"), card("c2", "B")],
      links: [
        link({ cardId: "c1", contactId: "same", viewCount: 9 }),
        link({ cardId: "c2", contactId: "same", viewCount: 0 }),
      ],
      behind: 0,
    });

    /* One person, reached and opened — not "1 of 2 links". */
    expect(lever(s, "opened").total).toBe(1);
    expect(lever(s, "opened").done).toBe(1);
  });

  it("ignores revoked links entirely", () => {
    const s = reachScore({
      cards: [card("c1", "A")],
      links: [link({ contactId: "gone", status: "REVOKED", viewCount: 0 })],
      behind: null,
    });

    expect(lever(s, "opened").state).toBe("unknown");
  });

  /* ── the action queue ──────────────────────────────────────────────────────────────── */

  it("queues the incomplete levers by the points still on the table", () => {
    const s = reachScore({
      cards: [card("c1", "My Card"), card("c2", "Untitled card")],
      links: [
        link({ cardId: "c1", contactId: "p1", viewCount: 5 }),
        link({ cardId: "c2", contactId: "p2", viewCount: 0 }),
      ],
      behind: 2,
    });

    const open = openLevers(s);
    expect(open.map((l) => l.id)).toEqual(["told", "opened", "ready"]);
    /* Never offers an action for something already finished, or unmeasurable. */
    expect(open.every((l) => l.state === "open")).toBe(true);
  });
});
