import { describe, expect, it } from "vitest";

import { cardPageSections, heroBio, splitHeroFields } from "@/card/card-page-rows";
import type { FieldCategory, FieldType, ResolvedField } from "@/types/domain";

/**
 * THE THREE RULES THE 2026-09-17 CARD PAGE ADDED, asserted where they live.
 *
 * All three are pure functions over the row contract, so they are testable without a DOM, a
 * layout engine or a fixture — which is the same reason `classifyFieldRow` was pulled out of the
 * renderer in the first place.
 */

let n = 0;
function field(
  type: FieldType,
  category: FieldCategory,
  value: string,
  label = type,
): ResolvedField {
  n += 1;
  return { id: `f${n}`, type, category, label, value, isSensitive: false };
}

describe("splitHeroFields — promotion is subtraction", () => {
  it("lifts the first job title and company out of the stack", () => {
    const role = field("JOB_TITLE", "IDENTITY", "Head of Partnerships");
    const org = field("COMPANY", "BUSINESS", "Fernwood Studio");
    const phone = field("PHONE", "PERSONAL", "+91 98201 15577");

    const hero = splitHeroFields([role, org, phone]);

    expect(hero.role).toBe("Head of Partnerships");
    expect(hero.org).toBe("Fernwood Studio");
    expect(hero.rest.map((f) => f.id)).toEqual([phone.id]);
  });

  /** "First", not "every" — somebody genuinely holding two titles keeps the second as a row. */
  it("keeps a second job title and a second company as rows", () => {
    const a = field("JOB_TITLE", "IDENTITY", "Head of Partnerships");
    const b = field("JOB_TITLE", "IDENTITY", "Trustee");
    const c = field("COMPANY", "BUSINESS", "Fernwood Studio");
    const d = field("COMPANY", "BUSINESS", "Fernwood Ventures");

    const hero = splitHeroFields([a, b, c, d]);

    expect(hero.role).toBe("Head of Partnerships");
    expect(hero.rest.map((f) => f.id)).toEqual([b.id, d.id]);
  });

  /**
   * The bio's SOURCE is consumed too. `resolveBio`'s first branch is the first mapped `TEXT`
   * field, and the hero prints that text in a display serif — leaving the field in produced the
   * same paragraph twice, forty pixels apart.
   */
  it("consumes the TEXT field the bio was composed from", () => {
    const bio = field("TEXT", "IDENTITY", "Builds alliances across South Asia.");
    const other = field("TEXT", "CUSTOM", "she/her");

    const hero = splitHeroFields([bio, other], "Builds alliances across South Asia.");

    expect(hero.rest.map((f) => f.id)).toEqual([other.id]);
  });

  /** A TEXT field that is not the bio is a field the owner added on purpose. It keeps its row. */
  it("keeps a TEXT field whose value is not the bio", () => {
    const other = field("TEXT", "CUSTOM", "she/her");
    expect(splitHeroFields([other], "Something else entirely").rest).toHaveLength(1);
  });

  it("promotes nothing when there is nothing to promote", () => {
    const phone = field("PHONE", "PERSONAL", "+91 98201 15577");
    const hero = splitHeroFields([phone]);

    expect(hero.role).toBeNull();
    expect(hero.org).toBeNull();
    expect(hero.rest).toHaveLength(1);
  });
});

describe("heroBio — the bio never repeats the hero", () => {
  it("drops a bio composed as '{role} at {org}'", () => {
    expect(heroBio("Head of Partnerships at Fernwood Studio", "Head of Partnerships", "Fernwood Studio"))
      .toBeNull();
  });

  it("drops a bio that is just the role, or just the company", () => {
    expect(heroBio("Head of Partnerships", "Head of Partnerships", null)).toBeNull();
    expect(heroBio("Fernwood Studio", null, "Fernwood Studio")).toBeNull();
  });

  it("keeps a bio the owner actually wrote", () => {
    expect(heroBio("Builds alliances across South Asia.", "Head of Partnerships", "Fernwood Studio"))
      .toBe("Builds alliances across South Asia.");
  });

  /** Case and runs of whitespace are the same repeat to a reader; only an exact-match rule
      would print both. */
  it("compares loosely enough to catch a reformatted repeat", () => {
    expect(heroBio("head of  partnerships AT Fernwood Studio", "Head of Partnerships", "Fernwood Studio"))
      .toBeNull();
  });

  it("passes a null bio straight through", () => {
    expect(heroBio(null, "Head of Partnerships", "Fernwood Studio")).toBeNull();
  });
});

describe("cardPageSections — headings at boundaries that already exist", () => {
  /**
   * ⚠ The single most important property here: the resolver already sorts by category, so this
   * function inserts headings and NEVER reorders. `buildVcf` writes from the same sequence, so a
   * page that re-sorted its rows would disagree with the `.vcf` a reader saved from it — which
   * is the reason grouping was rejected the first time it was proposed.
   */
  it("preserves the incoming order exactly", () => {
    const rows = [
      field("PHONE", "PERSONAL", "+91 98201 15577"),
      field("EMAIL", "PERSONAL", "a@b.example"),
      field("URL", "BUSINESS", "https://fernwood.example"),
    ];

    const sections = cardPageSections(rows, 16);
    const flattened = sections.flatMap((s) => s.rows.map((r) => r.field.id));

    expect(flattened).toEqual(rows.map((f) => f.id));
  });

  it("opens a new section at each category change, and names it", () => {
    const sections = cardPageSections(
      [
        field("PHONE", "PERSONAL", "+91 98201 15577"),
        field("URL", "BUSINESS", "https://fernwood.example"),
        field("CRYPTO_WALLET", "FINANCIAL", "0xabc"),
        field("CUSTOM", "CUSTOM", "she/her"),
      ],
      16,
    );

    expect(sections.map((s) => s.category)).toEqual([
      "PERSONAL",
      "BUSINESS",
      "FINANCIAL",
      "CUSTOM",
    ]);
    /* FINANCIAL reads as PAYMENT and CUSTOM as OTHER: "custom" describes how the field was
       authored, which is the owner's concern and not the reader's. */
    expect(sections.map((s) => s.label)).toEqual(["Personal", "Business", "Payment", "Other"]);
  });

  /** Social links are lifted into the icon strip, and dropped HERE so there is one answer to
      "stack or strip" rather than two that can disagree. */
  it("never makes a section of social links", () => {
    const sections = cardPageSections(
      [
        field("SOCIAL_LINK", "SOCIAL", "https://linkedin.com/in/maya"),
        field("PHONE", "PERSONAL", "+91 98201 15577"),
      ],
      16,
    );

    expect(sections.map((s) => s.category)).toEqual(["PERSONAL"]);
  });

  /** A category whose every field is declined by the registry opens no empty heading. */
  it("opens no section for a category that paints no rows", () => {
    const sections = cardPageSections(
      [field("PHOTO", "IDENTITY", "/portraits/x.png"), field("PHONE", "PERSONAL", "+91 98201 15577")],
      16,
    );

    expect(sections.map((s) => s.category)).toEqual(["PERSONAL"]);
  });

  it("returns nothing for a card that maps nothing", () => {
    expect(cardPageSections([], 16)).toEqual([]);
  });
});
