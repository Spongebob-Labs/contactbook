import { describe, expect, it } from "vitest";

import type {
  CardTemplate,
  QrZoneSpec,
  PageHeader,
  TemplateCategory,
  TemplateId,
  TemplateType,
} from "@/card/template-types";
import type { PaletteId } from "@/card/template-palettes";
import type {
  CardType,
  Contact,
  ContactCard,
  FieldCategory,
  FieldGroup,
  FieldType,
  FixtureResult,
  ProfileField,
  ResolvedAvatar,
  ResolvedCard,
  ScreenState,
  User,
} from "@/types/domain";

/**
 * The contract for the two type modules every other track compiles against.
 *
 * Most of what this file asserts is decided by `tsc --noEmit`, not by vitest: an exhaustive
 * `Record<Union, true>` literal cannot be written with a member missing or a member invented,
 * so `pnpm --filter web typecheck` is the real gate and the runtime `expect`s below simply
 * make the count visible in the test report.
 */

/** True only when `A` and `B` are the *same* type, not merely mutually assignable. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

describe("module resolution", () => {
  it("resolves both type modules at runtime — every import above is `import type` and erased", async () => {
    // Without this, a missing file would leave the whole suite vacuously green: esbuild strips
    // type-only imports, so vitest alone never proves the modules exist.
    await expect(import("@/types/domain")).resolves.toBeDefined();
    await expect(import("@/card/template-types")).resolves.toBeDefined();
  });
});

describe("domain enumerations (spec §5.1)", () => {
  it("declares all 21 FieldTypes — every one needs a renderer (AC-21) and a vCard mapping", () => {
    const FIELD_TYPE_KEYS: Record<FieldType, true> = {
      PHONE: true,
      LANDLINE: true,
      FAX: true,
      EMAIL: true,
      ADDRESS: true,
      URL: true,
      SOCIAL_LINK: true,
      PHOTO: true,
      TEXT: true,
      DATE: true,
      JOB_TITLE: true,
      COMPANY: true,
      REG_NUMBER: true,
      DEPARTMENT: true,
      RELATION: true,
      STATUS: true,
      LOCATION_TRACKING: true,
      BANK_ACCOUNT: true,
      DIGITAL_WALLET: true,
      CRYPTO_WALLET: true,
      CUSTOM: true,
    };

    expect(Object.keys(FIELD_TYPE_KEYS)).toHaveLength(21);
  });

  it("fails tsc when a Record over FieldType misses a member — AC-21's type half", () => {
    // The same mechanism AC-21 rests on: `FIELD_RENDERERS: Record<FieldType, FieldRenderer>`
    // cannot be written with a field type missing. T12 proves it against the real registry;
    // this is the early tripwire on the union itself.
    // @ts-expect-error AC-21: `CUSTOM` is missing from this Record, so the literal is
    // incomplete. If `FieldType` ever loses a member, this directive goes unused and
    // `pnpm --filter web typecheck` fails.
    const INCOMPLETE: Record<FieldType, true> = {
      PHONE: true,
      LANDLINE: true,
      FAX: true,
      EMAIL: true,
      ADDRESS: true,
      URL: true,
      SOCIAL_LINK: true,
      PHOTO: true,
      TEXT: true,
      DATE: true,
      JOB_TITLE: true,
      COMPANY: true,
      REG_NUMBER: true,
      DEPARTMENT: true,
      RELATION: true,
      STATUS: true,
      LOCATION_TRACKING: true,
      BANK_ACCOUNT: true,
      DIGITAL_WALLET: true,
      CRYPTO_WALLET: true,
    };

    expect(Object.keys(INCOMPLETE)).toHaveLength(20);
  });

  it("declares all 7 FieldCategories, in the §6.4 ordering-line declaration order", () => {
    const FIELD_CATEGORY_KEYS: Record<FieldCategory, true> = {
      IDENTITY: true,
      PERSONAL: true,
      WORK: true,
      BUSINESS: true,
      SOCIAL: true,
      FINANCIAL: true,
      CUSTOM: true,
    };

    expect(Object.keys(FIELD_CATEGORY_KEYS)).toEqual([
      "IDENTITY",
      "PERSONAL",
      "WORK",
      "BUSINESS",
      "SOCIAL",
      "FINANCIAL",
      "CUSTOM",
    ]);
  });

  it("declares all 4 CardTypes", () => {
    const CARD_TYPE_KEYS: Record<CardType, true> = {
      BUSINESS: true,
      PERSONAL: true,
      PAYMENT: true,
      CUSTOM: true,
    };

    expect(Object.keys(CARD_TYPE_KEYS)).toHaveLength(4);
  });
});

describe("domain entities (spec §5.2)", () => {
  it("keeps ProfileField.value a plain string at the UI boundary — never a union, never an object", () => {
    const valueIsString: Equals<ProfileField["value"], string> = true;
    expect(valueIsString).toBe(true);
  });

  it("keeps User.avatarUrl nullable — E-19 renders the monogram off it", () => {
    const avatarUrlIsNullable: Equals<User["avatarUrl"], string | null> = true;
    expect(avatarUrlIsNullable).toBe(true);
  });

  it("models Contact as an outbound recipient — a number, not a saved lead", () => {
    // The inversion, pinned. `Contact` used to carry `sourceCardSlug` and a denormalised
    // `fields[]` snapshot of somebody else's details; the API has neither concept. What it has
    // is a number you can send to, and the number is the identity it is matched by.
    const phoneIsRequiredString: Equals<Contact["phoneE164"], string> = true;
    expect(phoneIsRequiredString).toBe(true);

    // Nullable because an import routinely brings a number with no name — which is why every
    // surface goes through `contactLabel` rather than reading `displayName` directly.
    const displayNameIsNullable: Equals<Contact["displayName"], string | null> = true;
    expect(displayNameIsNullable).toBe(true);

    // Private to the owner, and nullable: the notes block has to collapse, not render "null".
    const notesIsNullable: Equals<Contact["notes"], string | null> = true;
    expect(notesIsNullable).toBe(true);

    // Set by the contact texting STOP, never by us.
    const optedOutIsNullable: Equals<Contact["optedOutAt"], string | null> = true;
    expect(optedOutIsNullable).toBe(true);
  });

  it("carries the two [ASSUMED] fields the API will need — slug (AS-03) and templateId (AS-02)", () => {
    const slugIsString: Equals<ContactCard["slug"], string> = true;
    // I-1: a card's templateId is exactly a registry key, so `TEMPLATES[card.templateId]`
    // can never be undefined.
    const templateIdIsTemplateId: Equals<ContactCard["templateId"], TemplateId> = true;

    expect(slugIsString).toBe(true);
    expect(templateIdIsTemplateId).toBe(true);
  });

  it("models a card as a filter over ProfileFields — fieldIds, not a join entity (§5.3)", () => {
    const card: ContactCard = {
      id: "card_minimal_demo",
      userId: "user_prya",
      name: "Work",
      type: "BUSINESS",
      isSensitive: false,
      slug: "prya-hq",
      templateId: "meridian",
      fieldIds: ["field_phone", "field_email"],
      updatedAt: "2026-08-01T09:00:00.000Z",
    };

    expect(card.fieldIds).toHaveLength(2);
  });

  it("accepts an as-const-frozen fixture module without a cast (§10.3)", () => {
    // §10.3: "Fixtures are typed against src/types/domain.ts and `as const`-frozen." That only
    // holds if the array-valued entity fields are `readonly` — `as const` yields readonly
    // tuples, and a readonly array is not assignable to a mutable one.
    //
    // The assignment through a variable is deliberate: a *fresh* object literal gets a
    // freshness exemption from that rule, so `{...} as const satisfies ContactCard` would pass
    // even with `fieldIds: string[]` and prove nothing. What a downstream track actually does
    // is read `CARDS[0]` out of the fixture module and hand it to `resolveCard`, which is the
    // non-fresh path asserted here.
    const CARD_FIXTURE = {
      id: "card_minimal_demo",
      userId: "user_prya",
      name: "Work",
      type: "BUSINESS",
      isSensitive: false,
      slug: "prya-hq",
      templateId: "meridian",
      fieldIds: ["field_phone", "field_email"],
      updatedAt: "2026-08-01T09:00:00.000Z",
    } as const;
    const GROUP_FIXTURE = {
      id: "group_work",
      userId: "user_prya",
      category: "WORK",
      name: "Work",
      fieldIds: ["field_job_title", "field_company"],
    } as const;
    const CONTACT_FIXTURE = {
      id: "contact_dangling",
      ownerId: "user_prya",
      phoneE164: "+919900000001",
      displayName: "Arjun Mehta",
      notes: null,
      source: "MANUAL",
      optedOutAt: null,
      createdAt: "2026-08-02T11:30:00.000Z",
    } as const;

    const card: ContactCard = CARD_FIXTURE;
    const group: FieldGroup = GROUP_FIXTURE;
    const contact: Contact = CONTACT_FIXTURE;

    expect(card.fieldIds).toHaveLength(2);
    expect(group.fieldIds).toHaveLength(2);
    expect(contact.phoneE164).toBe("+919900000001");
  });
});

describe("derived shapes (spec §5.3a, §6.4)", () => {
  it("narrows ResolvedAvatar on `kind` — photo carries a url, monogram carries initials", () => {
    const avatars: ResolvedAvatar[] = [
      { kind: "photo", url: "/portraits/priyanka.png", alt: "Priyanka Raghunathan" },
      { kind: "monogram", initials: "PR" },
    ];

    const narrowed = avatars.map((avatar) =>
      avatar.kind === "photo" ? avatar.url : avatar.initials,
    );

    expect(narrowed).toEqual(["/portraits/priyanka.png", "PR"]);
  });

  it("keeps ResolvedCard.bio nullable so the slot can collapse rather than reserve space (E-06)", () => {
    const bioIsNullable: Equals<ResolvedCard["bio"], string | null> = true;
    expect(bioIsNullable).toBe(true);
  });

  it("carries droppedFieldIds (I-2) and fieldCount (AC-36) on ResolvedCard", () => {
    const droppedIsStringArray: Equals<ResolvedCard["droppedFieldIds"], string[]> = true;
    const fieldCountIsNumber: Equals<ResolvedCard["fieldCount"], number> = true;

    expect(droppedIsStringArray).toBe(true);
    expect(fieldCountIsNumber).toBe(true);
  });

  it("hands the renderer the whole template object, not just its id (§6.4)", () => {
    const templateIsCardTemplate: Equals<ResolvedCard["template"], CardTemplate> = true;
    expect(templateIsCardTemplate).toBe(true);
  });
});

describe("fixture gateway types (spec §6.3)", () => {
  it("declares the five ScreenStates the ?state= switch reaches", () => {
    const SCREEN_STATE_KEYS: Record<ScreenState, true> = {
      success: true,
      loading: true,
      empty: true,
      error: true,
      offline: true,
    };

    expect(Object.keys(SCREEN_STATE_KEYS)).toHaveLength(5);
  });

  it("makes FixtureResult data and error both nullable, so no screen can skip a state", () => {
    const loading: FixtureResult<string[]> = { state: "loading", data: null, error: null };
    const offline: FixtureResult<string[]> = {
      state: "offline",
      data: null,
      error: {
        kind: "network",
        title: "You appear to be offline",
        detail: "Check your connection and try again.",
        retryable: true,
      },
    };

    expect(loading.data).toBeNull();
    expect(offline.error?.retryable).toBe(true);
  });
});

/** A complete, valid template — the shape the assertions below inspect. */
const TEMPLATE_SHAPE: CardTemplate = {
  id: "meridian",
  name: "Meridian",
  blurb: "For work.",
  category: "business",
  paletteId: "sapphire",
  pageHeader: "band",
  type: { nameWeight: 560, nameTracking: -0.028 },
  shape: { buttonShape: "rounded" },
  photoSrc: null,
  qrZone: { plate: "solid" },
};

