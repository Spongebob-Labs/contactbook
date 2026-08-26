/**
 * The §11 hostile-content set — the fixtures the `edge` dimension is written against.
 *
 * Every constant here corresponds to a numbered row of spec §11 and is named for it, so a
 * failing edge test can be traced back to the row it defends. Nothing in this file is
 * reachable from the ordinary app surface: `FIXTURE_DB` does not include it, and screens
 * must import it explicitly.
 *
 * The two extremes Vansh selected at Q31 — **40+ character names / titles / companies** and
 * **missing or broken media** — lead the file. The empty-card set (E-01…E-04) follows,
 * carried here because §11.6 records the zero-mapping card as a *shipped production bug*,
 * not a hypothetical.
 */

import type { ContactCard, ProfileField, FieldGroup, User } from "@/types/domain";
import { cardEmptyDemo } from "@/fixtures/cards";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";

/* ── §11.2 long content ─────────────────────────────────────────────────────────────── */

/** 42 characters. E-10: wraps to at most 2 lines, then clamps; the QR zone does not move. */
export const LONG_NAME = "Arjun Venkataraghavan-Balasubramanian Iyer";

/** 44 characters. E-11: clamps to 1 line in the bio composition; full text in `title`. */
export const LONG_JOB_TITLE = "Head of Strategic Partnerships and Alliances";

/** 53 characters. E-12: in "{title} at {company}" the company truncates first. */
export const LONG_COMPANY = "Fernwood Studio Interactive Technologies Private Ltd";

/** 62 characters, no whitespace. E-15: `overflow-wrap: anywhere`, never a horizontal scroll. */
export const UNBROKEN_TOKEN =
  "https://fernwood.example/p/priyanka-raghunathan-venkataraghavan";

/** E-52: `,` `;` and `\` all reach the `.vcf` and must be escaped per RFC 2426. */
export const PUNCTUATED_VALUE = "Suite 4, Level 2; Anand Complex \\ Andheri East";

/** E-51: rendered as text. Raw-HTML injection exists nowhere in this codebase (§7.3, AC-32). */
export const XSS_VALUE = "<script>alert('contact-book')</script>";

/** E-16: 218 characters, so the `.vcf` NOTE line folds at 75 octets. */
export const LONG_NOTE =
  "Met at the Lisbon summit in June; introduced by Arjun, who runs network partnerships at Kestrel. Follow up about the settlement rails pilot before the end of the quarter and copy the treasury team in on the thread.";

/** E-55: a 56-character action label that must clamp to 1 line inside a 52px button. */
export const LONG_BUTTON_LABEL = "Save this contact straight to your phone address book";

/* ── §11.3 missing and broken media ─────────────────────────────────────────────────── */

/** E-20: a same-origin path that 404s, so `onError` swaps to the monogram with no shift. */
export const BROKEN_IMAGE_URL = "/portraits/missing-portrait.png";

/** E-21: a template `backgroundSrc` that 404s, so the palette ground takes over. */
export const BROKEN_BACKGROUND_SRC = "/templates/missing-background.png";

/* ── users ──────────────────────────────────────────────────────────────────────────── */

/** E-10 / E-13 / E-14: the 40+ character name, everywhere a name is rendered. */
export const extremeUserLongName: User = {
  ...fixtureUser,
  id: "user_x_long_name",
  firstName: "Arjun",
  lastName: "Venkataraghavan-Balasubramanian Iyer",
  email: "arjun@kestreltelecom.example",
  /** PLACEHOLDER-ART — procedurally generated, see the run-log. */
  avatarUrl: "/portraits/arjun.png",
} as const satisfies User;

/** E-19: no avatar and no mapped `PHOTO` — the monogram is the only correct render. */
export { fixtureUserNoAvatar as extremeUserNoAvatar } from "@/fixtures/user";

/** E-20: the avatar 404s. Same 80px box, monogram fallback, `alt` present either way. */
export const extremeUserBrokenAvatar: User = {
  ...fixtureUser,
  id: "user_x_broken_avatar",
  avatarUrl: BROKEN_IMAGE_URL,
} as const satisfies User;

