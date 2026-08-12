import { describe, expect, it } from "vitest";
import {
  defaultSelectionFor,
  listCardPresets,
  resolvePresetFields,
  toCardPreset,
} from "@/lib/card-presets";
import type { ShareableFieldType } from "@/lib/card-share-types";
import type { ContactCard, ContactCardType, ProfileMeResponse } from "@/lib/types";

/**
 * Personal group is well filled, work group is partly filled — so the two
 * universes produce different fallbacks and the empty-row cases are real.
 */
const profile = {
  identity: {
    firstName: "Aayush",
    lastName: "Sharma",
    primaryPhone: "+919347243575",
    primaryEmail: "as@example.com",
    profilePhoto: "https://cdn.example.com/me.png",
  },
  personal: {
    groupId: "personal-1",
    tag: "Personal",
    mobile: "+919347243575",
    landline: null,
    email: "as@example.com",
    dateOfBirth: "1998-04-02",
    postalAddress: {
      street: "12 MG Road",
      city: "Bengaluru",
      state: "KA",
      pincode: "560001",
      country: "IN",
    },
  },
  work: [
    {
      groupId: "work-1",
      tag: "Work",
      companyName: "Shava",
      companyLogo: "https://cdn.example.com/logo.png",
      workTitle: "Engineer",
      workEmail: "aayush@shava.ai",
      workMobile: "+919000000000",
    },
  ],
  business: [],
  socials: [
    {
      groupId: "social-1",
      tag: "Social",
      twitter: "https://x.com/aayush",
      facebook: "",
    },
  ],
  financial: { bankAccounts: [], digitalWallets: [], cryptoWallets: [] },
} as unknown as ProfileMeResponse;

