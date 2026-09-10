/**
 * **The field-type vocabulary** — what each kind is called, what a value of it looks like, and
 * which keyboard to type it on.
 *
 * ## Why this is its own module
 * Three surfaces ask an owner about a field type: the profile's add-field dialog, the profile's
 * group editor, and the builder's one-line field composer. They must agree, or the same kind of
 * field is called two different things one screen apart. This used to live inside
 * `add-field-popover.tsx` and be imported *from* the builder, which made a component file the
 * home of shared vocabulary — so replacing that component meant moving the vocabulary too.
 * It is data, it belongs beside no particular control, and it lives here.
 */

import type { FieldType } from "@/types/domain";

/** All 21 `FieldType`s in the owner's language. Total by annotation, so none can be missed. */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  PHONE: "Mobile number",
  LANDLINE: "Landline",
  FAX: "Fax",
  EMAIL: "Email",
  ADDRESS: "Address",
  URL: "Website",
  SOCIAL_LINK: "Social link",
  PHOTO: "Photo",
  TEXT: "Note",
  DATE: "Date",
  JOB_TITLE: "Job title",
  COMPANY: "Company",
  REG_NUMBER: "Registration number",
  DEPARTMENT: "Team",
  RELATION: "Relation",
  STATUS: "Status",
  LOCATION_TRACKING: "Location sharing",
  BANK_ACCOUNT: "Bank account",
  DIGITAL_WALLET: "Digital wallet",
  CRYPTO_WALLET: "Crypto wallet",
  CUSTOM: "Custom",
};

/**
 * **What a value of each kind looks like** — the placeholder.
 *
 * ⚠ **Reserved domains only.** These are demo values on a real screen, so they follow the same
 * rule the fixtures do (RFC 2606 / 6761 — `example`, `.example`, `.invalid`). The hygiene suite
 * walks `FIXTURE_DB` rather than source, so it will not catch a real domain typed here; that is
 * a reason to be careful, not a licence.
 *
 * ⚠ **The four structured kinds get no placeholder.** `BANK_ACCOUNT`, `DIGITAL_WALLET`,
 * `CRYPTO_WALLET` and `PHOTO` are not free text — they have their own editors, and a one-line
 * example would teach the wrong shape. Empty string means "no hint", not "no entry".
 */
export const FIELD_TYPE_PLACEHOLDERS: Record<FieldType, string> = {
  PHONE: "+91 98765 43210",
  LANDLINE: "+91 22 2612 3456",
  FAX: "+91 22 2612 3457",
  EMAIL: "you@example.com",
  ADDRESS: "Flat 12, Sunder Nagar, Mumbai 400018",
  URL: "yourstudio.example",
  SOCIAL_LINK: "linkedin.com/in/yourname",
  PHOTO: "",
  TEXT: "Anything you want on the card",
  DATE: "8 March 1991",
  JOB_TITLE: "Head of Partnerships",
  COMPANY: "Fernwood Studio",
  REG_NUMBER: "U74999MH2019PTC123456",
  DEPARTMENT: "Revenue & Alliances",
  RELATION: "Brother",
  STATUS: "Taking partnership intros this quarter",
  LOCATION_TRACKING: "Sharing with saved contacts",
  BANK_ACCOUNT: "",
  DIGITAL_WALLET: "",
  CRYPTO_WALLET: "",
  CUSTOM: "Anything you want on the card",
};

/**
 * The on-screen keyboard each kind should summon.
 *
 * ⚠ `inputMode`, not `type`. `type="email"` and `type="url"` bring native constraint validation
 * with them, which would silently block a submit these forms validate themselves — and the two
 * disagree: the form's own rule is "not blank", the browser's is a full grammar. `inputMode`
 * changes the phone keyboard and nothing else, which is the whole benefit and none of the risk.
 *
 * `undefined` means the ordinary text keyboard.
 */
export const FIELD_TYPE_INPUT_MODES: Partial<
  Record<FieldType, "tel" | "email" | "url" | "numeric">
> = {
  PHONE: "tel",
  LANDLINE: "tel",
  FAX: "tel",
  EMAIL: "email",
  URL: "url",
  SOCIAL_LINK: "url",
};

/**
 * ⚠ **`PHOTO` is not addable and is absent from every list below.**
 *
 * `POST /profile/fields` rejects it outright — `CreateProfileFieldDto`'s own note is *"`PHOTO`
 * is rejected here — use `POST /profile/photo`"* — and the avatar slot consumes it, so it never
 * renders as a row either (§6.6). Offering it in a picker was a guaranteed round-trip to a
 * server error for anyone who chose it. The one type a person might go looking for gets a
 * sentence pointing at the avatar instead; see {@link PHOTO_REDIRECT_HINT}.
 */
export const PHOTO_REDIRECT_HINT =
  "To change your picture, use the avatar at the top of your profile.";

/**
 * The eight an owner reaches for first, shown as a visible row of choices.
 *
 * A dropdown of 20 hides all of them behind a click and orders them by nothing a reader can
 * see. These eight cover the ordinary case without opening anything.
 */
export const COMMON_TYPES: readonly FieldType[] = [
  "PHONE",
  "EMAIL",
  "ADDRESS",
  "URL",
  "SOCIAL_LINK",
  "JOB_TITLE",
  "COMPANY",
  "TEXT",
];

/** The remaining twelve, behind a disclosure. `PHOTO` is deliberately not among them. */
export const MORE_TYPES: readonly FieldType[] = [
  "LANDLINE",
  "FAX",
  "DATE",
  "DEPARTMENT",
  "REG_NUMBER",
  "RELATION",
  "STATUS",
  "LOCATION_TRACKING",
  "BANK_ACCOUNT",
  "DIGITAL_WALLET",
  "CRYPTO_WALLET",
  "CUSTOM",
];

/** Every addable type, in picker order. */
export const TYPE_ORDER: readonly FieldType[] = [...COMMON_TYPES, ...MORE_TYPES];

const KNOWN_TYPES: ReadonlySet<string> = new Set<string>(TYPE_ORDER);

/**
 * Narrowing beats casting: the label registry is total, so a value outside the set would
 * otherwise index it with a lie.
 */
export function toFieldType(value: string, fallback: FieldType): FieldType {
  return KNOWN_TYPES.has(value) ? (value as FieldType) : fallback;
}

/** The three `isMaskedField()` masks whatever any switch says (§7.3). */
export const ALWAYS_MASKED_TYPES: readonly FieldType[] = [
  "BANK_ACCOUNT",
  "DIGITAL_WALLET",
  "CRYPTO_WALLET",
];

export function isAlwaysMasked(type: FieldType): boolean {
  return ALWAYS_MASKED_TYPES.includes(type);
}

/**
 * Types whose own name makes a poor row label, so the owner is asked for one.
 *
 * A row reading "Custom" or "Note" tells a reader nothing; "Studio motto" does. Every other
 * type names itself perfectly well — a row called "Email" holding an email address needs no
 * further explanation, which is the whole reason the name input is not shown for it.
 */
export function needsOwnName(type: FieldType): boolean {
  return type === "CUSTOM" || type === "TEXT";
}
