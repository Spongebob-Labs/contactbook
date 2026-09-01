import { describe, expect, it } from "vitest";

import { resolveCard } from "@/card/resolve-card";
import {
  CARD_TYPE_FOR_CATEGORY,
  TEMPLATE_SEED,
  seedCardType,
  seedFieldIds,
} from "@/card/template-seed";
import { TEMPLATES, TEMPLATE_ORDER } from "@/card/templates";
import { cardLedgerDemo } from "@/fixtures/cards";
import { EMPTY_FIXTURE_DB } from "@/fixtures";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";
import type { FieldGroup, ProfileField } from "@/types/domain";

/**
 * `template-seed` — the field preset a template starts a new card with.
 *
 * The claim under test is the one the gallery caption makes out loud: Meridian "starts with
 * your work number and work email", Marigold "with your mobile and personal email". A seed
 * that does not match its blurb is worse than no seed, because the blurb is what the owner
 * read before choosing.
 *
 * Pure functions only — no DOM, no clock, no geometry (§14.6).
 */

const seed = (templateId: Parameters<typeof seedFieldIds>[0]) =>
  seedFieldIds(templateId, fixtureGroups, fixtureFields);

const fieldById = new Map(fixtureFields.map((field) => [field.id, field] as const));
const categoryOf = (id: string) => {
  const field = fieldById.get(id);
  const group = fixtureGroups.find((each) => each.id === field?.groupId);
  return group?.category;
};

describe("the presets themselves", () => {
  it("covers every template — a new one cannot ship without deciding what it starts with", () => {
    for (const id of TEMPLATE_ORDER) {
      expect(TEMPLATE_SEED[id], id).toBeDefined();
      expect(TEMPLATE_SEED[id].length, id).toBeGreaterThan(0);
    }
  });

  /**
   * The whole reason the module exists. Before it, a template chose a default colour and a
   * font weight — so "which card is this for" was answered by nothing at all.
   */
  it("gives the two templates genuinely different presets", () => {
    const meridian = JSON.stringify(TEMPLATE_SEED.meridian);
    const marigold = JSON.stringify(TEMPLATE_SEED.marigold);
    expect(meridian).not.toBe(marigold);
  });

  it("matches what each blurb promises: a number then an email, work vs personal", () => {
    expect(TEMPLATE_SEED.meridian).toEqual([
      { category: "WORK", type: "PHONE" },
      { category: "WORK", type: "EMAIL" },
    ]);
    expect(TEMPLATE_SEED.marigold).toEqual([
      { category: "PERSONAL", type: "PHONE" },
      { category: "PERSONAL", type: "EMAIL" },
    ]);

    // And the captions still say so. If a preset changes, this fails until the copy does too.
    expect(TEMPLATES.meridian.blurb).toContain("work number and work email");
    expect(TEMPLATES.marigold.blurb).toContain("mobile and personal email");
  });
});

describe("resolving a preset against a profile", () => {
  it("seeds Meridian with the work phone and the work email, in that order", () => {
    expect(seed("meridian")).toEqual(["field_work_phone", "field_work_email"]);
  });

  it("seeds Marigold with the mobile and the personal email, in that order", () => {
    expect(seed("marigold")).toEqual(["field_mobile", "field_personal_email"]);
  });

  it("returns ids the resolver can actually resolve — never a dangling one", () => {
    for (const id of TEMPLATE_ORDER) {
      const resolved = resolveCard(
        { ...cardLedgerDemo, templateId: id, fieldIds: seed(id) },
        fixtureUser,
        fixtureGroups,
        fixtureFields,
      );
      expect(resolved.droppedFieldIds, id).toEqual([]);
      expect(resolved.fieldCount, id).toBe(seed(id).length);
    }
  });

  /**
   * §11 E-08 / the `?state=empty` profile. A preset that cannot be satisfied yields nothing,
   * and the builder shows §11 E-01 over it. That is the honest answer; a fallback to "any
   * phone at all" would have the preset quietly share a home landline.
   */
  it("returns [] for a profile with no fields, rather than inventing a fallback", () => {
    for (const id of TEMPLATE_ORDER) {
      expect(
        seedFieldIds(id, EMPTY_FIXTURE_DB.groups, EMPTY_FIXTURE_DB.fields),
        id,
      ).toEqual([]);
    }
    expect(seedFieldIds("meridian", [], [])).toEqual([]);
  });

  it("keeps every id unique even when a preset repeats a coordinate", () => {
    const ids = seed("meridian");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves category and type together — never a fax for a phone", () => {
    for (const id of TEMPLATE_ORDER) {
      TEMPLATE_SEED[id].forEach((preference, index) => {
        const picked = seed(id)[index];
        expect(fieldById.get(picked)?.type, `${id}[${index}]`).toBe(preference.type);
        expect(categoryOf(picked), `${id}[${index}]`).toBe(preference.category);
      });
    }
  });
});

