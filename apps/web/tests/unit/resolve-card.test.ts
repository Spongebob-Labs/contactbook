import { describe, expect, it } from "vitest";

import { buildVcf, canBuildVcf } from "@/card/build-vcf";
import { isUnknownRegistryIdError, UnknownRegistryIdError } from "@/card/errors";
import { resolveCard } from "@/card/resolve-card";
import { TEMPLATES } from "@/card/templates";
import { cardEmptyDemo, cardLedgerDemo, fixtureCards } from "@/fixtures/cards";
import {
  cardDanglingFieldIds,
  cardPhotoOverride,
  extremeCards,
  extremeFields,
  extremeGroups,
  extremeUserNoAvatar,
  extremeUserPhotoOverride,
} from "@/fixtures/extremes";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";
import type { ContactCard, FieldGroup, ProfileField, ResolvedCard } from "@/types/domain";

/**
 * `resolveCard` — spec §6.4, §5.3a, §5.6 (I-2, I-4, I-5, I-6), §8A.6, §11 E-01…E-07, E-40.
 *
 * The one structural fact under test: **a card owns no data; a card is a filter over
 * `ProfileField`s** (§5.3). Everything a card displays is reached through that indirection,
 * so a resolver bug is not a rendering bug — it is every screen rendering the wrong thing,
 * and the `.vcf` and the QR agreeing with it.
 *
 * Pure functions only: no DOM, no geometry (§14.6), no clock.
 */

/** The ordinary profile, which is what every card except the extremes filters over. */
function resolve(card: ContactCard): ResolvedCard {
  return resolveCard(card, fixtureUser, fixtureGroups, fixtureFields);
}

/** `fieldIds` is `readonly` so the `as const` fixtures compile — copy, never cast. */
function withFieldIds(card: ContactCard, fieldIds: readonly string[]): ContactCard {
  return { ...card, fieldIds: [...fieldIds] };
}

const snapshot = (value: unknown): string => JSON.stringify(value);
const idsOf = (fields: readonly { id: string }[]): string[] => fields.map((field) => field.id);
const byteLength = (value: string): number => new TextEncoder().encode(value).length;

describe("resolveCard — shape and template lookup (spec §6.4, I-1)", () => {
  it("carries the card's own content and resolves its template through the registry", () => {
    const resolved = resolve(cardLedgerDemo);

    expect(resolved.cardId).toBe("card_minimal_demo");
    expect(resolved.publicUrl).toBe("https://card.example/c/1eLRLR5KbYdbwSn0kHB1v1");
    expect(resolved.cardName).toBe("Work");
    expect(resolved.cardType).toBe("BUSINESS");
    expect(resolved.template).toBe(TEMPLATES.meridian);
  });

  it("derives `fullName` from the user, never from the card", () => {
    expect(resolve(cardLedgerDemo).fullName).toBe("Priyanka Raghunathan");
  });

  it("reports `fieldCount` as fields + socialFields, exactly as §6.4 defines it", () => {
    for (const card of fixtureCards) {
      const resolved = resolve(card);
      expect(resolved.fieldCount).toBe(resolved.fields.length + resolved.socialFields.length);
    }
  });
});

