/**
 * The contact registry's parsing and mapping.
 *
 * Two things are worth testing at this level and nothing else here is: **number normalisation**,
 * because the API validates strict E.164 with a real phone-number library and a rejected number
 * produces a 400 the user cannot act on; and **import parsing**, because it is the one place a
 * silent data loss could hide — importing 18 of 22 lines and reporting 18 is how somebody
 * discovers four missing contacts a week later.
 */

import { describe, expect, it } from "vitest";

import { normaliseE164, parseImportLines } from "@/lib/contacts-parse";
import { groupSharesByContact, toContact } from "@/lib/api/map";
import type { ContactResponseDto, ShareLinkResponseDto } from "@/lib/api/schema";

describe("normaliseE164", () => {
  it("strips whatever a paste brought with it", () => {
    expect(normaliseE164("+91 98200 00000")).toBe("+919820000000");
    expect(normaliseE164("+1 (415) 555-0132")).toBe("+14155550132");
    expect(normaliseE164("  +44.20.7123.4567  ")).toBe("+442071234567");
  });

  it("refuses a number with no country code rather than guessing one", () => {
    // There is no country picker on this screen, so the country cannot be inferred — and
    // guessing wrong sends somebody's card to a stranger.
    expect(normaliseE164("9820000000")).toBeNull();
    expect(normaliseE164("020 7123 4567")).toBeNull();
  });

  it("refuses lengths E.164 does not allow", () => {
    expect(normaliseE164("+12345")).toBeNull(); // too short
    expect(normaliseE164(`+${"9".repeat(16)}`)).toBeNull(); // too long
    expect(normaliseE164("+")).toBeNull();
    expect(normaliseE164("")).toBeNull();
  });

  it("keeps a 15-digit number, the E.164 maximum", () => {
    expect(normaliseE164(`+${"9".repeat(15)}`)).toBe(`+${"9".repeat(15)}`);
  });
});

describe("parseImportLines", () => {
  it("reads a number and an optional name per line", () => {
    const { entries, skipped } = parseImportLines(
      "+919820000001, Arjun Balasubramanian\n+919820000002\n",
    );

    expect(skipped).toBe(0);
    expect(entries).toEqual([
      { phoneE164: "+919820000001", displayName: "Arjun Balasubramanian" },
      { phoneE164: "+919820000002", displayName: undefined },
    ]);
  });

  it("splits on the FIRST comma, so a surname containing one survives", () => {
    // "Nakamura, Mei" is a real way people write names, and splitting on every comma would
    // truncate it to "Nakamura".
    const { entries } = parseImportLines("+919820000003, Nakamura, Mei");
    expect(entries[0]?.displayName).toBe("Nakamura, Mei");
  });

  it("counts a line with no usable number as skipped, never dropping it silently", () => {
    const { entries, skipped } = parseImportLines(
      ["+919820000001, Fine", "9820000002, No country code", "not a number at all"].join("\n"),
    );

    expect(entries).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it("ignores blank lines without counting them as skipped", () => {
    // A trailing newline is not a failed import, and reporting it as one would be alarming.
    const { entries, skipped } = parseImportLines("\n\n+919820000001\n\n");
    expect(entries).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  it("deduplicates the same number, so the reported counts stay honest", () => {
    // The API upserts per entry, so a duplicate is harmless — but counting one number twice
    // would inflate "added" against what actually happened.
    const { entries } = parseImportLines("+919820000001, First\n+91 98200 00001, Again");
    expect(entries).toHaveLength(1);
  });

  it("handles CRLF, because a paste from a spreadsheet carries it", () => {
    const { entries } = parseImportLines("+919820000001, A\r\n+919820000002, B");
    expect(entries).toHaveLength(2);
    expect(entries[1]?.displayName).toBe("B");
  });

  it("returns nothing for an empty paste", () => {
    expect(parseImportLines("")).toEqual({ entries: [], skipped: 0 });
    expect(parseImportLines("   \n  ")).toEqual({ entries: [], skipped: 0 });
  });
});

describe("toContact", () => {
  const dto: ContactResponseDto = {
    id: "c1",
    phoneE164: "+919820000001",
    displayName: "Arjun",
    notes: "Met at the summit",
    source: "MANUAL",
    optedOutAt: null,
    createdAt: "2026-08-20T11:02:00.000Z",
  };

  it("adds the owner the API leaves implicit and changes nothing else", () => {
    expect(toContact(dto, "u1")).toEqual({ ...dto, ownerId: "u1" });
  });

  it("carries a null name and a null note through, rather than defaulting them", () => {
    // Both are nullable upstream and both have a rendering branch — a defaulted empty string
    // would make "no note yet" indistinguishable from an empty note.
    const bare = toContact({ ...dto, displayName: null, notes: null }, "u1");
    expect(bare.displayName).toBeNull();
    expect(bare.notes).toBeNull();
  });
});

describe("groupSharesByContact", () => {
  function link(over: Partial<ShareLinkResponseDto>): ShareLinkResponseDto {
    return {
      id: "s1",
      url: "https://example.com/c/tok",
      cardId: "card1",
      cardName: "Work",
      contactId: "c1",
      contactPhoneE164: "+919820000001",
      contactDisplayName: null,
      status: "ACTIVE",
      viewCount: 0,
      firstViewedAt: null,
      lastViewedAt: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      ...over,
    };
  }

  it("groups a flat list by the contact each link was minted for", () => {
    // `GET /share-links` returns every link across every card, so the join has to happen client
    // side — and as a Map, because the list screen needs a count per row.
    const grouped = groupSharesByContact([
      link({ id: "s1", contactId: "c1" }),
      link({ id: "s2", contactId: "c2" }),
      link({ id: "s3", contactId: "c1" }),
    ]);

    expect([...grouped.keys()].sort()).toEqual(["c1", "c2"]);
    expect(grouped.get("c1")).toHaveLength(2);
    expect(grouped.get("c2")).toHaveLength(1);
  });

  it("orders each contact's links newest first", () => {
    const grouped = groupSharesByContact([
      link({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
      link({ id: "new", createdAt: "2026-08-01T00:00:00.000Z" }),
    ]);
    expect(grouped.get("c1")?.map((s) => s.shareLinkId)).toEqual(["new", "old"]);
  });

  it("keeps a revoked link, because hiding it would make a reversible act look permanent", () => {
    // Restoring reuses the same token, so a revoked link is a state rather than a deletion.
    const grouped = groupSharesByContact([link({ status: "REVOKED" })]);
    expect(grouped.get("c1")?.[0]?.status).toBe("REVOKED");
  });

  it("returns an empty map for no links", () => {
    expect(groupSharesByContact([]).size).toBe(0);
  });
});
