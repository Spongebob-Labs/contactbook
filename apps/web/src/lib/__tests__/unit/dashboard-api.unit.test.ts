/**
 * `normalizeDashboardStats` is the only thing between a brand-new endpoint and
 * four headline tiles, so it is tested for the failure modes that would show a
 * user `NaN` or crash the dashboard: absent keys, nulls, strings, and non-arrays.
 */
import { describe, expect, it } from "vitest";
import { normalizeDashboardStats } from "@/lib/dashboard-api";

const FULL_PAYLOAD = {
  totalCards: 7,
  totalContacts: 8,
  totalShareBatches: 12,
  totalRecipientsReached: 34,
  deliveryBreakdown: {
    pending: 2,
    dispatched: 18,
    delivered: 10,
    read: 4,
    failed: 0,
  },
  topContacts: [
    {
      contactId: "contact-1",
      displayName: "Rahul Sharma",
      countryCode: "+91",
      phone: "9876543210",
      timesSharedWith: 6,
      lastSharedAt: "2026-08-12T18:30:00.000Z",
    },
  ],
  topCards: [
    {
      cardId: "card-1",
      cardName: "Work card",
      cardType: "BUSINESS",
      timesShared: 8,
      recipientCount: 21,
    },
  ],
  sharesLast7Days: 3,
  sharesLast30Days: 12,
  contactsAddedLast30Days: 5,
  newCardsLast30Days: 2,
};

describe("normalizeDashboardStats", () => {
  it("passes a well-formed payload through unchanged", () => {
    expect(normalizeDashboardStats(FULL_PAYLOAD)).toEqual(FULL_PAYLOAD);
  });

  it("returns zeros and empty lists for an empty response", () => {
    const stats = normalizeDashboardStats({});

    expect(stats.totalCards).toBe(0);
    expect(stats.totalRecipientsReached).toBe(0);
    expect(stats.deliveryBreakdown).toEqual({
      pending: 0,
      dispatched: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    });
    expect(stats.topCards).toEqual([]);
    expect(stats.topContacts).toEqual([]);
  });

  it("survives null and non-object responses", () => {
    for (const input of [null, undefined, "nope", 42, []]) {
      const stats = normalizeDashboardStats(input);
      expect(stats.totalCards).toBe(0);
      expect(stats.topCards).toEqual([]);
    }
  });

  it("never yields NaN from junk numbers", () => {
    const stats = normalizeDashboardStats({
      totalCards: null,
      totalContacts: "not a number",
      totalShareBatches: Number.NaN,
      totalRecipientsReached: Number.POSITIVE_INFINITY,
      sharesLast7Days: -5,
    });

    expect(stats.totalCards).toBe(0);
    expect(stats.totalContacts).toBe(0);
    expect(stats.totalShareBatches).toBe(0);
    expect(stats.totalRecipientsReached).toBe(0);
    // A negative count is meaningless here, so it floors at zero rather than
    // rendering "-5 cards".
    expect(stats.sharesLast7Days).toBe(0);
  });

  it("coerces numeric strings and rounds fractions", () => {
    const stats = normalizeDashboardStats({
      totalCards: "7",
      totalContacts: 8.4,
      deliveryBreakdown: { read: "4" },
    });

    expect(stats.totalCards).toBe(7);
    expect(stats.totalContacts).toBe(8);
    expect(stats.deliveryBreakdown.read).toBe(4);
  });

  it("drops non-array top lists instead of throwing on .map", () => {
    const stats = normalizeDashboardStats({
      topCards: { nope: true },
      topContacts: "nope",
    });

    expect(stats.topCards).toEqual([]);
    expect(stats.topContacts).toEqual([]);
  });

  it("falls back to the number when a contact has no display name", () => {
    const stats = normalizeDashboardStats({
      topContacts: [{ countryCode: "+91", phone: "9876543210" }],
    });

    expect(stats.topContacts[0]).toEqual({
      contactId: null,
      displayName: "+91 9876543210",
      countryCode: "+91",
      phone: "9876543210",
      timesSharedWith: 0,
      lastSharedAt: "",
    });
  });

  it("labels a nameless card rather than rendering a blank row", () => {
    const stats = normalizeDashboardStats({
      topCards: [{ cardId: null, cardName: "   ", timesShared: 3 }],
    });

    expect(stats.topCards[0].cardName).toBe("Untitled card");
    expect(stats.topCards[0].cardId).toBeNull();
  });

  it("keeps a deleted card's null id distinguishable from a real one", () => {
    const stats = normalizeDashboardStats({
      topCards: [
        { cardId: "card-1", cardName: "Live" },
        { cardId: null, cardName: "Gone" },
      ],
    });

    expect(stats.topCards.map((card) => card.cardId)).toEqual(["card-1", null]);
  });
});