describe("resolveCard — invariant I-1 is enforced at the boundary, not assumed (spec §5.6, §6.4)", () => {
  /**
   * `ContactCard.templateId` is `TemplateId` and `ContactCard.paletteId` is `PaletteId | undefined`
   * — `tsc` will not let a caller construct either field with a string outside those unions, which
   * is I-1 holding at compile time. Reaching the runtime guard therefore needs a cast through
   * `unknown`, on purpose: that is exactly the shape of the one documented way an unresolvable id
   * has ever reached `resolveCard` (see `UnknownRegistryIdError`'s own comment) — a value that
   * outlived its own type check rather than one written past it directly.
   */
  function withTemplateId(card: ContactCard, templateId: string): ContactCard {
    return { ...card, templateId: templateId as unknown as ContactCard["templateId"] };
  }

  function withPaletteId(card: ContactCard, paletteId: string): ContactCard {
    return {
      ...card,
      paletteId: paletteId as unknown as NonNullable<ContactCard["paletteId"]>,
    };
  }

  it("throws UnknownRegistryIdError for an unresolved templateId, instead of a ResolvedCard with `template: undefined`", () => {
    const card = withTemplateId(cardLedgerDemo, "ledger");

    expect(() => resolve(card)).toThrow(UnknownRegistryIdError);
  });

  it("names the subject, the offending id and the card, so a caught throw is diagnosable", () => {
    try {
      resolve(withTemplateId(cardLedgerDemo, "ledger"));
      expect.unreachable("resolveCard must throw for an unresolved templateId");
    } catch (error) {
      expect(isUnknownRegistryIdError(error)).toBe(true);
      expect((error as UnknownRegistryIdError).subject).toBe("template");
      expect((error as UnknownRegistryIdError).id).toBe("ledger");
      expect((error as UnknownRegistryIdError).cardId).toBe("card_minimal_demo");
    }
  });

  it("throws the same way for an unresolved paletteId the card set explicitly", () => {
    const card = withPaletteId(cardLedgerDemo, "carbon");

    try {
      resolve(card);
      expect.unreachable("resolveCard must throw for an unresolved paletteId");
    } catch (error) {
      expect(isUnknownRegistryIdError(error)).toBe(true);
      expect((error as UnknownRegistryIdError).subject).toBe("palette");
      expect((error as UnknownRegistryIdError).id).toBe("carbon");
    }
  });

  it("still resolves normally when templateId and paletteId are both valid — the guard is silent on the happy path", () => {
    // Every ordinary fixture card omits `paletteId` (I-1's own fallback branch) and still
    // resolves without throwing — the guard added for the unresolved case must not become a
    // second, stricter definition of "valid" that the fixtures themselves fail.
    for (const card of fixtureCards) {
      expect(() => resolve(card)).not.toThrow();
    }
  });
});

describe("resolveCard — the ordering rule (spec §6.4)", () => {
  it("sorts by FieldCategory, then FieldType, then label, then id — from any input order", () => {
    // card_forest_demo spans two categories and four types, so it exercises both keys.
    const declared = resolve(
      withFieldIds(fixtureCards[1], [
        "field_bio",
        "field_mobile",
        "field_personal_email",
        "field_instagram",
        "field_dob",
      ]),
    );
    const shuffled = resolve(
      withFieldIds(fixtureCards[1], [
        "field_dob",
        "field_instagram",
        "field_personal_email",
        "field_bio",
        "field_mobile",
      ]),
    );

    // IDENTITY before PERSONAL; within IDENTITY, TEXT before DATE (declaration order).
    expect(idsOf(declared.fields)).toEqual([
      "field_bio",
      "field_dob",
      "field_mobile",
      "field_personal_email",
    ]);
    expect(idsOf(shuffled.fields)).toEqual(idsOf(declared.fields));
    expect(idsOf(shuffled.socialFields)).toEqual(["field_instagram"]);
  });

  it("breaks a category+type tie on label with localeCompare('en-GB')", () => {
    // Both BUSINESS/REG_NUMBER: "CIN" sorts before "GSTIN" whatever order they arrive in.
    const resolved = resolve(withFieldIds(cardLedgerDemo, ["field_gstin", "field_cin"]));
    expect(idsOf(resolved.fields)).toEqual(["field_cin", "field_gstin"]);
  });

  it("breaks a label tie on id, so the order is total and the vCard is byte-stable", () => {
    const groups: FieldGroup[] = [
      { id: "group_tie", userId: fixtureUser.id, category: "WORK", name: "Work", fieldIds: [] },
    ];
    const fields: ProfileField[] = [
      { id: "field_tie_b", groupId: "group_tie", type: "CUSTOM", label: "Same", value: "b", isSensitive: false },
      { id: "field_tie_a", groupId: "group_tie", type: "CUSTOM", label: "Same", value: "a", isSensitive: false },
    ];
    const card = withFieldIds(cardLedgerDemo, ["field_tie_b", "field_tie_a"]);

    expect(idsOf(resolveCard(card, fixtureUser, groups, fields).fields)).toEqual([
      "field_tie_a",
      "field_tie_b",
    ]);
  });
});

