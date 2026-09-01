/**
 * The API↔domain mappers, and the two conversions the sign-in flow depends on.
 *
 * These are pure functions over plain objects, which is exactly why they are worth testing at
 * this level: every one of them encodes a decision about a place where the API and the UI
 * disagree, and a silent regression in any of them shows up three screens away as a card under
 * the wrong heading or a monogram reading "U".
 */

import { describe, expect, it } from "vitest";

import { appearanceForKind, toApiCardKind, toCardType, toUser } from "@/lib/api/map";
import { toAppearanceDto } from "@/lib/api/card-appearance";
import { dialPrefixOf, toE164 } from "@/lib/countries";
import { API_CARD_KINDS, type MeResponseDto } from "@/lib/api/schema";

function meResponse(overrides: Partial<MeResponseDto["identity"]> = {}, completed = true): MeResponseDto {
  return {
    onboardingCompleted: completed,
    identity: {
      firstName: "Priyanka",
      lastName: "Raghunathan",
      primaryPhone: "+919820115577",
      primaryEmail: "priyanka@fernwood.example",
      profilePhoto: "/portraits/priyanka.png",
      ...overrides,
    },
    personal: [],
    work: [],
    business: [],
    socials: [],
    financial: [],
  };
}

describe("toUser", () => {
  it("maps the identity block onto the domain user", () => {
    const user = toUser(meResponse(), "user_abc");

    expect(user).toEqual({
      id: "user_abc",
      email: "priyanka@fernwood.example",
      phone: "+919820115577",
      countryCode: "+91",
      firstName: "Priyanka",
      lastName: "Raghunathan",
      isActive: true,
      onboardingCompleted: true,
      avatarUrl: "/portraits/priyanka.png",
    });
  });

  it("collapses a null name to an empty string, never a placeholder", () => {
    // A user exists from the moment their phone is verified — before they have given a name.
    // The avatar's monogram derives from these, so "Unknown" would render a confident "U".
    const user = toUser(meResponse({ firstName: null, lastName: null }), "u1");
    expect(user.firstName).toBe("");
    expect(user.lastName).toBe("");
  });

  it("keeps a null email and a null photo null — E-19 draws the monogram off the latter", () => {
    const user = toUser(meResponse({ primaryEmail: null, profilePhoto: null }), "u1");
    expect(user.email).toBeNull();
    expect(user.avatarUrl).toBeNull();
  });

  it("carries onboardingCompleted through, because the (app) gate reads it", () => {
    expect(toUser(meResponse({}, false), "u1").onboardingCompleted).toBe(false);
  });

  it("derives the dial prefix from the number, and yields empty for an unknown one", () => {
    expect(toUser(meResponse({ primaryPhone: "+442071234567" }), "u1").countryCode).toBe("+44");
    expect(toUser(meResponse({ primaryPhone: "+99900011122" }), "u1").countryCode).toBe("");
  });
});

describe("card kind ↔ card type", () => {
  it("bridges the API's WORK to the UI's BUSINESS, in both directions", () => {
    // The single most likely silent bug in this integration.
    expect(toCardType("WORK")).toBe("BUSINESS");
    expect(toApiCardKind("BUSINESS")).toBe("WORK");
  });

  it("passes the three names that already agree straight through", () => {
    expect(toCardType("PERSONAL")).toBe("PERSONAL");
    expect(toCardType("PAYMENT")).toBe("PAYMENT");
    expect(toCardType("CUSTOM")).toBe("CUSTOM");
  });

  it("round-trips every kind the API defines", () => {
    for (const kind of API_CARD_KINDS) {
      expect(toApiCardKind(toCardType(kind))).toBe(kind);
    }
  });
});