describe("the two rules a preset may not break", () => {
  /**
   * Rule 1. A preset is a convenience. Ticking something the owner marked sensitive because
   * it happened to be the only match is the builder deciding what they share.
   */
  it("never seeds a sensitive field, even when it is the only match", () => {
    const groups: readonly FieldGroup[] = [
      { id: "g", userId: "u", category: "WORK", name: "Work", fieldIds: ["only"] },
    ];
    const fields: readonly ProfileField[] = [
      {
        id: "only",
        groupId: "g",
        type: "PHONE",
        label: "Work mobile",
        value: "+919833004411",
        isSensitive: true,
      },
    ];

    expect(seedFieldIds("meridian", groups, fields)).toEqual([]);

    // The same field, not sensitive, is picked — so the exclusion above is the sensitivity
    // flag and not some other mismatch.
    expect(
      seedFieldIds("meridian", groups, [{ ...fields[0], isSensitive: false }]),
    ).toEqual(["only"]);
  });

  /** Rule 2, and the same exclusion `resolveCard` makes (§11 E-07). */
  it("never seeds a blank field", () => {
    const groups: readonly FieldGroup[] = [
      { id: "g", userId: "u", category: "WORK", name: "Work", fieldIds: ["blank", "real"] },
    ];
    const fields: readonly ProfileField[] = [
      { id: "blank", groupId: "g", type: "PHONE", label: "Old", value: "   ", isSensitive: false },
      {
        id: "real",
        groupId: "g",
        type: "PHONE",
        label: "Work mobile",
        value: "+919833004411",
        isSensitive: false,
      },
    ];

    expect(seedFieldIds("meridian", groups, fields)).toEqual(["real"]);
  });

  it("ignores a field whose group is unreachable — it has no category to match on", () => {
    const fields: readonly ProfileField[] = [
      {
        id: "orphan",
        groupId: "group_that_left",
        type: "PHONE",
        label: "Work mobile",
        value: "+919833004411",
        isSensitive: false,
      },
    ];
    expect(seedFieldIds("meridian", [], fields)).toEqual([]);
  });
});

describe("purity (I-4)", () => {
  it("returns the same ids for the same inputs", () => {
    expect(seed("meridian")).toEqual(seed("meridian"));
  });

  it("mutates neither the groups nor the fields it is handed", () => {
    const groupsBefore = JSON.stringify(fixtureGroups);
    const fieldsBefore = JSON.stringify(fixtureFields);
    seed("meridian");
    seed("marigold");
    expect(JSON.stringify(fixtureGroups)).toBe(groupsBefore);
    expect(JSON.stringify(fixtureFields)).toBe(fieldsBefore);
  });

  it("hands back a fresh array the caller may keep", () => {
    expect(seed("meridian")).not.toBe(seed("meridian"));
  });
});

describe("the card type a template stamps", () => {
  it("maps each category once, and agrees with the registry", () => {
    expect(CARD_TYPE_FOR_CATEGORY).toEqual({ business: "BUSINESS", personal: "PERSONAL" });
    expect(seedCardType("meridian")).toBe("BUSINESS");
    expect(seedCardType("marigold")).toBe("PERSONAL");
  });

  /**
   * The visible consequence: with no `JOB_TITLE` seeded, the share face's role tag falls back
   * to the card type — so a new Meridian card reads "Business" and a new Marigold "Personal"
   * before the owner touches anything.
   */
  it("is what the face's role tag falls back to on a freshly seeded card", () => {
    for (const id of TEMPLATE_ORDER) {
      const resolved = resolveCard(
        {
          ...cardLedgerDemo,
          templateId: id,
          type: seedCardType(id),
          fieldIds: seed(id),
        },
        fixtureUser,
        fixtureGroups,
        fixtureFields,
      );
      expect(resolved.fields.some((field) => field.type === "JOB_TITLE"), id).toBe(false);
      expect(resolved.cardType, id).toBe(seedCardType(id));
    }
  });
});