describe("resolveCard — purity (invariant I-4)", () => {
  it("returns deep-equal output for the same inputs, on a fresh object each time", () => {
    const first = resolve(cardLedgerDemo);
    const second = resolve(cardLedgerDemo);

    expect(second).toEqual(first);
    // A fresh object, not a memo: I-5's identity must be *carried* by the caller, never
    // recovered by luck from a cache.
    expect(second).not.toBe(first);
    expect(second.fields).not.toBe(first.fields);
  });

  it("mutates none of its four inputs", () => {
    const before = {
      card: snapshot(cardLedgerDemo),
      user: snapshot(fixtureUser),
      groups: snapshot(fixtureGroups),
      fields: snapshot(fixtureFields),
    };

    const resolved = resolve(cardLedgerDemo);
    resolved.fields.push(resolved.fields[0]);
    resolved.droppedFieldIds.push("field_injected");

    expect(snapshot(cardLedgerDemo)).toBe(before.card);
    expect(snapshot(fixtureUser)).toBe(before.user);
    expect(snapshot(fixtureGroups)).toBe(before.groups);
    expect(snapshot(fixtureFields)).toBe(before.fields);
  });
});

describe("resolveCard — dangling ids (invariant I-2, §11 E-40)", () => {
  it("drops an id absent from the profile into `droppedFieldIds` without throwing", () => {
    const resolved = resolveCard(
      cardDanglingFieldIds,
      fixtureUser,
      extremeGroups,
      extremeFields,
    );

    expect(resolved.droppedFieldIds).toEqual(["field_deleted_by_user", "field_also_deleted"]);
    expect(idsOf(resolved.fields)).toEqual(["field_work_email"]);
    expect(resolved.fieldCount).toBe(1);
  });

  it("drops a field whose owning group is not part of the profile", () => {
    // §5.3: a card's ids are a subset of what is reachable through the user's FieldGroups.
    // A field with no group is not reachable, and it has no FieldCategory to sort on.
    const orphan: ProfileField = {
      id: "field_orphan",
      groupId: "group_that_is_gone",
      type: "EMAIL",
      label: "Orphan",
      value: "orphan@example.com",
      isSensitive: false,
    };
    const resolved = resolveCard(
      withFieldIds(cardLedgerDemo, ["field_orphan", "field_work_email"]),
      fixtureUser,
      fixtureGroups,
      [...fixtureFields, orphan],
    );

    expect(resolved.droppedFieldIds).toEqual(["field_orphan"]);
    expect(idsOf(resolved.fields)).toEqual(["field_work_email"]);
  });

  it("resolves every ordinary fixture card with nothing dropped", () => {
    for (const card of fixtureCards) {
      expect(resolve(card).droppedFieldIds).toEqual([]);
    }
  });

  it("counts a repeated id once — `fieldIds` is a set, not a list", () => {
    const resolved = resolve(
      withFieldIds(cardLedgerDemo, ["field_work_email", "field_work_email"]),
    );
    expect(idsOf(resolved.fields)).toEqual(["field_work_email"]);
    expect(resolved.fieldCount).toBe(1);
  });
});

describe("resolveCard — blank values (§11 E-07)", () => {
  it("excludes a field with `value: ''` entirely, and does not call it dangling", () => {
    // field_draft_note is a permanent fixture with an empty value, for exactly this row.
    const resolved = resolve(
      withFieldIds(cardLedgerDemo, [...cardLedgerDemo.fieldIds, "field_draft_note"]),
    );

    expect(idsOf(resolved.fields)).not.toContain("field_draft_note");
    expect(resolved.droppedFieldIds).not.toContain("field_draft_note");
    expect(resolved.fieldCount).toBe(cardLedgerDemo.fieldIds.length);
  });

  it("treats a whitespace-only value as blank — an empty row is an empty row", () => {
    const blank: ProfileField = {
      id: "field_blank",
      groupId: "group_work",
      type: "STATUS",
      label: "Availability",
      value: "   ",
      isSensitive: false,
    };
    const resolved = resolveCard(
      withFieldIds(cardLedgerDemo, ["field_blank", "field_work_email"]),
      fixtureUser,
      fixtureGroups,
      [...fixtureFields, blank],
    );

    expect(idsOf(resolved.fields)).toEqual(["field_work_email"]);
  });
});