describe("the CardTemplate taxonomy", () => {
  it("declares the 8 TemplateIds and the 4 TemplateCategories", () => {
    const TEMPLATE_ID_KEYS: Record<TemplateId, true> = {
      meridian: true,
      marigold: true,
    };
    const TEMPLATE_CATEGORY_KEYS: Record<TemplateCategory, true> = {
      business: true,
      personal: true,
    };

    /* Two templates, two categories. There were eight of each, and the eight templates were
       eight colours wearing eight names — which made "which card is this for" and "what colour
       is it" the same decision. Colour is a palette now, chosen independently. */
    expect(Object.keys(TEMPLATE_ID_KEYS)).toHaveLength(2);
    expect(Object.keys(TEMPLATE_CATEGORY_KEYS)).toHaveLength(2);
  });

  it("fails tsc when a Record over TemplateId misses an id — what makes TEMPLATES exhaustive", () => {
    // `TEMPLATES: Record<TemplateId, CardTemplate>` means a declared id without a template is
    // a compile error, so `TEMPLATES[card.templateId]` can never be undefined. This is the
    // tripwire on the union itself.
    // @ts-expect-error `marigold` is missing, so this Record is incomplete.
    const INCOMPLETE: Record<TemplateId, true> = {
      meridian: true,
    };

    expect(Object.keys(INCOMPLETE)).toHaveLength(1);
  });

  /**
   * The face format is FIXED, and this is the type-level statement of it.
   *
   * A `CardTemplate` must offer no way to move anything on the face. There was briefly a
   * `faceLayout` with four compositions, and the eight templates were spread across them —
   * which meant one card centred its portrait, the next put it in a top band, and a third had
   * none. That is not a set of templates; it is a set of different products sharing a name.
   *
   * Asserting the *absence* of these properties is the point: the moment someone reintroduces a
   * layout axis, this fails and they have to justify it here.
   */
  it("gives a template no way to change the face format", () => {
    const template: CardTemplate = TEMPLATE_SHAPE;
    const keys = Object.keys(template);

    for (const forbidden of [
      "faceLayout",
      "background",
      "avatarKind",
      "avatarShape",
      "faceRadius",
      "buttonFill",
      "buttonRadius",
      "textOnMedia",
    ]) {
      expect(keys, `\`${forbidden}\` is format, not palette`).not.toContain(forbidden);
    }
  });

  it("still lets the scan page vary its hero, which is a different object", () => {
    const PAGE_HEADER_KEYS: Record<PageHeader, true> = {
      solid: true,
      band: true,
      quiet: true,
    };
    expect(Object.keys(PAGE_HEADER_KEYS)).toHaveLength(3);
  });

  it("points a template at a validated palette rather than letting it name colours", () => {
    // The single most important property of the new schema. `paletteId` is a union member, so
    // a template physically cannot introduce a colour that
    // `tests/contract/template-palettes.test.ts` has not already proven legible. The old
    // schema inlined a nine-field `palette` object per template, which is what made a
    // contrast regression a review problem rather than a compile-or-test problem.
    const paletteIsAReference: Equals<CardTemplate["paletteId"], PaletteId> = true;
    expect(paletteIsAReference).toBe(true);
  });

  it("leaves weight and tracking as the only typographic dials", () => {
    /* One variable typeface across the product. `nameCase` used to live here and is gone: a
       name set in caps on three cards and sentence case on five is a format difference, and the
       reference card sets the name in sentence case with an uppercase TAG above it. */
    const typeIsPerTemplate: Equals<CardTemplate["type"], TemplateType> = true;
    expect(typeIsPerTemplate).toBe(true);
    expect(Object.keys(TEMPLATE_SHAPE.type).sort()).toEqual(["nameTracking", "nameWeight"]);
  });

  it("pins the QR plate to the single permitted value", () => {
    // Light modules on a dark plate are rejected outright by many decoders, so there is no
    // second option to offer — not even on the Midnight template, whose ground is black.
    const plateIsSolidOnly: Equals<QrZoneSpec["plate"], "solid"> = true;
    expect(plateIsSolidOnly).toBe(true);
  });

  it("keeps photoSrc explicitly nullable, so present-iff-photo stays assertable", () => {
    const photoSrcIsNullable: Equals<CardTemplate["photoSrc"], string | null> = true;
    expect(photoSrcIsNullable).toBe(true);
  });
});

