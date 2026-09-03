import { describe, expect, it } from "vitest";

import {
  attention,
  cardReach,
  sharingByWeek,
  totals,
  type MetricCard,
  type MetricLink,
} from "@/lib/dashboard/metrics";

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

describe("totals", () => {
  it("counts one person once, however many cards they hold", () => {
    /* A contact with links to three cards is one person reached, not three. Summing links
       here is the obvious mistake and it inflates the headline number the dashboard leads on. */
    const t = totals({
      cards: [card("card-1", "Work"), card("card-2", "Personal")],
      contactCount: 8,
      fieldCount: 35,
      links: [
        link({ cardId: "card-1", contactId: "c-1" }),
        link({ cardId: "card-2", contactId: "c-1" }),
        link({ cardId: "card-1", contactId: "c-2" }),
      ],
      behind: null,
    });
    expect(t.peopleReached).toBe(2);
  });

  it("excludes revoked links from reach and from opens", () => {
    /* A revoked link 410s — that person no longer holds the card, and their past opens are
       history rather than current reach. Counting them overstates both numbers permanently. */
    const t = totals({
      cards: [card("card-1", "Work")],
      contactCount: 2,
      fieldCount: 5,
      links: [
        link({ contactId: "c-1", viewCount: 4 }),
        link({ contactId: "c-2", viewCount: 9, status: "REVOKED" }),
      ],
      behind: null,
    });
    expect(t.peopleReached).toBe(1);
    expect(t.totalOpens).toBe(4);
  });

  it("counts never-opened active links — the actionable state", () => {
    const t = totals({
      cards: [card("card-1", "Work")],
      contactCount: 3,
      fieldCount: 5,
      links: [
        link({ contactId: "c-1", viewCount: 0 }),
        link({ contactId: "c-2", viewCount: 0 }),
        link({ contactId: "c-3", viewCount: 2 }),
      ],
      behind: null,
    });
    expect(t.neverOpened).toBe(2);
  });

  it("keeps `behind` null when the audience could not be read, rather than showing 0", () => {
    /* 0 means "everyone is up to date" — a claim. `null` means "we do not know". Collapsing
       the second into the first tells the owner nothing needs doing when it might. */
    const t = totals({ cards: [], contactCount: 0, fieldCount: 0, links: [], behind: null });
    expect(t.behind).toBeNull();
  });
});

describe("sharingByWeek", () => {
  const NOW = new Date("2026-09-02T12:00:00.000Z"); // a Wednesday

  it("emits a bucket for every week, including the empty ones", () => {
    /* ⚠ The gaps are the chart. Bucketing only weeks that have data draws a continuous line
       across a month of silence and turns a quiet period into a busy one. */
    const weeks = sharingByWeek([link({ createdAt: "2026-09-01T09:00:00.000Z" })], NOW, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks.map((w) => w.count)).toEqual([0, 0, 0, 1]);
  });

  it("buckets by Monday UTC, so a Sunday and the next Monday are different weeks", () => {
    const weeks = sharingByWeek(
      [
        link({ createdAt: "2026-08-30T23:00:00.000Z" }), // Sunday
        link({ createdAt: "2026-08-31T01:00:00.000Z" }), // Monday
      ],
      NOW,
      3,
    );
    const nonZero = weeks.filter((w) => w.count > 0);
    expect(nonZero).toHaveLength(2);
    expect(nonZero.every((w) => w.count === 1)).toBe(true);
  });

  it("ends on the current week and runs oldest first", () => {
    const weeks = sharingByWeek([], NOW, 3);
    expect(weeks.at(-1)?.weekStart).toBe("2026-08-31");
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-08-17", "2026-08-24", "2026-08-31"]);
  });

  it("ignores an unparseable timestamp instead of throwing", () => {
    expect(() => sharingByWeek([link({ createdAt: "not-a-date" })], NOW, 2)).not.toThrow();
  });
});

describe("cardReach", () => {
  it("keeps never-shared cards at zero rather than dropping them", () => {
    /* The emptiest cards are the ones worth acting on; a chart that omits them hides exactly
       the thing the owner should notice. */
    const reach = cardReach(
      [card("card-1", "Work"), card("card-2", "Never sent")],
      [link({ cardId: "card-1", viewCount: 3 })],
    );
    expect(reach.map((r) => r.cardName)).toEqual(["Work", "Never sent"]);
    expect(reach[1]?.opens).toBe(0);
  });

  it("ranks by opens, breaking ties on recipients then name", () => {
    const reach = cardReach(
      [card("a", "Alpha"), card("b", "Beta"), card("c", "Gamma")],
      [
        link({ cardId: "b", contactId: "c-1", viewCount: 5 }),
        link({ cardId: "a", contactId: "c-1", viewCount: 5 }),
        link({ cardId: "a", contactId: "c-2", viewCount: 0 }),
      ],
    );
    // Alpha and Beta both have 5 opens; Alpha has two recipients so it leads.
    expect(reach.map((r) => r.cardName)).toEqual(["Alpha", "Beta", "Gamma"]);
  });
});

describe("attention", () => {
  it("reports an empty card and stops there, rather than also nagging about its reach", () => {
    const rows = attention([{ id: "card-1", name: "Blank card", fieldIds: [] }], [], new Map());
    expect(rows).toEqual([
      { kind: "no-fields", cardId: "card-1", cardName: "Blank card", count: 0 },
    ]);
  });

  it("surfaces recipients behind, worst first", () => {
    const rows = attention(
      [card("card-1", "Work"), card("card-2", "Personal")],
      [
        link({ cardId: "card-1", contactId: "c-1", viewCount: 1 }),
        link({ cardId: "card-2", contactId: "c-2", viewCount: 1 }),
      ],
      new Map([
        ["card-1", 1],
        ["card-2", 4],
      ]),
    );
    expect(rows.map((r) => [r.kind, r.cardName, r.count])).toEqual([
      ["behind", "Personal", 4],
      ["behind", "Work", 1],
    ]);
  });

  it("distinguishes never-shared from shared-but-unopened", () => {
    const rows = attention(
      [card("card-1", "Never sent"), card("card-2", "Sent, ignored")],
      [link({ cardId: "card-2", contactId: "c-1", viewCount: 0 })],
      new Map(),
    );
    expect(rows.map((r) => r.kind)).toEqual(["never-opened", "never-shared"]);
  });

  it("says nothing about a healthy card", () => {
    const rows = attention(
      [card("card-1", "Work")],
      [link({ cardId: "card-1", contactId: "c-1", viewCount: 3 })],
      new Map([["card-1", 0]]),
    );
    expect(rows).toEqual([]);
  });
});