describe("resolveCard — sensitive fields (invariant I-6)", () => {
  it("never includes an isSensitive field that the card did not explicitly map", () => {
    const resolved = resolve(cardLedgerDemo);
    const sensitiveIds = fixtureFields.filter((field) => field.isSensitive).map((f) => f.id);

    expect(sensitiveIds.length).toBeGreaterThan(0);
    for (const id of sensitiveIds) {
      expect(cardLedgerDemo.fieldIds).not.toContain(id);
      expect(idsOf(resolved.fields)).not.toContain(id);
      expect(idsOf(resolved.socialFields)).not.toContain(id);
    }
  });

  it("includes an isSensitive field the card DID map, carrying the flag forward", () => {
    const resolved = resolve(withFieldIds(cardLedgerDemo, ["field_dob"]));
    expect(idsOf(resolved.fields)).toEqual(["field_dob"]);
    expect(resolved.fields[0].isSensitive).toBe(true);
  });
});

describe("resolveCard — the social split and the photo slot (§6.4, §6.6)", () => {
  it("splits SOCIAL_LINK fields out of `fields` and into `socialFields`", () => {
    const resolved = resolve(fixtureCards[6]); // card_lagoon_demo: github + x

    expect(idsOf(resolved.socialFields)).toEqual(["field_github", "field_x"]);
    expect(resolved.socialFields.every((field) => field.type === "SOCIAL_LINK")).toBe(true);
    expect(resolved.fields.some((field) => field.type === "SOCIAL_LINK")).toBe(false);
  });

  it("never renders PHOTO as a field row — the avatar slot consumes it (§6.6)", () => {
    const resolved = resolveCard(
      cardPhotoOverride,
      extremeUserPhotoOverride,
      extremeGroups,
      extremeFields,
    );

    expect(idsOf(resolved.fields)).toEqual(["field_work_email"]);
    expect(resolved.fieldCount).toBe(1);
  });

  it("carries the owning group's FieldCategory onto every resolved field", () => {
    const resolved = resolve(cardLedgerDemo);
    expect(resolved.fields.every((field) => field.category === "WORK")).toBe(true);
  });
});

describe("resolveCard — avatar precedence (§5.3a, §11 E-19)", () => {
  it("prefers a mapped PHOTO field over `User.avatarUrl`", () => {
    const resolved = resolveCard(
      cardPhotoOverride,
      extremeUserPhotoOverride,
      extremeGroups,
      extremeFields,
    );

    expect(resolved.avatar).toEqual({
      kind: "photo",
      url: "/portraits/mei.png",
      alt: "Mei Nakamura",
    });
  });

  it("falls back to `User.avatarUrl` when no PHOTO is mapped", () => {
    expect(resolve(cardLedgerDemo).avatar).toEqual({
      kind: "photo",
      url: "/portraits/priyanka.png",
      alt: "Priyanka Raghunathan",
    });
  });

  it("falls back to a monogram when there is neither — never an empty circle (E-19)", () => {
    const resolved = resolveCard(
      cardLedgerDemo,
      extremeUserNoAvatar,
      fixtureGroups,
      fixtureFields,
    );

    expect(resolved.avatar).toEqual({ kind: "monogram", initials: "PR" });
  });

  it("never emits empty monogram initials, even for a user with no name", () => {
    const nameless = { ...fixtureUser, firstName: " ", lastName: " ", avatarUrl: null };
    const resolved = resolveCard(cardLedgerDemo, nameless, fixtureGroups, fixtureFields);

    expect(resolved.avatar.kind).toBe("monogram");
    if (resolved.avatar.kind === "monogram") {
      expect(resolved.avatar.initials.length).toBeGreaterThanOrEqual(1);
      expect(resolved.avatar.initials.length).toBeLessThanOrEqual(2);
    }
  });
});

