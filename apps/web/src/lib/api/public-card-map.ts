import "server-only";

/**
 * A public share-link payload → the domain shapes the card renderer already speaks.
 *
 * ## Why map rather than write a new renderer
 * The stranger's view of a card should be *the card* — the same designed face, the same field rows,
 * the same ordering the owner sees. All of that already exists in `resolveCard` + `<CardPage>`, and
 * both take domain objects. So the honest amount of work here is a translation, not a second
 * rendering path that could drift from the first.
 *
 * The objects built below are **synthetic**: a stranger is not given the owner's profile, so there
 * are no real `ProfileField` ids or `FieldGroup`s. They are fabricated to carry what the payload
 * did send, in the shape `resolveCard` needs, and nothing here is persisted or sent anywhere.
 */

import type { PublicCardPayload } from "@/lib/api/public-card";
import { resolveCard } from "@/card/resolve-card";
import type {
  CardType,
  ContactCard,
  FieldCategory,
  FieldGroup,
  FieldType,
  ProfileField,
  ResolvedCard,
  User,
} from "@/types/domain";

/** The 21 `FieldType`s, so an unrecognised string from the wire becomes `CUSTOM` rather than a crash. */
const FIELD_TYPES = new Set<string>([
  "PHONE", "LANDLINE", "FAX", "EMAIL", "ADDRESS", "URL", "SOCIAL_LINK", "PHOTO", "TEXT", "DATE",
  "JOB_TITLE", "COMPANY", "REG_NUMBER", "DEPARTMENT", "RELATION", "STATUS", "LOCATION_TRACKING",
  "BANK_ACCOUNT", "DIGITAL_WALLET", "CRYPTO_WALLET", "CUSTOM",
]);

/**
 * Which section a field lands in.
 *
 * A public payload carries a field's *type* but not its category, and `resolveCard` orders by
 * category — so one has to be inferred. This is a presentation default for a snapshot, not a claim
 * about the owner's profile: it decides which heading a row sits under and nothing else.
 */
const CATEGORY_FOR_TYPE: Readonly<Record<string, FieldCategory>> = {
  PHOTO: "IDENTITY", TEXT: "IDENTITY", DATE: "IDENTITY",
  PHONE: "PERSONAL", LANDLINE: "PERSONAL", FAX: "PERSONAL", EMAIL: "PERSONAL",
  ADDRESS: "PERSONAL", RELATION: "PERSONAL", STATUS: "PERSONAL", LOCATION_TRACKING: "PERSONAL",
  JOB_TITLE: "WORK", COMPANY: "WORK", DEPARTMENT: "WORK", URL: "WORK",
  REG_NUMBER: "BUSINESS",
  SOCIAL_LINK: "SOCIAL",
  BANK_ACCOUNT: "FINANCIAL", DIGITAL_WALLET: "FINANCIAL", CRYPTO_WALLET: "FINANCIAL",
  CUSTOM: "CUSTOM",
};

const CARD_TYPES = new Set<string>(["BUSINESS", "PERSONAL", "PAYMENT", "CUSTOM"]);

/** `WORK` (the API's word) → `BUSINESS` (the UI's), then a safe default. */
function cardTypeOf(kind: string | null): CardType {
  if (kind === null) return "PERSONAL";
  const upper = kind.toUpperCase();
  if (upper === "WORK") return "BUSINESS";
  return CARD_TYPES.has(upper) ? (upper as CardType) : "PERSONAL";
}

/**
 * Build a `ResolvedCard` from a public payload.
 *
 * @param shareUrl the link the reader is on — used as the card's own QR payload, so the code on
 * screen encodes the page it is already on rather than a fabricated origin.
 */
export function resolvePublicCard(
  payload: PublicCardPayload,
  shareUrl: string,
): ResolvedCard {
  const [firstName = "", ...rest] = payload.fullName.trim().split(/\s+/);

  const user: User = {
    id: "public",
    email: null,
    // A stranger is never given the owner's number, and nothing on this page needs one.
    phone: "",
    countryCode: "",
    firstName,
    lastName: rest.join(" "),
    isActive: true,
    onboardingCompleted: true,
    avatarUrl: payload.avatarUrl,
  };

  const fields: ProfileField[] = payload.fields.map((field, index) => {
    const type = (FIELD_TYPES.has(field.type.toUpperCase())
      ? field.type.toUpperCase()
      : "CUSTOM") as FieldType;
    return {
      id: `public-${index}`,
      groupId: `public-group-${CATEGORY_FOR_TYPE[type] ?? "CUSTOM"}`,
      type,
      label: field.label.length > 0 ? field.label : type,
      value: field.value,
      /**
       * ⚠ Always `false`, and masking still holds.
       *
       * A snapshot carries no sensitivity flag, so this cannot be honoured from the payload. It
       * does not need to be: the renderer masks `BANK_ACCOUNT`, `DIGITAL_WALLET` and
       * `CRYPTO_WALLET` by **type**, in its own registry, and there is no reveal control on this
       * page at all. Masking is therefore a property of the type here, not of a flag a payload
       * could omit.
       */
      isSensitive: false,
    };
  });

  // One synthetic group per category present, so `resolveCard`'s ordering has something to sort by.
  const groups: FieldGroup[] = [...new Set(fields.map((f) => f.groupId))].map((groupId) => ({
    id: groupId,
    userId: user.id,
    category: (groupId.replace("public-group-", "") as FieldCategory) ?? "CUSTOM",
    name: groupId,
    fieldIds: fields.filter((f) => f.groupId === groupId).map((f) => f.id),
  }));

  const card: ContactCard = {
    id: "public",
    userId: user.id,
    name: payload.cardName ?? `${payload.fullName}`.trim(),
    type: cardTypeOf(payload.kind),
    isSensitive: false,
    slug: "public",
    // Same derivation the owner's own view uses, so the stranger sees the same card.
    templateId: cardTypeOf(payload.kind) === "PERSONAL" ? "marigold" : "meridian",
    fieldIds: fields.map((f) => f.id),
    updatedAt: new Date(0).toISOString(),
  };

  return resolveCard(card, user, groups, fields, shareUrl);
}