function makeCard(overrides: Partial<ContactCard> = {}): ContactCard {
  return {
    id: "card-1",
    userId: "user-1",
    name: "Work card",
    type: "BUSINESS",
    isSensitive: false,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function presetFor(
  type: ContactCardType,
  offers: ShareableFieldType[],
): ReturnType<typeof toCardPreset> {
  return toCardPreset(makeCard({ type, mappedFieldIds: ["f1"] }), offers, profile);
}

describe("toCardPreset — offers", () => {
  it("honours a saved selection instead of guessing from the profile", () => {
    const preset = toCardPreset(
      makeCard({ type: "PERSONAL" }),
      ["EMAIL", "PHONE"],
      profile,
    );
    expect(preset.offers).toEqual(["PHONE", "EMAIL"]);
  });

  it("returns offers in canonical SHAREABLE_FIELD_TYPES order", () => {
    const preset = toCardPreset(
      makeCard({ type: "PERSONAL" }),
      ["DATE", "PHOTO", "PHONE", "ADDRESS"],
      profile,
    );
    expect(preset.offers).toEqual(["PHONE", "ADDRESS", "PHOTO", "DATE"]);
  });

  it("falls back to the profile-backed types when no selection was saved", () => {
    const preset = toCardPreset(makeCard({ type: "PERSONAL" }), undefined, profile);
    // Landline, website and the unfilled socials hold no value, so they are out.
    expect(preset.offers).toEqual([
      "PHONE",
      "EMAIL",
      "ADDRESS",
      "SOCIAL_LINK",
      "PHOTO",
      "DATE",
    ]);
  });

  it("treats an empty saved selection as 'everything', not as 'nothing'", () => {
    const preset = toCardPreset(makeCard({ type: "PERSONAL" }), [], profile);
    expect(preset.offers.length).toBeGreaterThan(0);
    expect(preset.offers).toEqual(
      toCardPreset(makeCard({ type: "PERSONAL" }), undefined, profile).offers,
    );
  });

  it("derives a work card's fallback from the work group, not the personal one", () => {
    const preset = toCardPreset(makeCard({ type: "BUSINESS" }), undefined, profile);
    expect(preset.offers).toEqual(["PHONE", "EMAIL", "PHOTO", "JOB_TITLE", "COMPANY"]);
    // Department has no write path and the work group has no birthday.
    expect(preset.offers).not.toContain("DEPARTMENT");
    expect(preset.offers).not.toContain("DATE");
  });

  it("drops unknown types left behind by an older build", () => {
    const stored = ["PHONE", "MIDDLE_NAME"] as unknown as ShareableFieldType[];
    const preset = toCardPreset(makeCard({ type: "PERSONAL" }), stored, profile);
    expect(preset.offers).toEqual(["PHONE"]);
  });

  it("drops saved types the card's own type cannot supply", () => {
    const preset = toCardPreset(
      makeCard({ type: "BUSINESS" }),
      ["COMPANY", "DATE", "SOCIAL_LINK"],
      profile,
    );
    expect(preset.offers).toEqual(["COMPANY"]);
  });

  it("offers nothing when the profile is empty and nothing was saved", () => {
    const preset = toCardPreset(makeCard({ type: "PERSONAL" }), undefined, null);
    expect(preset.offers).toEqual([]);
  });

  it("carries the card identity through", () => {
    const preset = toCardPreset(
      makeCard({ id: "card-9", name: "Client card", type: "CUSTOM" }),
      ["PHONE"],
      profile,
    );
    expect(preset).toMatchObject({
      cardId: "card-9",
      name: "Client card",
      type: "CUSTOM",
    });
  });
});

describe("toCardPreset — isEmpty", () => {
  it("flags a card whose server-side mapping list is empty", () => {
    const preset = toCardPreset(makeCard({ mappedFieldIds: [] }), undefined, profile);
    expect(preset.isEmpty).toBe(true);
  });

  it("does not flag a card that has mappings", () => {
    const preset = toCardPreset(
      makeCard({ mappedFieldIds: ["f1", "f2"] }),
      undefined,
      profile,
    );
    expect(preset.isEmpty).toBe(false);
  });

  it("does not flag a card whose mappings are unknown", () => {
    // `undefined` means the list endpoint omitted it — not that it is empty.
    const preset = toCardPreset(makeCard({ mappedFieldIds: undefined }), undefined, profile);
    expect(preset.isEmpty).toBe(false);
  });
});

describe("listCardPresets", () => {
  it("puts the most recently updated card first", () => {
    const cards = [
      makeCard({ id: "old", updatedAt: "2026-07-01T10:00:00.000Z" }),
      makeCard({ id: "new", updatedAt: "2026-08-09T10:00:00.000Z" }),
      makeCard({ id: "mid", updatedAt: "2026-08-01T10:00:00.000Z" }),
    ];
    expect(listCardPresets(cards, {}, profile).map((p) => p.cardId)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("keeps the incoming order for cards updated at the same instant", () => {
    const cards = [
      makeCard({ id: "a", updatedAt: "2026-08-09T10:00:00.000Z" }),
      makeCard({ id: "b", updatedAt: "2026-08-09T10:00:00.000Z" }),
      makeCard({ id: "c", updatedAt: "2026-08-09T10:00:00.000Z" }),
    ];
    expect(listCardPresets(cards, {}, profile).map((p) => p.cardId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("applies each card's own saved selection", () => {
    const cards = [
      makeCard({ id: "a", type: "PERSONAL", updatedAt: "2026-08-09T10:00:00.000Z" }),
      makeCard({ id: "b", type: "PERSONAL", updatedAt: "2026-08-08T10:00:00.000Z" }),
    ];
    const presets = listCardPresets(cards, { a: ["EMAIL"] }, profile);
    expect(presets[0]?.offers).toEqual(["EMAIL"]);
    // `b` has no saved selection, so it falls back to the profile-backed set.
    expect(presets[1]?.offers).toContain("PHONE");
  });

  it("returns an empty list when the user owns no cards", () => {
    expect(listCardPresets([], {}, profile)).toEqual([]);
  });
});

describe("resolvePresetFields", () => {
  it("splits the new card type's rows into offered and additional", () => {
    const preset = presetFor("PERSONAL", ["PHONE", "EMAIL"]);
    const { offered, additional } = resolvePresetFields(preset, "PERSONAL", profile);

    expect(offered.map((row) => row.field.key)).toEqual(["mobile", "email"]);
    expect(additional.map((row) => row.field.key)).toContain("dateOfBirth");
    expect(additional.every((row) => row.offered === false)).toBe(true);
    expect(offered.every((row) => row.offered === true)).toBe(true);
  });

  it("uses the NEW card's universe, so a personal preset cannot inject personal-only rows into a work card", () => {
    const preset = presetFor("PERSONAL", ["DATE", "SOCIAL_LINK", "EMAIL"]);
    const { offered, additional } = resolvePresetFields(preset, "BUSINESS", profile);
    const keys = [...offered, ...additional].map((row) => row.field.key);

    expect(keys).not.toContain("dateOfBirth");
    expect(keys).not.toContain("twitter");
    expect(keys).toContain("companyName");
    // Only EMAIL survives the crossing.
    expect(offered.map((row) => row.field.key)).toEqual(["workEmail"]);
  });

  it("preserves listCardProfileFields order across the split", () => {
    const preset = presetFor("BUSINESS", ["PHOTO", "COMPANY"]);
    const { offered, additional } = resolvePresetFields(preset, "BUSINESS", profile);

    expect(offered.map((row) => row.field.key)).toEqual(["companyLogo", "companyName"]);
    expect(additional.map((row) => row.field.key)).toEqual([
      "workTitle",
      "department",
      "workMobile",
      "workLandline",
      "workFax",
      "workEmail",
      "website",
      "workPostalAddress",
    ]);
  });

  it("offers nothing and lists the whole universe for a blank start", () => {
    const { offered, additional } = resolvePresetFields(null, "PERSONAL", profile);
    expect(offered).toEqual([]);
    expect(additional).toHaveLength(12);
  });

  it("marks rows with no stored value as empty", () => {
    const preset = presetFor("PERSONAL", ["PHONE", "LANDLINE"]);
    const { offered } = resolvePresetFields(preset, "PERSONAL", profile);
    const byKey = new Map(offered.map((row) => [row.field.key, row]));

    expect(byKey.get("mobile")?.isEmpty).toBe(false);
    expect(byKey.get("landline")?.isEmpty).toBe(true);
  });

  it("judges an address row by its parts, not by its (always blank) value", () => {
    const filled = resolvePresetFields(
      presetFor("PERSONAL", ["ADDRESS"]),
      "PERSONAL",
      profile,
    ).offered[0];
    expect(filled?.field.key).toBe("postalAddress");
    expect(filled?.isEmpty).toBe(false);

    // The work group has no postal address at all.
    const blank = resolvePresetFields(
      presetFor("BUSINESS", ["ADDRESS"]),
      "BUSINESS",
      profile,
    ).offered[0];
    expect(blank?.field.key).toBe("workPostalAddress");
    expect(blank?.isEmpty).toBe(true);
  });

  it("does not throw on a null profile and reports every row as empty", () => {
    const { offered, additional } = resolvePresetFields(
      presetFor("PERSONAL", ["PHONE"]),
      "PERSONAL",
      null,
    );
    expect(offered).toHaveLength(1);
    expect([...offered, ...additional].every((row) => row.isEmpty)).toBe(true);
  });
});

describe("defaultSelectionFor", () => {
  it("ticks the offered types that actually have a value", () => {
    const preset = presetFor("PERSONAL", ["PHONE", "LANDLINE", "EMAIL"]);
    expect(defaultSelectionFor(preset, "PERSONAL", profile)).toEqual(["PHONE", "EMAIL"]);
  });

  it("never repeats a type shared by several rows", () => {
    const preset = presetFor("PERSONAL", ["SOCIAL_LINK"]);
    // Six social rows, one filled — SOCIAL_LINK must appear exactly once.
    expect(defaultSelectionFor(preset, "PERSONAL", profile)).toEqual(["SOCIAL_LINK"]);
  });

  it("returns canonical order regardless of how the preset stored it", () => {
    const preset = presetFor("BUSINESS", ["COMPANY", "PHOTO", "PHONE"]);
    expect(defaultSelectionFor(preset, "BUSINESS", profile)).toEqual([
      "PHONE",
      "PHOTO",
      "COMPANY",
    ]);
  });

  it("returns nothing for a blank start", () => {
    expect(defaultSelectionFor(null, "PERSONAL", profile)).toEqual([]);
  });

  it("returns nothing when the profile has no values to tick", () => {
    expect(defaultSelectionFor(presetFor("PERSONAL", ["PHONE"]), "PERSONAL", null)).toEqual(
      [],
    );
  });
});

describe("listCardPresets ranking", () => {
  it("puts cards that carry details ahead of empty ones, however recent", () => {
    // The preselected preset is presets[0]. Ranking purely by recency picked the
    // newest card, which in practice is a just-created empty one — so the new
    // card copied nothing and its contact file held only a name.
    const emptyButNewest = makeCard({
      id: "empty-new",
      name: "Empty new",
      updatedAt: "2026-08-09T17:00:00.000Z",
      mappedFieldIds: [],
    });
    const hasDetails = makeCard({
      id: "full-old",
      name: "Full old",
      updatedAt: "2026-08-01T07:00:00.000Z",
      mappedFieldIds: ["f1", "f2", "f3"],
    });

    const presets = listCardPresets([emptyButNewest, hasDetails], {}, profile);

    expect(presets[0]?.cardId).toBe("full-old");
    expect(presets[1]?.cardId).toBe("empty-new");
  });

  it("keeps newest-first within cards that all carry details", () => {
    const older = makeCard({
      id: "older",
      updatedAt: "2026-08-01T07:00:00.000Z",
      mappedFieldIds: ["f1"],
    });
    const newer = makeCard({
      id: "newer",
      updatedAt: "2026-08-08T07:00:00.000Z",
      mappedFieldIds: ["f1"],
    });

    expect(listCardPresets([older, newer], {}, profile)[0]?.cardId).toBe("newer");
  });

  it("treats an unknown count as usable, not as empty", () => {
    // mappedFieldIds undefined means the lookup failed; demoting it would hide
    // the only card that might actually have details.
    const unknown = makeCard({ id: "unknown", updatedAt: "2026-08-09T18:00:00.000Z" });
    const empty = makeCard({
      id: "empty",
      updatedAt: "2026-08-09T19:00:00.000Z",
      mappedFieldIds: [],
    });

    expect(listCardPresets([empty, unknown], {}, profile)[0]?.cardId).toBe("unknown");
  });
});