/**
 * §5.3a avatar precedence: `avatarUrl` is `null`, but a mapped `PHOTO` field supplies the
 * image, so this user must render a photo and not a monogram.
 */
export const extremeUserPhotoOverride: User = {
  ...fixtureUser,
  id: "user_x_photo",
  firstName: "Mei",
  lastName: "Nakamura",
  email: "mei@hinoki.example",
  avatarUrl: null,
} as const satisfies User;

/* ── the hostile fields, and the profile they belong to ─────────────────────────────── */

export const hostileFields: readonly ProfileField[] = [
  {
    id: "field_x_long_title",
    groupId: "group_extremes",
    type: "JOB_TITLE",
    label: "Role",
    value: LONG_JOB_TITLE,
    isSensitive: false,
  },
  {
    id: "field_x_long_company",
    groupId: "group_extremes",
    type: "COMPANY",
    label: "Company",
    value: LONG_COMPANY,
    isSensitive: false,
  },
  {
    id: "field_x_unbroken",
    groupId: "group_extremes",
    type: "URL",
    label: "Profile link",
    value: UNBROKEN_TOKEN,
    isSensitive: false,
  },
  {
    id: "field_x_punctuated",
    groupId: "group_extremes",
    type: "TEXT",
    label: "Delivery note",
    value: PUNCTUATED_VALUE,
    isSensitive: false,
  },
  {
    id: "field_x_script",
    groupId: "group_extremes",
    type: "TEXT",
    label: "Note",
    value: XSS_VALUE,
    isSensitive: false,
  },
  {
    id: "field_x_long_note",
    groupId: "group_extremes",
    type: "TEXT",
    label: "Long note",
    value: LONG_NOTE,
    isSensitive: false,
  },
  {
    /** PLACEHOLDER-ART — procedurally generated, see the run-log. */
    id: "field_x_photo",
    groupId: "group_extremes",
    type: "PHOTO",
    label: "Profile photo",
    value: "/portraits/mei.png",
    isSensitive: false,
  },
  {
    id: "field_x_email",
    groupId: "group_extremes",
    type: "EMAIL",
    label: "Email",
    value: "arjun@kestreltelecom.example",
    isSensitive: false,
  },
  {
    id: "field_x_url",
    groupId: "group_extremes",
    type: "URL",
    label: "Website",
    value: "https://kestreltelecom.example",
    isSensitive: false,
  },
] as const satisfies readonly ProfileField[];

const extremeGroup: FieldGroup = {
  id: "group_extremes",
  userId: fixtureUser.id,
  category: "CUSTOM",
  name: "Extremes",
  fieldIds: hostileFields.map((field) => field.id),
} as const satisfies FieldGroup;

/** The ordinary profile plus the hostile group — pass this wherever a resolver wants fields. */
export const extremeFields: readonly ProfileField[] = [...fixtureFields, ...hostileFields];
export const extremeGroups: readonly FieldGroup[] = [...fixtureGroups, extremeGroup];

/* ── §11.1 the field-count extremes ─────────────────────────────────────────────────── */

/**
 * E-01 / E-02 — a card mapping **zero** fields. Re-exported rather than duplicated: the
 * zero-field card is a permanent app fixture (`cards.ts`), and the edge suites should test
 * the one the product actually ships.
 */
export { cardEmptyDemo as cardZeroFields } from "@/fixtures/cards";

/** E-03: exactly one field. The row must not stretch and the QR zone keeps its region. */
export const cardOneField: ContactCard = {
  id: "card_x_one_field",
  userId: fixtureUser.id,
  name: "One field",
  type: "BUSINESS",
  isSensitive: false,
  slug: "x-one-field",
  templateId: "meridian",
  fieldIds: ["field_work_email"],
  updatedAt: "2026-08-19T09:00:00.000Z",
} as const satisfies ContactCard;