describe("appearanceForKind", () => {
  it("gives every kind a template, so no card can render without one", () => {
    for (const kind of API_CARD_KINDS) {
      expect(appearanceForKind(kind).templateId).toMatch(/^(meridian|marigold)$/);
    }
  });

  it("leaves the palette undefined where the template's own default is already right", () => {
    // `undefined` means "whatever this template defaults to", so these two keep tracking the
    // template rather than pinning a colour that would then need updating in two places.
    expect(appearanceForKind("WORK").paletteId).toBeUndefined();
    expect(appearanceForKind("PERSONAL").paletteId).toBeUndefined();
  });

  it("pins a distinct palette where two kinds share a template", () => {
    // PAYMENT shares Meridian with WORK, and CUSTOM shares Marigold with PERSONAL. Without a
    // distinct colour each pair is indistinguishable at thumbnail size, which is where cards
    // are actually picked.
    expect(appearanceForKind("PAYMENT")).toEqual({ templateId: "meridian", paletteId: "onyx" });
    expect(appearanceForKind("CUSTOM")).toEqual({ templateId: "marigold", paletteId: "pistachio" });
    expect(appearanceForKind("PAYMENT").templateId).toBe(appearanceForKind("WORK").templateId);
    expect(appearanceForKind("PAYMENT").paletteId).not.toBe(appearanceForKind("WORK").paletteId);
  });
});

describe("publicUrl", () => {
  it("passes the API's URL through verbatim, assembling nothing", () => {
    // The whole point of the column: the frontend used to guess `${SITE_URL}/c/${slug}` against
    // a slug that never existed, and shipped a QR that 404s. Any transformation here — a
    // re-based origin, a normalised path — reintroduces exactly that class of bug.
    const url = "https://cards.contactbook.app/c/4f8Kq2mR7xJp1sN0vLtQ9a";
    expect(toContactCard(apiCard({ publicUrl: url }), "user-1").publicUrl).toBe(url);
  });
});

describe("E.164 conversion", () => {
  it("joins the dial code and the digits with no separator", () => {
    // The API wants strict E.164. One stray space is the difference between a delivered OTP
    // and a 400, which is why this is not the same function as `dialledNumber`.
    expect(toE164("IN", "9820115577")).toBe("+919820115577");
  });

  it("strips whatever a paste brought with it", () => {
    expect(toE164("US", "(415) 555-0132")).toBe("+14155550132");
  });

  it("drops the national trunk zero, which is not part of an E.164 number", () => {
    // People type the number the way they dial it at home. London's 020 7123 4567 is
    // +442071234567 — keeping that zero produces a number the API rejects, and a rejected
    // sign-in is indistinguishable from a broken one.
    expect(toE164("GB", "020 7123 4567")).toBe("+442071234567");
    expect(toE164("DE", "030 12345678")).toBe("+493012345678");
    expect(toE164("IN", "09820115577")).toBe("+919820115577");
  });

  it("leaves a number that never had a trunk prefix alone", () => {
    expect(toE164("SG", "81234567")).toBe("+6581234567");
    expect(toE164("US", "4155550132")).toBe("+14155550132");
  });

  it("yields a bare number for an unknown country rather than throwing", () => {
    expect(toE164("ZZ", "12345")).toBe("12345");
  });

  it("recovers the longest matching prefix, so shared codes are unambiguous", () => {
    // +1 belongs to both the US and Canada. `dialPrefixOf` returns the prefix, not a country,
    // which is precisely why that ambiguity cannot produce a wrong answer here.
    expect(dialPrefixOf("+14155550132")).toBe("+1");
    expect(dialPrefixOf("+971502334455")).toBe("+971");
    expect(dialPrefixOf("+919820115577")).toBe("+91");
    expect(dialPrefixOf("not-a-number")).toBe("");
  });
});

/* ── toProfile ───────────────────────────────────────────────────────────────────────── */

import {
  categoryOfSyntheticGroup,
  isSensitiveType,
  isSyntheticGroupId,
  syntheticGroupId,
  toProfile,
} from "@/lib/api/map";
import type {
  ApiFieldCategory,
  ApiFieldType,
  ProfileFieldGroupResponseDto,
  ProfileFieldResponseDto,
} from "@/lib/api/schema";

let seq = 0;

