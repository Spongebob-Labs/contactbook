import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { TemplateId } from "@/card/template-types";
import type { FieldCategory, FieldType } from "@/types/domain";
import { EMPTY_FIXTURE_DB, FIXTURE_DB, ALL_FIXTURE_CARDS } from "@/fixtures";
import { fixtureContacts } from "@/fixtures/contacts";
import { cardEmptyDemo, cardLedgerDemo, fixtureCards } from "@/fixtures/cards";
import {
  BROKEN_BACKGROUND_SRC,
  BROKEN_IMAGE_URL,
  cardDanglingFieldIds,
  cardManyFields,
  cardNoPhone,
  cardOneField,
  cardPhotoOverride,
  cardZeroFields,
  extremeCards,
  extremeFields,
  extremeUserBrokenAvatar,
  extremeUserLongName,
  extremeUserNoAvatar,
  LONG_COMPANY,
  LONG_JOB_TITLE,
  LONG_NAME,
  LONG_NOTE,
  PUNCTUATED_VALUE,
  UNBROKEN_TOKEN,
  XSS_VALUE,
} from "@/fixtures/extremes";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser, fixtureUserNoAvatar } from "@/fixtures/user";

/**
 * The fixture contract — spec §10.3 (the inventory), §8A.6 (payload budget), §7.3 (what may
 * never appear on a public surface) and AC-08.
 *
 * These are the only data the entire application ever reads (§3.1), so an assertion here is
 * an assertion about every screen at once. AC-08 in particular is cheap to satisfy and
 * expensive to discover late: a slug two characters too long pushes the QR symbol past
 * version 6 and the failure surfaces as an unscannable card, not as a type error.
 */