/** E-04: 26 fields. The field list scrolls within its slot; the QR zone never moves. */
export const cardManyFields: ContactCard = {
  id: "card_x_many_fields",
  userId: fixtureUser.id,
  name: "Everything",
  type: "BUSINESS",
  isSensitive: true,
  slug: "x-many-fields",
  templateId: "meridian",
  fieldIds: [
    "field_photo",
    "field_bio",
    "field_dob",
    "field_mobile",
    "field_personal_email",
    "field_home_address",
    "field_home_landline",
    "field_relation",
    "field_status",
    "field_location",
    "field_job_title",
    "field_company",
    "field_department",
    "field_work_email",
    "field_work_phone",
    "field_site_url",
    "field_desk_landline",
    "field_fax",
    "field_work_address",
    "field_gstin",
    "field_cin",
    "field_press_url",
    "field_linkedin",
    "field_x",
    "field_instagram",
    "field_github",
  ],
  updatedAt: "2026-08-17T09:00:00.000Z",
} as const satisfies ContactCard;

/** E-10…E-12, E-15: every long-content case on one card. */
export const cardLongContent: ContactCard = {
  id: "card_x_long_content",
  userId: extremeUserLongName.id,
  name: "Long content",
  type: "BUSINESS",
  isSensitive: false,
  slug: "x-long-content",
  templateId: "marigold",
  fieldIds: [
    "field_x_long_title",
    "field_x_long_company",
    "field_x_unbroken",
    "field_work_email",
  ],
  updatedAt: "2026-08-16T09:00:00.000Z",
} as const satisfies ContactCard;

/** E-51, E-52, E-16: script-shaped, punctuated and over-long values on one card. */
export const cardHostileContent: ContactCard = {
  id: "card_x_hostile",
  userId: fixtureUser.id,
  name: "Hostile content",
  type: "CUSTOM",
  isSensitive: false,
  slug: "x-hostile",
  templateId: "marigold",
  fieldIds: [
    "field_x_script",
    "field_x_punctuated",
    "field_x_long_note",
    "field_work_email",
  ],
  updatedAt: "2026-08-15T09:00:00.000Z",
} as const satisfies ContactCard;

/**
 * E-40 / I-2: two of these ids are not in any profile. `resolveCard` drops them silently
 * into `droppedFieldIds` — never a ghost row, never a crash.
 */
export const cardDanglingFieldIds: ContactCard = {
  id: "card_x_dangling",
  userId: fixtureUser.id,
  name: "Dangling ids",
  type: "BUSINESS",
  isSensitive: false,
  slug: "x-dangling",
  templateId: "meridian",
  fieldIds: ["field_work_email", "field_deleted_by_user", "field_also_deleted"],
  updatedAt: "2026-08-13T09:00:00.000Z",
} as const satisfies ContactCard;

/** E-56: no `PHONE` mapped, so the WhatsApp action is absent rather than disabled. */
export const cardNoPhone: ContactCard = {
  id: "card_x_no_phone",
  userId: fixtureUser.id,
  name: "No phone",
  type: "BUSINESS",
  isSensitive: false,
  slug: "x-no-phone",
  templateId: "marigold",
  fieldIds: ["field_x_email", "field_x_url"],
  updatedAt: "2026-08-10T09:00:00.000Z",
} as const satisfies ContactCard;

/** §5.3a: a mapped `PHOTO` outranks `User.avatarUrl`, even when the user has none. */
export const cardPhotoOverride: ContactCard = {
  id: "card_x_photo",
  userId: extremeUserPhotoOverride.id,
  name: "Photo override",
  type: "PERSONAL",
  isSensitive: false,
  slug: "x-photo",
  templateId: "meridian",
  fieldIds: ["field_x_photo", "field_work_email"],
  updatedAt: "2026-08-07T09:00:00.000Z",
} as const satisfies ContactCard;

/**
 * Every extreme card, for the AC-08 sweep.
 *
 * `cardZeroFields` is deliberately absent: it is `cards.ts`'s `card_empty_demo` and is
 * already swept there. Listing it twice would double-count it and make the id-uniqueness
 * assertion in `tests/contract/fixtures.test.ts` fail for a bookkeeping reason.
 */
export const extremeCards: readonly ContactCard[] = [
  cardOneField,
  cardManyFields,
  cardLongContent,
  cardHostileContent,
  cardDanglingFieldIds,
  cardNoPhone,
  cardPhotoOverride,
];

/** Kept explicit so a reader can see the zero-field card is part of the edge set. */
export const extremeCardCount = extremeCards.length + [cardEmptyDemo].length;