function apiField(
  over: Partial<ProfileFieldResponseDto> & { category: ApiFieldCategory; type: ApiFieldType },
): ProfileFieldResponseDto {
  seq += 1;
  return {
    id: `f${seq}`,
    label: `Field ${seq}`,
    value: `value ${seq}`,
    position: seq,
    groupId: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

function apiGroup(over: Partial<ProfileFieldGroupResponseDto> = {}): ProfileFieldGroupResponseDto {
  return {
    id: "g1",
    category: "WORK",
    tag: "Kestrel Telecom",
    position: 0,
    // Never read by `toProfile` — the flat field list is authoritative about membership.
    fields: [],
    ...over,
  };
}

describe("synthetic group ids", () => {
  it("round-trips a category, and rejects a real id", () => {
    for (const category of ["IDENTITY", "PERSONAL", "CUSTOM", "WORK"] as const) {
      const id = syntheticGroupId(category);
      expect(isSyntheticGroupId(id)).toBe(true);
      expect(categoryOfSyntheticGroup(id)).toBe(category);
    }
    // A real group id from the API must never be mistaken for one, or a write aimed at it
    // would be sent as "ungrouped" and silently detach the field from its job.
    expect(isSyntheticGroupId("clx8f2n0a0001")).toBe(false);
    expect(categoryOfSyntheticGroup("clx8f2n0a0001")).toBeNull();
  });

  it("returns null for a prefixed id whose category is not real", () => {
    expect(categoryOfSyntheticGroup("category:NONSENSE")).toBeNull();
  });
});

describe("isSensitiveType", () => {
  it("covers exactly the three types the API encrypts at rest", () => {
    expect(isSensitiveType("BANK_ACCOUNT")).toBe(true);
    expect(isSensitiveType("DIGITAL_WALLET")).toBe(true);
    expect(isSensitiveType("CRYPTO_WALLET")).toBe(true);
  });

  it("leaves everything else unmasked, including an address", () => {
    // The cost of deriving rather than storing: a home address the owner wants masked has
    // nowhere to record that. Pinned so the trade-off is visible rather than assumed.
    expect(isSensitiveType("ADDRESS")).toBe(false);
    expect(isSensitiveType("PHONE")).toBe(false);
    expect(isSensitiveType("EMAIL")).toBe(false);
  });
});

describe("toProfile", () => {
  it("turns an API group into a domain group, using its tag as the name", () => {
    const { groups } = toProfile(
      [apiField({ category: "WORK", type: "JOB_TITLE", groupId: "g1" })],
      [apiGroup()],
      "u1",
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: "g1",
      userId: "u1",
      category: "WORK",
      name: "Kestrel Telecom",
    });
  });

  it("falls back to the category name when a group has no tag", () => {
    // `tag` is nullable upstream, and an unnamed section reads as a bug.
    const { groups } = toProfile(
      [apiField({ category: "WORK", type: "COMPANY", groupId: "g1" })],
      [apiGroup({ tag: null })],
      "u1",
    );
    expect(groups[0]?.name).toBe("Work");
  });

  it("invents one group per category for ungrouped fields", () => {
    // PERSONAL, IDENTITY and CUSTOM are ungrouped upstream and would otherwise have nowhere
    // to render, because a domain field's groupId is required.
    const { groups, fields } = toProfile(
      [
        apiField({ category: "PERSONAL", type: "PHONE" }),
        apiField({ category: "PERSONAL", type: "EMAIL" }),
        apiField({ category: "CUSTOM", type: "TEXT" }),
      ],
      [],
      "u1",
    );

    expect(groups.map((g) => g.id)).toEqual([
      syntheticGroupId("PERSONAL"),
      syntheticGroupId("CUSTOM"),
    ]);
    expect(groups[0]?.fieldIds).toHaveLength(2);
    expect(fields.every((f) => isSyntheticGroupId(f.groupId))).toBe(true);
  });

  it("keeps several groups in one category — two jobs are two groups", () => {
    // The single biggest difference from the fixture model, where a group *was* a category.
    const { groups } = toProfile(
      [
        apiField({ category: "WORK", type: "COMPANY", groupId: "g1" }),
        apiField({ category: "WORK", type: "COMPANY", groupId: "g2" }),
      ],
      [
        apiGroup({ id: "g1", tag: "Kestrel", position: 0 }),
        apiGroup({ id: "g2", tag: "Hinoki", position: 1 }),
      ],
      "u1",
    );

    expect(groups.map((g) => g.name)).toEqual(["Kestrel", "Hinoki"]);
  });

  it("orders groups by FieldCategory declaration order, then by position", () => {
    // `types/domain.ts` says the declaration order is load-bearing: it is the primary sort of
    // the §6.4 rule that makes a card and its .vcf byte-stable.
    const { groups } = toProfile(
      [
        apiField({ category: "FINANCIAL", type: "BANK_ACCOUNT", groupId: "fin" }),
        apiField({ category: "PERSONAL", type: "PHONE" }),
        apiField({ category: "SOCIAL", type: "SOCIAL_LINK", groupId: "soc" }),
        apiField({ category: "WORK", type: "COMPANY", groupId: "w2" }),
        apiField({ category: "WORK", type: "COMPANY", groupId: "w1" }),
      ],
      [
        apiGroup({ id: "fin", category: "FINANCIAL", tag: "HDFC", position: 0 }),
        apiGroup({ id: "soc", category: "SOCIAL", tag: "LinkedIn", position: 0 }),
        apiGroup({ id: "w2", category: "WORK", tag: "Second job", position: 1 }),
        apiGroup({ id: "w1", category: "WORK", tag: "First job", position: 0 }),
      ],
      "u1",
    );

    expect(groups.map((g) => g.category)).toEqual([
      "PERSONAL",
      "WORK",
      "WORK",
      "SOCIAL",
      "FINANCIAL",
    ]);
    // Within WORK, the API's own position decides.
    expect(groups.filter((g) => g.category === "WORK").map((g) => g.name)).toEqual([
      "First job",
      "Second job",
    ]);
  });

  it("sorts a synthetic section ahead of the named groups in its category", () => {
    // The plain fields of a category read as the category's own, before any named instance.
    const { groups } = toProfile(
      [
        apiField({ category: "WORK", type: "COMPANY", groupId: "g1" }),
        apiField({ category: "WORK", type: "FAX" }),
      ],
      [apiGroup({ id: "g1", tag: "Kestrel", position: 0 })],
      "u1",
    );

    expect(groups.map((g) => g.id)).toEqual([syntheticGroupId("WORK"), "g1"]);
  });

  it("orders fields inside a group by position, not by arrival", () => {
    const { groups } = toProfile(
      [
        { ...apiField({ category: "WORK", type: "EMAIL", groupId: "g1" }), id: "late", position: 9 },
        { ...apiField({ category: "WORK", type: "PHONE", groupId: "g1" }), id: "early", position: 1 },
      ],
      [apiGroup()],
      "u1",
    );

    expect(groups[0]?.fieldIds).toEqual(["early", "late"]);
  });

  it("rehomes a field whose group was not returned, rather than dropping it", () => {
    // An archived group is excluded from `GET /profile/groups` but its fields can still come
    // back from `GET /profile/fields`. Losing them silently would look like data loss.
    const { groups, fields } = toProfile(
      [apiField({ category: "BUSINESS", type: "REG_NUMBER", groupId: "archived" })],
      [],
      "u1",
    );

    expect(fields).toHaveLength(1);
    expect(fields[0]?.groupId).toBe(syntheticGroupId("BUSINESS"));
    expect(groups.map((g) => g.id)).toEqual([syntheticGroupId("BUSINESS")]);
  });

  it("derives isSensitive and never invents a detail object", () => {
    const { fields } = toProfile(
      [
        apiField({ category: "FINANCIAL", type: "BANK_ACCOUNT", groupId: "g1" }),
        apiField({ category: "PERSONAL", type: "ADDRESS" }),
      ],
      [apiGroup({ id: "g1", category: "FINANCIAL", tag: "HDFC" })],
      "u1",
    );

    const bank = fields.find((f) => f.type === "BANK_ACCOUNT");
    const address = fields.find((f) => f.type === "ADDRESS");

    expect(bank?.isSensitive).toBe(true);
    expect(address?.isSensitive).toBe(false);
    // ask #3: the API returns a scalar `value`, so the structured payload cannot be rebuilt.
    // Renderers already fall back to `field.value`, so this degrades rather than breaking.
    expect(bank?.detail).toBeUndefined();
    expect(address?.detail).toBeUndefined();
  });

  it("returns nothing for an empty profile, without inventing a section", () => {
    expect(toProfile([], [], "u1")).toEqual({ groups: [], fields: [] });
  });

  it("keeps an empty API group, so its section can offer 'Add field' (E-08)", () => {
    // A job with no fields yet is still a job. Dropping it would leave the owner no way in.
    const { groups, fields } = toProfile([], [apiGroup()], "u1");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.fieldIds).toEqual([]);
    expect(fields).toEqual([]);
  });
});