/**
 * §8A.6, transcribed. The runtime construction of `qrPayload` belongs to `resolveCard`
 * (T11); this is the same expression, evaluated here so the fixtures are provably inside
 * the budget before any card renders.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const qrPayloadFor = (slug: string): string => `${SITE_URL}/c/${slug}`;
const byteLength = (value: string): number => new TextEncoder().encode(value).length;

const PUBLIC_DIR = join(process.cwd(), "public");

const FIELD_CATEGORIES: readonly FieldCategory[] = [
  "IDENTITY",
  "PERSONAL",
  "WORK",
  "BUSINESS",
  "SOCIAL",
  "FINANCIAL",
  "CUSTOM",
];

const FIELD_TYPES: readonly FieldType[] = [
  "PHONE",
  "LANDLINE",
  "FAX",
  "EMAIL",
  "ADDRESS",
  "URL",
  "SOCIAL_LINK",
  "PHOTO",
  "TEXT",
  "DATE",
  "JOB_TITLE",
  "COMPANY",
  "REG_NUMBER",
  "DEPARTMENT",
  "RELATION",
  "STATUS",
  "LOCATION_TRACKING",
  "BANK_ACCOUNT",
  "DIGITAL_WALLET",
  "CRYPTO_WALLET",
  "CUSTOM",
];

const TEMPLATE_IDS: readonly TemplateId[] = [
  "meridian",
  "meridian",
  "meridian",
  "marigold",
  "meridian",
  "marigold",
  "marigold",
  "marigold",
];

describe("AC-08 — slug and payload budget (spec §8A.6)", () => {
  it("sweeps every fixture card, including the extremes", () => {
    // If this list ever shrinks the AC becomes vacuous, so assert the sweep is real first.
    expect(ALL_FIXTURE_CARDS.length).toBeGreaterThanOrEqual(fixtureCards.length + extremeCards.length);
  });

  it.each(ALL_FIXTURE_CARDS.map((card) => [card.id, card.slug] as const))(
    "%s — slug %s is <= 24 chars and matches /^[a-z0-9-]+$/",
    (_id, slug) => {
      expect(slug.length).toBeLessThanOrEqual(24);
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    },
  );

  it.each(ALL_FIXTURE_CARDS.map((card) => [card.id, card.slug] as const))(
    "%s — qrPayload for %s is <= 60 bytes",
    (_id, slug) => {
      expect(byteLength(qrPayloadFor(slug))).toBeLessThanOrEqual(60);
    },
  );

  it("keeps every slug unique — two cards resolving to one URL is a silent data loss", () => {
    const slugs = ALL_FIXTURE_CARDS.map((card) => card.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("carries no PII in a slug (§7.3): never the surname, never the phone digits", () => {
    const surname = fixtureUser.lastName.toLowerCase();
    const phoneDigits = fixtureUser.phone.replace(/\D/g, "");
    for (const card of ALL_FIXTURE_CARDS) {
      expect(card.slug).not.toContain(surname);
      expect(card.slug.replace(/\D/g, "")).not.toContain(phoneDigits);
    }
  });
});

describe("card ids (E-38 — /cards/new can never collide with /cards/[cardId])", () => {
  it("prefixes every card id with `card_`", () => {
    for (const card of ALL_FIXTURE_CARDS) {
      expect(card.id.startsWith("card_"), `${card.id} must start with card_`).toBe(true);
    }
  });

  it("never uses `new` as a card id", () => {
    expect(ALL_FIXTURE_CARDS.some((card) => card.id === "new")).toBe(false);
  });

  it("keeps every card id unique", () => {
    const ids = ALL_FIXTURE_CARDS.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("profile.ts (spec §10.3) — every renderer must be exercisable (AC-21)", () => {
  it("declares one FieldGroup per FieldCategory", () => {
    expect(fixtureGroups).toHaveLength(FIELD_CATEGORIES.length);
    expect(fixtureGroups.map((group) => group.category).sort()).toEqual([...FIELD_CATEGORIES].sort());
  });

  it("declares at least 25 ProfileFields", () => {
    expect(fixtureFields.length).toBeGreaterThanOrEqual(25);
  });

  it.each(FIELD_TYPES)("covers FieldType %s", (type) => {
    expect(fixtureFields.some((field) => field.type === type)).toBe(true);
  });

  it("keeps every field id unique", () => {
    const ids = fixtureFields.map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is referentially consistent: group.fieldIds <-> field.groupId, in both directions", () => {
    const fieldIds = new Set(fixtureFields.map((field) => field.id));
    const groupIds = new Set(fixtureGroups.map((group) => group.id));

    for (const group of fixtureGroups) {
      for (const id of group.fieldIds) {
        expect(fieldIds.has(id), `group ${group.id} points at missing field ${id}`).toBe(true);
      }
    }
    for (const field of fixtureFields) {
      expect(groupIds.has(field.groupId), `field ${field.id} has no group`).toBe(true);
      const owner = fixtureGroups.find((group) => group.id === field.groupId);
      expect(owner?.fieldIds.includes(field.id), `group ${field.groupId} omits ${field.id}`).toBe(
        true,
      );
    }
  });

  it("carries a blank-valued field so E-07 (never render an empty row) is reachable", () => {
    expect(fixtureFields.some((field) => field.value === "")).toBe(true);
  });
});

describe("AC-33 — the data that makes masking testable (§6.6, §7.3)", () => {
  it.each(["BANK_ACCOUNT", "DIGITAL_WALLET", "CRYPTO_WALLET"] as const)(
    "carries a %s field whose structured detail matches its type",
    (type) => {
      const field = fixtureFields.find((candidate) => candidate.type === type);
      expect(field, `no ${type} field to mask`).toBeDefined();
      expect(field?.detail?.kind).toBe(type);
      // Last-4 masking is only meaningful when there is more than 4 characters to hide.
      expect(field?.value.length).toBeGreaterThan(4);
    },
  );

  it("carries at least one isSensitive field (I-6)", () => {
    expect(fixtureFields.some((field) => field.isSensitive)).toBe(true);
  });

  it("never stores a coordinate in a LOCATION_TRACKING value (§7.3)", () => {
    const tracking = fixtureFields.filter((field) => field.type === "LOCATION_TRACKING");
    expect(tracking.length).toBeGreaterThan(0);
    for (const field of tracking) {
      expect(field.value).not.toMatch(/-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+/);
    }
  });

  it("maps a masked field onto a real card, so the public surface actually exercises it", () => {
    const financialIds = new Set(
      fixtureFields
        .filter((field) => ["BANK_ACCOUNT", "DIGITAL_WALLET", "CRYPTO_WALLET"].includes(field.type))
        .map((field) => field.id),
    );
    expect(
      fixtureCards.some((card) => card.fieldIds.some((id) => financialIds.has(id))),
      "no fixture card maps a financial field — AC-33 would be untestable on a card",
    ).toBe(true);
  });
});

describe("cards.ts (spec §10.3, §11.6)", () => {
  it("declares nine cards: one per template, plus the empty demo", () => {
    expect(fixtureCards).toHaveLength(9);
  });

  it.each(TEMPLATE_IDS)("covers template %s", (templateId) => {
    expect(fixtureCards.some((card) => card.templateId === templateId)).toBe(true);
  });

  it("keeps `card_empty_demo` as a permanent fixture with zero fieldIds (E-01/E-02)", () => {
    expect(cardEmptyDemo.id).toBe("card_empty_demo");
    expect(cardEmptyDemo.fieldIds).toEqual([]);
    expect(fixtureCards).toContain(cardEmptyDemo);
  });

  it("maps only ids that exist in the profile — cards.ts carries no accidental danglers", () => {
    const known = new Set(fixtureFields.map((field) => field.id));
    for (const card of fixtureCards) {
      for (const id of card.fieldIds) {
        expect(known.has(id), `${card.id} maps unknown field ${id}`).toBe(true);
      }
    }
  });

  it("gives `card_minimal_demo` exactly the five fields the §6.7 vCard example prints", () => {
    expect(cardLedgerDemo.slug).toBe("prya-hq");
    expect(cardLedgerDemo.fieldIds).toHaveLength(5);
    const types = cardLedgerDemo.fieldIds
      .map((id) => fixtureFields.find((field) => field.id === id)?.type)
      .sort();
    expect(types).toEqual(["COMPANY", "EMAIL", "JOB_TITLE", "PHONE", "URL"]);
  });

  it("covers every CardType so the type chip has something to render", () => {
    const types = new Set(fixtureCards.map((card) => card.type));
    expect([...types].sort()).toEqual(["BUSINESS", "CUSTOM", "PAYMENT", "PERSONAL"]);
  });
});

describe("contacts.ts (spec §10.3, E-39)", () => {
  it("declares twelve contacts", () => {
    expect(fixtureContacts).toHaveLength(8);
  });

  it("covers every ContactSource, so the registry's source filter has something to filter", () => {
    // The filter chips on `/contacts` are built from whichever sources are present, so a source
    // with no fixture is a chip nobody can look at.
    const sources = new Set(fixtureContacts.map((contact) => contact.source));
    expect([...sources].sort()).toEqual(["IMPORTED", "INBOUND", "MANUAL", "QR_SCAN"]);
  });

  it("includes a contact with no displayName — the `contactLabel` fallback needs one", () => {
    // Routine after an import, and the reason no surface reads `displayName` directly.
    expect(fixtureContacts.some((contact) => contact.displayName === null)).toBe(true);
  });

  it("includes exactly one opted-out contact — the badge needs one, more would be noise", () => {
    const optedOut = fixtureContacts.filter((contact) => contact.optedOutAt !== null);
    expect(optedOut).toHaveLength(1);
  });

  it("includes both a noted and an unnoted contact, so the notes block is seen collapsing", () => {
    expect(fixtureContacts.some((contact) => contact.notes !== null)).toBe(true);
    expect(fixtureContacts.some((contact) => contact.notes === null)).toBe(true);
  });

  it("gives every contact a parseable createdAt and a strict E.164 number", () => {
    for (const contact of fixtureContacts) {
      expect(Number.isNaN(new Date(contact.createdAt).getTime())).toBe(false);
      // Strict E.164: a leading + and digits only. The API validates exactly this, so a fixture
      // that would be rejected upstream is a fixture teaching the wrong shape.
      expect(contact.phoneE164).toMatch(/^\+[0-9]{6,15}$/);
    }
  });
});

describe("extremes.ts — the §11 hostile-content set", () => {
  it("carries 40+ character name, job title and company (E-10, E-11, E-12)", () => {
    expect(LONG_NAME.length).toBeGreaterThanOrEqual(40);
    expect(LONG_JOB_TITLE.length).toBeGreaterThanOrEqual(40);
    expect(LONG_COMPANY.length).toBeGreaterThanOrEqual(40);
  });

  it("carries a single unbroken 60+ character token (E-15)", () => {
    expect(UNBROKEN_TOKEN.length).toBeGreaterThanOrEqual(60);
    expect(UNBROKEN_TOKEN).not.toMatch(/\s/);
  });

  it("carries a value with `,` `;` and `\\` for the vCard escaping test (E-52)", () => {
    expect(PUNCTUATED_VALUE).toContain(",");
    expect(PUNCTUATED_VALUE).toContain(";");
    expect(PUNCTUATED_VALUE).toContain("\\");
  });

  it("carries a script-shaped value so E-51 proves React escaping, not sanitisation", () => {
    expect(XSS_VALUE).toContain("<script>");
  });

  it("carries a 200+ character note so the 75-octet vCard fold is exercised (E-16)", () => {
    expect(LONG_NOTE.length).toBeGreaterThanOrEqual(200);
  });

  it("carries same-origin broken media paths (E-20, E-21)", () => {
    expect(BROKEN_IMAGE_URL.startsWith("/")).toBe(true);
    expect(BROKEN_BACKGROUND_SRC.startsWith("/")).toBe(true);
  });

  it("carries the three avatar variants E-19 and E-20 need", () => {
    expect(extremeUserNoAvatar.avatarUrl).toBeNull();
    expect(extremeUserBrokenAvatar.avatarUrl).toBe(BROKEN_IMAGE_URL);
    expect(extremeUserLongName.avatarUrl).not.toBeNull();
    expect(`${extremeUserLongName.firstName} ${extremeUserLongName.lastName}`).toBe(LONG_NAME);
  });

  it("carries the field-count extremes E-01…E-04 are written against", () => {
    expect(cardZeroFields.fieldIds).toHaveLength(0);
    expect(cardOneField.fieldIds).toHaveLength(1);
    expect(cardManyFields.fieldIds.length).toBeGreaterThanOrEqual(25);
  });

  it("carries a card whose fieldIds dangle, so I-2 / E-40 is reproducible", () => {
    const known = new Set(extremeFields.map((field) => field.id));
    const dangling = cardDanglingFieldIds.fieldIds.filter((id) => !known.has(id));
    expect(dangling.length).toBeGreaterThan(0);
  });

  it("carries a card with no PHONE field at all (E-56)", () => {
    const types = cardNoPhone.fieldIds.map(
      (id) => extremeFields.find((field) => field.id === id)?.type,
    );
    expect(types).not.toContain("PHONE");
    expect(types.length).toBeGreaterThan(0);
  });

  it("carries a card mapping a PHOTO field, so the §5.3a avatar precedence is reachable", () => {
    const photo = cardPhotoOverride.fieldIds
      .map((id) => extremeFields.find((field) => field.id === id))
      .find((field) => field?.type === "PHOTO");
    expect(photo?.value).toMatch(/^\/portraits\/.+\.png$/);
  });

  it("resolves every extreme card's ids against extremeFields, except the deliberate dangler", () => {
    const known = new Set(extremeFields.map((field) => field.id));
    for (const card of extremeCards) {
      if (card.id === cardDanglingFieldIds.id) continue;
      for (const id of card.fieldIds) {
        expect(known.has(id), `${card.id} maps unknown field ${id}`).toBe(true);
      }
    }
  });
});

describe("the FixtureDb barrel (§6.3)", () => {
  it("exposes exactly the five collections the gateway selects from", () => {
    expect(Object.keys(FIXTURE_DB).sort()).toEqual([
      "cards",
      "contacts",
      "fields",
      "groups",
      "user",
    ]);
  });

  it("is frozen, collections included — a screen must not be able to mutate the source", () => {
    expect(Object.isFrozen(FIXTURE_DB)).toBe(true);
    expect(Object.isFrozen(FIXTURE_DB.cards)).toBe(true);
    expect(Object.isFrozen(FIXTURE_DB.fields)).toBe(true);
    expect(Object.isFrozen(FIXTURE_DB.cards[0])).toBe(true);
  });

  it("wires the modules together without re-deriving them", () => {
    expect(FIXTURE_DB.user).toBe(fixtureUser);
    expect(FIXTURE_DB.cards).toBe(fixtureCards);
    expect(FIXTURE_DB.fields).toBe(fixtureFields);
    expect(FIXTURE_DB.groups).toBe(fixtureGroups);
    expect(FIXTURE_DB.contacts).toBe(fixtureContacts);
  });

  it("keeps a no-avatar user variant for E-19", () => {
    expect(fixtureUserNoAvatar.avatarUrl).toBeNull();
    expect(fixtureUser.avatarUrl).not.toBeNull();
  });
});

describe("EMPTY_FIXTURE_DB — what `?state=empty` returns (§6.3)", () => {
  it("empties every collection", () => {
    expect(EMPTY_FIXTURE_DB.cards).toEqual([]);
    expect(EMPTY_FIXTURE_DB.contacts).toEqual([]);
    expect(EMPTY_FIXTURE_DB.fields).toEqual([]);
  });

  it("keeps the user, because the shell still has to render its chip", () => {
    expect(EMPTY_FIXTURE_DB.user).toBe(fixtureUser);
  });

  it("keeps the seven groups with no fields in them — that is E-08, not a missing profile", () => {
    expect(EMPTY_FIXTURE_DB.groups).toHaveLength(7);
    for (const group of EMPTY_FIXTURE_DB.groups) {
      expect(group.fieldIds).toEqual([]);
    }
  });

  it("is frozen too", () => {
    expect(Object.isFrozen(EMPTY_FIXTURE_DB)).toBe(true);
    expect(Object.isFrozen(EMPTY_FIXTURE_DB.groups)).toBe(true);
  });
});

describe("the generated portraits (plan §7 X-1 — PLACEHOLDER-ART)", () => {
  const portraits = ["priyanka.png", "arjun.png", "mei.png"];

  it.each(portraits)("%s exists under public/portraits and is a real PNG raster", (name) => {
    const path = join(PUBLIC_DIR, "portraits", name);
    expect(statSync(path).isFile()).toBe(true);

    const buffer = readFileSync(path);
    // PNG signature, then the IHDR width/height at bytes 16..24 (big-endian).
    expect([...buffer.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(buffer.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(buffer.readUInt32BE(16)).toBeGreaterThanOrEqual(320);
    expect(buffer.readUInt32BE(20)).toBeGreaterThanOrEqual(320);
  });

  it("is referenced by the fixtures rather than sitting unused", () => {
    const referenced = [
      fixtureUser.avatarUrl,
      extremeUserLongName.avatarUrl,
      ...extremeFields.filter((field) => field.type === "PHOTO").map((field) => field.value),
    ].filter((value): value is string => value !== null);

    for (const name of portraits) {
      expect(
        referenced.some((value) => value.endsWith(name)),
        `${name} is generated but nothing points at it`,
      ).toBe(true);
    }
  });
});