/**
 * The single most important assertion in this file.
 *
 * "Each and every QR card should have a QR." That is enforced by the type checker rather
 * than by review: `CardTemplate.qrZone` is non-optional and has no default, so a template
 * literal that omits it cannot compile.
 */
describe("a template without a QR does not compile", () => {
  const QR_ZONE: QrZoneSpec = { plate: "solid" };

  /** Everything a `CardTemplate` needs except `qrZone`. */
  const TEMPLATE_WITHOUT_QR_ZONE = {
    id: "meridian",
    name: "Meridian",
    blurb: "For work.",
    category: "business",
    paletteId: "sapphire",
    pageHeader: "band",
    type: { nameWeight: 560, nameTracking: -0.028 },
    shape: { buttonShape: "rounded" },
    photoSrc: null,
  } as const;

  it("compiles when qrZone is present", () => {
    const template: CardTemplate = { ...TEMPLATE_WITHOUT_QR_ZONE, qrZone: QR_ZONE };

    expect(template.qrZone.plate).toBe("solid");
  });

  it("fails tsc when qrZone is omitted — the @ts-expect-error below IS the assertion", () => {
    // @ts-expect-error `qrZone` is non-optional with no default, so this literal is missing a
    // required property. The moment that stops being true, TypeScript reports this directive
    // as unused and `pnpm --filter web typecheck` fails — which is the mechanism.
    const template: CardTemplate = { ...TEMPLATE_WITHOUT_QR_ZONE };

    // Reached at runtime only because vitest does not typecheck; `tsc --noEmit` is the gate.
    expect(template).not.toHaveProperty("qrZone");
  });
});