/* ── toContactCard ───────────────────────────────────────────────────────────────────── */

import { toCardFieldEntries, toContactCard } from "@/lib/api/map";
import type { CardFieldResponseDto, CardResponseDto } from "@/lib/api/schema";

function cardField(over: Partial<CardFieldResponseDto> = {}): CardFieldResponseDto {
  return {
    fieldId: "f1",
    category: "WORK",
    type: "PHONE",
    label: "Work phone",
    value: "+919820000001",
    visible: true,
    position: 0,
    ...over,
  };
}

function apiCard(over: Partial<CardResponseDto> = {}): CardResponseDto {
  return {
    id: "card1",
    name: "Work",
    kind: "WORK",
    publicUrl: "https://card.example/c/0000000000000000card1",
    fields: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    ...over,
  };
}

describe("toContactCard", () => {
  it("bridges kind to type and fills the properties the API has no column for", () => {
    const card = toContactCard(apiCard(), "u1");

    expect(card.type).toBe("BUSINESS");
    // Derived, not stored — ask #2. `WORK` tracks its template's default palette.
    expect(card.templateId).toBe("meridian");
    expect(card.paletteId).toBeUndefined();
    // Straight through from the API — nothing is assembled on this side any more.
    expect(card.publicUrl).toBe("https://card.example/c/0000000000000000card1");
    expect(card.userId).toBe("u1");
  });

  it("keeps field order by position, not by arrival", () => {
    const card = toContactCard(
      apiCard({
        fields: [
          cardField({ fieldId: "late", position: 9 }),
          cardField({ fieldId: "early", position: 1 }),
        ],
      }),
      "u1",
    );
    expect(card.fieldIds).toEqual(["early", "late"]);
  });

  it("folds an invisible field into 'not on the card', keeping the survivors ordered", () => {
    // `visible: false` soft-hides upstream, but the builder has no such state — a field is
    // ticked or it is not. Ordering happens before the drop so the survivors stay in sequence.
    const card = toContactCard(
      apiCard({
        fields: [
          cardField({ fieldId: "a", position: 0 }),
          cardField({ fieldId: "hidden", position: 1, visible: false }),
          cardField({ fieldId: "c", position: 2 }),
        ],
      }),
      "u1",
    );
    expect(card.fieldIds).toEqual(["a", "c"]);
  });

  it("derives isSensitive from the payment types actually on the card", () => {
    const plain = toContactCard(apiCard({ fields: [cardField({ type: "PHONE" })] }), "u1");
    expect(plain.isSensitive).toBe(false);

    const paying = toContactCard(
      apiCard({ fields: [cardField({ type: "BANK_ACCOUNT", category: "FINANCIAL" })] }),
      "u1",
    );
    expect(paying.isSensitive).toBe(true);
  });

  it("does not count a hidden payment field as making the card sensitive", () => {
    // It is not on the card, so it is not being shared.
    const card = toContactCard(
      apiCard({ fields: [cardField({ type: "CRYPTO_WALLET", visible: false })] }),
      "u1",
    );
    expect(card.isSensitive).toBe(false);
  });

  it("gives PAYMENT and CUSTOM their own palette, so they differ from the kind they share a template with", () => {
    expect(toContactCard(apiCard({ kind: "PAYMENT" }), "u1").paletteId).toBe("onyx");
    expect(toContactCard(apiCard({ kind: "CUSTOM" }), "u1").paletteId).toBe("pistachio");
    expect(toContactCard(apiCard({ kind: "PERSONAL" }), "u1").templateId).toBe("marigold");
  });

  it("yields an empty card for one with no fields, rather than failing", () => {
    // A freshly created card has none — `POST /cards` starts empty by design.
    expect(toContactCard(apiCard(), "u1").fieldIds).toEqual([]);
  });
});

