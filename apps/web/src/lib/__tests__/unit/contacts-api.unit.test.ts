import { describe, expect, it } from "vitest";
import {
  contactMatchesSource,
  googleSummaryHasConnection,
  icloudSummaryHasConnection,
  normalizeContactListResponse,
  normalizeImportSummary,
} from "@/lib/contacts-api";
import type { ContactDetail, ContactImportSummary } from "@/lib/types";

describe("normalizeContactListResponse", () => {
  it("returns empty shell for non-objects", () => {
    expect(normalizeContactListResponse(null, 2, 10)).toEqual({
      items: [],
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 1,
    });
  });

  it("accepts contacts or items arrays", () => {
    const withContacts = normalizeContactListResponse(
      { contacts: [{ id: "1" }], total: 1, totalPages: 1, limit: 25 },
      1,
      25,
    );
    expect(withContacts.items).toHaveLength(1);
    expect(withContacts.page).toBe(1);

    const withItems = normalizeContactListResponse(
      { items: [{ id: "2" }, { id: "3" }], total: 2 },
      1,
      25,
    );
    expect(withItems.items).toHaveLength(2);
    expect(withItems.totalPages).toBe(1);
  });
});

describe("normalizeImportSummary", () => {
  it("passes through bySource shape", () => {
    const raw = {
      totalActive: 3,
      totalDeleted: 1,
      bySource: [
        {
          source: "GOOGLE",
          activeCount: 3,
          deletedCount: 1,
          lastSyncAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    expect(normalizeImportSummary(raw)).toEqual(raw);
  });

  it("normalizes sources array docs shape", () => {
    const summary = normalizeImportSummary({
      sources: [{ source: "ICLOUD", count: 5, lastSyncAt: null }],
    });
    expect(summary.totalActive).toBe(5);
    expect(summary.bySource[0]?.source).toBe("ICLOUD");
  });

  it("normalizes flat GOOGLE/ICLOUD keys", () => {
    const summary = normalizeImportSummary({
      GOOGLE: { total: 2, hasSyncToken: true, lastSyncAt: "t" },
      VCARD: { activeCount: 1, deletedCount: 0 },
    });
    expect(summary.totalActive).toBe(3);
    expect(googleSummaryHasConnection(summary)).toBe(true);
  });
});

describe("contact source helpers", () => {
  it("matches primary source or providerLinks", () => {
    const contact = {
      source: "CONTACTBOOK",
      providerLinks: [{ source: "GOOGLE" }],
    } as ContactDetail;
    expect(contactMatchesSource(contact, "GOOGLE")).toBe(true);
    expect(contactMatchesSource(contact, "ICLOUD")).toBe(false);
  });

  it("detects icloud connection from activeCount", () => {
    const summary: ContactImportSummary = {
      totalActive: 1,
      totalDeleted: 0,
      bySource: [
        {
          source: "ICLOUD",
          activeCount: 1,
          deletedCount: 0,
          lastSyncAt: null,
        },
      ],
    };
    expect(icloudSummaryHasConnection(summary)).toBe(true);
    expect(icloudSummaryHasConnection(null)).toBe(false);
  });
});