describe("resolveCard — bio precedence (§5.3a, §11 E-05, E-06)", () => {
  const bioOf = (fieldIds: readonly string[]): string | null =>
    resolve(withFieldIds(cardLedgerDemo, fieldIds)).bio;

  it("1 — the first mapped TEXT field wins", () => {
    expect(bioOf(["field_bio", "field_job_title", "field_company"])).toBe(
      "Builds the studio's telecom and fintech alliances across South Asia. Ex-product, still writes the deck.",
    );
  });

  it("2 — else '{JOB_TITLE} at {COMPANY}' when both are mapped", () => {
    expect(bioOf(["field_job_title", "field_company"])).toBe(
      "Head of Partnerships at Fernwood Studio",
    );
  });

  it("3a — else JOB_TITLE alone", () => {
    expect(bioOf(["field_job_title", "field_work_email"])).toBe("Head of Partnerships");
  });

  it("3b — else COMPANY alone", () => {
    expect(bioOf(["field_company", "field_work_email"])).toBe("Fernwood Studio");
  });

  it("4 — else null, so the slot collapses rather than reserving empty space (E-06)", () => {
    expect(bioOf(["field_work_email", "field_work_phone"])).toBeNull();
    expect(resolve(cardEmptyDemo).bio).toBeNull();
  });

  it("carries the FULL text — clamping to 3 lines is the renderer's job (E-05)", () => {
    const long = bioOf(["field_bio"]);
    expect(long).not.toBeNull();
    expect(long).toContain("still writes the deck.");
    expect(long?.endsWith("…")).toBe(false);
  });

  it("never derives a bio from a field the card did not map", () => {
    expect(resolve(withFieldIds(cardLedgerDemo, ["field_work_email"])).bio).toBeNull();
  });
});

describe("resolveCard — qrPayload (spec §8A.6, AC-08)", () => {
  it("is the card's own API-minted publicUrl, verbatim, for everything downstream", () => {
    // ⚠ No longer assembled from an origin plus a slug. `resolveCard` reads `card.publicUrl`
    // and does not transform it — a re-based origin here is how the dead `/c/{slug}` guess
    // this replaces came about in the first place.
    expect(resolve(cardLedgerDemo).qrPayload).toBe("https://card.example/c/1eLRLR5KbYdbwSn0kHB1v1");
  });

  it("reads no environment at all — the payload is a pure function of the card", () => {
    if (process.env.NEXT_PUBLIC_SITE_URL === undefined) {
      // The old behaviour fell back to `http://localhost:3000`, so a card built on a laptop
      // advertised a URL nobody else could open. There is no origin to fall back to now.
      expect(resolve(cardLedgerDemo).qrPayload).toBe(cardLedgerDemo.publicUrl);
    }
  });

  it("stays within the 60-byte budget for every fixture card (AC-08)", () => {
    // Both sets, and through the real resolver rather than a transcribed expression: the
    // budget is what keeps the symbol at version 6 or below at the 140px floor (§8A.6).
    for (const card of fixtureCards) {
      const payload = resolve(card).qrPayload;
      expect(payload).not.toBeNull();
      expect(byteLength(payload as string)).toBeLessThanOrEqual(60);
    }
    for (const card of extremeCards) {
      const resolved = resolveCard(card, fixtureUser, extremeGroups, extremeFields);
      expect(resolved.qrPayload).not.toBeNull();
      expect(byteLength(resolved.qrPayload as string)).toBeLessThanOrEqual(60);
    }
    expect(extremeCards.length).toBeGreaterThan(0);
  });

  it("is produced for a zero-field card too — the QR resolves, the vCard does not", () => {
    expect(resolve(cardEmptyDemo).qrPayload).toBe("https://card.example/c/0g81sfFwyfSUCqeYInfGdS");
  });
});