describe("toCardFieldEntries", () => {
  it("sends every id as visible, in the order given", () => {
    // `PUT /cards/{id}/fields` REPLACES the set, so the order given is the order stored.
    expect(toCardFieldEntries(["b", "a"])).toEqual([
      { fieldId: "b", visible: true },
      { fieldId: "a", visible: true },
    ]);
  });

  it("never sends a labelOverride", () => {
    // A per-card label would be a second, competing answer to "what is this row called" — the
    // builder edits the field's own label through the profile endpoints instead.
    for (const entry of toCardFieldEntries(["a"])) {
      expect(entry).not.toHaveProperty("labelOverride");
    }
  });

  it("maps an empty set to an empty set, which is how a card is emptied", () => {
    expect(toCardFieldEntries([])).toEqual([]);
  });
});

/**
 * The design round trip — **the bug this whole integration closes**.
 *
 * An owner built a blue card, saved it, and got back a golden one. Two causes, both now gone:
 * the design was never sent, and the reader re-derived a look from `kind` because there was no
 * column to read. These pin both directions of the loop that replaced it.
 */
describe("card appearance — out on save, back on read", () => {
  const DESIGN = {
    templateId: "marigold",
    paletteId: "emerald",
    groundHex: "#1B4F72",
    finish: "flat",
    texture: "grid",
    texturePresence: "subtle",
    textureScale: "fine",
  } as const;

  const cardDto = (over: Record<string, unknown> = {}) => ({
    id: "80d70484-ab6c-41b6-96fa-fbcb0cfe5513",
    name: "Untitled card",
    kind: "WORK" as const,
    publicUrl: "https://card.example/c/4f8Kq2mR7xJp1sN0vLtQ9a",
    fields: [],
    createdAt: "2026-08-26T16:44:06.146Z",
    updatedAt: "2026-08-27T07:03:46.292Z",
    ...over,
  });

  it("sends every axis, including the nulls that unmake a choice", () => {
    // ⚠ `groundHex: null` is the point. PATCH leaves an omitted column alone, so a cleared
    // custom colour must be sent as null or it comes back on the next read.
    expect(toAppearanceDto({ templateId: "meridian", paletteId: "onyx" })).toEqual({
      templateId: "meridian",
      paletteId: "onyx",
      groundHex: null,
      finish: null,
      texture: null,
      texturePresence: null,
      textureScale: null,
    });
  });

  it("reads a saved design back instead of deriving one from kind", () => {
    const card = toContactCard(cardDto(DESIGN), "user-1");

    expect(card).toMatchObject(DESIGN);
    // WORK would have derived meridian + sapphire. It did not.
    expect(card.templateId).not.toBe(appearanceForKind("WORK").templateId);
  });

  it("survives the round trip byte for byte", () => {
    // What the builder would send, fed back as what the API would return.
    const sent = toAppearanceDto({ ...DESIGN });
    const card = toContactCard(cardDto(sent), "user-1");

    expect(toAppearanceDto(card)).toEqual(sent);
  });

  it("falls back to the kind's look when every axis is null", () => {
    // The exact response staging returns for a card that never chose.
    const card = toContactCard(
      cardDto({
        templateId: null, paletteId: null, groundHex: null,
        finish: null, texture: null, texturePresence: null, textureScale: null,
      }),
      "user-1",
    );

    const owner = appearanceForKind("WORK");
    expect(card.templateId).toBe(owner.templateId);
    expect(card.paletteId).toBe(owner.paletteId);
    expect(card.groundHex).toBeUndefined();
  });

  it("keeps the axes independent — one choice does not reset the others", () => {
    const card = toContactCard(cardDto({ paletteId: "oxblood" }), "user-1");

    expect(card.paletteId).toBe("oxblood");
    // Untouched axes still come from the kind, not from a global default.
    expect(card.templateId).toBe(appearanceForKind("WORK").templateId);
  });

  it("drops a value the API stored but this build cannot read", () => {
    // Five of the seven columns are unvalidated text server-side, so the wire can carry
    // anything. An unknown id reaching `resolveCard` throws — so it is stopped here.
    const card = toContactCard(
      cardDto({ paletteId: "chartreuse", finish: "glossy", texture: "grid" }),
      "user-1",
    );

    expect(card.paletteId).toBe(appearanceForKind("WORK").paletteId);
    expect(card.finish).toBeUndefined();
    // The axes that were valid are untouched.
    expect(card.texture).toBe("grid");
  });
});