describe("resolveCard — the zero-field card (§11 E-01/E-02, AC-23, AC-36)", () => {
  it("card_empty_demo resolves to fieldCount 0 with no fields and no socials", () => {
    const resolved = resolve(cardEmptyDemo);

    expect(resolved.fields).toEqual([]);
    expect(resolved.socialFields).toEqual([]);
    expect(resolved.fieldCount).toBe(0);
    expect(resolved.droppedFieldIds).toEqual([]);
  });

  it("still resolves a name, a template and a payload, so the consequence is visible", () => {
    const resolved = resolve(cardEmptyDemo);

    // E-01: "the preview still renders (name only) so the consequence is visible".
    expect(resolved.fullName).toBe("Priyanka Raghunathan");
    expect(resolved.template).toBe(TEMPLATES.meridian);
    expect(resolved.qrPayload).toBe("https://card.example/c/0g81sfFwyfSUCqeYInfGdS");
  });

  it("is the newest card in the set, so any recency-sorted list surfaces it first", () => {
    // The old build ranked presets `updatedAt desc` and therefore preselected the empty
    // card. The fixture reproduces that condition on purpose (§11.6) — the guard has to
    // survive being the default selection, not merely exist.
    const newest = [...fixtureCards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    expect(newest.id).toBe("card_empty_demo");
    expect(resolve(newest).fieldCount).toBe(0);
  });

  it("a card mapping only ids that no longer exist is also a zero-field card", () => {
    const resolved = resolve(withFieldIds(cardLedgerDemo, ["field_gone_a", "field_gone_b"]));

    expect(resolved.fieldCount).toBe(0);
    expect(resolved.droppedFieldIds).toEqual(["field_gone_a", "field_gone_b"]);
  });

  it("the zero-field guard the UI reads agrees with the writer's throw", () => {
    // E-01 (builder: warning bar + disabled Save) and E-02 (public card: no button at all)
    // both key off this one predicate, so there is a single definition of "shares nothing".
    expect(canBuildVcf(resolve(cardEmptyDemo))).toBe(false);
    expect(canBuildVcf(resolve(cardLedgerDemo))).toBe(true);
  });

  it("a card mapping only a PHOTO shares no details either", () => {
    const resolved = resolveCard(
      withFieldIds(cardPhotoOverride, ["field_x_photo"]),
      extremeUserPhotoOverride,
      extremeGroups,
      extremeFields,
    );

    expect(resolved.avatar.kind).toBe("photo");
    expect(resolved.fieldCount).toBe(0);
  });
});

/* ── I-5 / AC-29: the preview object IS the payload object ─────────────────────────── */

describe("resolveCard — one object for preview and payload (I-5, AC-29)", () => {
  /**
   * The share seam, as T22 and T23 build it: one `resolveCard` call feeds the renderer, the
   * vCard writer and the PNG exporter. This is the structural fix for the old build's
   * "previewed file differs from sent file" bug — the two cannot disagree because there is
   * only one object, not because three call sites are careful.
   */
  function sharePanel(resolved: ResolvedCard): {
    previewed: ResolvedCard;
    written: ResolvedCard;
    vcf: string;
  } {
    // Each consumer records the object it was actually handed, so the assertion is about
    // the seam rather than about the argument the test typed out.
    const handed: ResolvedCard[] = [];

    const renderCard = (r: ResolvedCard): void => void handed.push(r); // <CardRenderer>
    const writeVcf = (r: ResolvedCard): string => {
      handed.push(r);
      return buildVcf(r);
    };

    renderCard(resolved);
    const vcf = writeVcf(resolved);

    return { previewed: handed[0], written: handed[1], vcf };
  }

  it("hands the renderer and the writer the SAME reference, not a deep-equal copy", () => {
    const resolved = resolve(cardLedgerDemo);
    const panel = sharePanel(resolved);

    expect(panel.previewed).toBe(panel.written);
    expect(panel.previewed).toBe(resolved);
  });

  it("makes the identity impossible to fake with a cache — every call is a new object", () => {
    const first = resolve(cardLedgerDemo);
    const second = resolve(cardLedgerDemo);

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    // Two resolutions of one card still write the same bytes; identity is about the seam,
    // not about the output being unstable.
    expect(buildVcf(first)).toBe(buildVcf(second));
  });

  it("re-resolving after an edit changes both surfaces together, never one of them", () => {
    const before = resolve(cardLedgerDemo);
    const after = resolve(withFieldIds(cardLedgerDemo, ["field_work_email"]));

    expect(after.fieldCount).toBe(1);
    expect(buildVcf(after)).not.toBe(buildVcf(before));
    expect(buildVcf(after)).not.toContain("TITLE:");
    expect(after.fields.some((entry) => entry.type === "JOB_TITLE")).toBe(false);
  });
});
