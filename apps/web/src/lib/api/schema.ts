/**
 * Exact mirrors of the 48 schemas in `GET /api/docs-json` (ContactBook API 1.0).
 *
 * ## The rule for this file
 * These types describe **what the wire actually carries** — nothing more. No convenience
 * unions, no derived fields, no renamed keys. When the API and the UI disagree about a
 * shape, the disagreement is resolved in `map.ts`, never here, so that a spec diff always
 * shows up as a type error in exactly one file.
 *
 * ## Two transcription notes
 * 1. NestJS's Swagger plugin emits `type: 'object', nullable: true` for a nullable string
 *    (`MeIdentityDto.firstName`, `ContactResponseDto.notes`, and nine others). The spec is
 *    lying about the type, not the nullability — every one of them is `string | null` on
 *    the wire. They are written as `string | null` here.
 * 2. `date-time` formats are ISO 8601 strings, kept as `string`. Parsing to `Date` is a
 *    presentation concern and belongs at the point of formatting, not at the boundary.
 */

/* ── Enumerations ────────────────────────────────────────────────────────────────────── */

/**
 * Each enum is declared as a `const` array with the type derived from it, rather than as a
 * bare union.
 *
 * The reason is `tests/contract/api-contract.test.ts`: a TypeScript union is erased at
 * runtime, so a test cannot compare it against the OpenAPI snapshot and a member the API
 * added would go unnoticed until something rendered blank. An array survives compilation,
 * so "our enums match the spec's enums" becomes a machine check instead of a promise.
 *
 * The derived type is exactly what a hand-written union would have been — call sites are
 * unaffected.
 */

/** 7 members. `WORK` here aligns with the UI's `FieldCategory` of the same name. */
export const API_FIELD_CATEGORIES = [
  "IDENTITY",
  "PERSONAL",
  "WORK",
  "BUSINESS",
  "SOCIAL",
  "FINANCIAL",
  "CUSTOM",
] as const;
export type ApiFieldCategory = (typeof API_FIELD_CATEGORIES)[number];

/** 21 members — identical set and spelling to the UI's `FieldType`. */
export const API_FIELD_TYPES = [
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
] as const;
export type ApiFieldType = (typeof API_FIELD_TYPES)[number];

/** Only these four can own a group — deliberately narrower than `ApiFieldCategory`. */
export const API_GROUP_CATEGORIES = ["WORK", "BUSINESS", "SOCIAL", "FINANCIAL"] as const;
export type ApiGroupCategory = (typeof API_GROUP_CATEGORIES)[number];

/**
 * ⚠ `WORK`, not `BUSINESS`. The UI's `CardType` says `BUSINESS` for the same concept; the two
 * are bridged in `map.ts` and nowhere else.
 */
export const API_CARD_KINDS = ["WORK", "PERSONAL", "PAYMENT", "CUSTOM"] as const;
export type ApiCardKind = (typeof API_CARD_KINDS)[number];

export const API_CONTACT_SOURCES = ["MANUAL", "IMPORTED", "QR_SCAN", "INBOUND"] as const;
export type ApiContactSource = (typeof API_CONTACT_SOURCES)[number];

export const API_SHARE_LINK_STATUSES = ["ACTIVE", "REVOKED"] as const;
export type ApiShareLinkStatus = (typeof API_SHARE_LINK_STATUSES)[number];

export const API_TEMPLATE_PURPOSES = ["OTP", "CARD_SHARE"] as const;
export type ApiTemplatePurpose = (typeof API_TEMPLATE_PURPOSES)[number];

export const API_TEMPLATE_APPROVALS = ["APPROVED", "PENDING", "REJECTED", "UNKNOWN"] as const;
export type ApiTemplateApproval = (typeof API_TEMPLATE_APPROVALS)[number];

/* ── Errors ──────────────────────────────────────────────────────────────────────────── */

/** The envelope every non-2xx carries. `code` is the stable one — branch on it, not `message`. */
export interface ApiErrorResponseDto {
  statusCode: number;
  code: string;
  message: string;
  /** Mirrors the `X-Request-Id` response header. Surfaced to the user for support. */
  requestId: string;
  details?: Record<string, unknown>;
}

export interface OkResponseDto {
  ok: boolean;
}

/* ── auth ────────────────────────────────────────────────────────────────────────────── */

export interface RequestOtpDto {
  /** E.164, including the leading `+`. */
  phoneE164: string;
}

export interface RequestOtpResponseDto {
  sent: boolean;
  /**
   * Present ONLY outside production and only when Twilio is unconfigured. The one affordance
   * that lets the whole sign-in flow be exercised without a real WhatsApp message.
   */
  devCode?: string;
}

export interface VerifyOtpDto {
  phoneE164: string;
  /** Six digits. */
  code: string;
}

export interface VerifyOtpResponseDto {
  userId: string;
  /**
   * The same token as the `cb_access_token` cookie. Returned in the body so a non-browser
   * client can authenticate with no cookie jar — which is exactly what our BFF is.
   */
  accessToken: string;
}

export interface RefreshResponseDto {
  accessToken: string;
}

/** Token claims only — `POST /auth/me`. For profile data use `GET /profile/me`. */
export interface AuthMeResponseDto {
  id: string;
  phoneE164: string;
}

/* ── profile ─────────────────────────────────────────────────────────────────────────── */

export interface MeIdentityDto {
  firstName: string | null;
  lastName: string | null;
  /** The OTP-verified phone. Never independently editable. */
  primaryPhone: string;
  primaryEmail: string | null;
  profilePhoto: string | null;
}

export interface ProfileFieldResponseDto {
  id: string;
  category: ApiFieldCategory;
  type: ApiFieldType;
  label: string;
  /**
   * ⚠ Always a scalar string, even for `ADDRESS` / `BANK_ACCOUNT` / `DIGITAL_WALLET` /
   * `CRYPTO_WALLET`. The API's own Prisma model has 1:1 extension tables carrying the
   * components (street/city/…, bankName/accountNumber/…), but this response does not
   * serialize them — so the structured `FieldDetail` the UI wants cannot be reconstructed
   * from here. `map.ts` documents how that degrades; see `docs/INTEGRATION.md` ask #3.
   *
   * Financial types arrive decrypted — this is the owner's own view of their own data.
   */
  value: string;
  position: number;
  /** Set when this field belongs to one instance of a repeatable thing (a specific job). */
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileFieldGroupResponseDto {
  id: string;
  category: ApiGroupCategory;
  /** The instance's human name — "Kestrel Telecom", "HDFC savings". The UI calls this `name`. */
  tag: string | null;
  position: number;
  /** Already ordered by the API — no client-side regrouping needed. */
  fields: ProfileFieldResponseDto[];
}

export interface MeResponseDto {
  onboardingCompleted: boolean;
  identity: MeIdentityDto;
  /** Ungrouped `PERSONAL`-category fields. */
  personal: ProfileFieldResponseDto[];
  work: ProfileFieldGroupResponseDto[];
  business: ProfileFieldGroupResponseDto[];
  socials: ProfileFieldGroupResponseDto[];
  /** Bank accounts, digital wallets and crypto wallets — all `FINANCIAL`, split by field type. */
  financial: ProfileFieldGroupResponseDto[];
}

/** `POST /profile/onboarding` returns the same shape as `GET /profile/me`. */
export type OnboardingResponseDto = MeResponseDto;

export interface PostalAddressDto {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface OnboardingIdentityDto {
  firstName: string;
  lastName: string;
  /** Required by the API. This is why the signup flow's "Skip for now" had to go. */
  primaryEmail: string;
}

export interface OnboardingPersonalDto {
  custom?: Record<string, string>;
  postalAddress?: PostalAddressDto;
}

export interface OnboardingWorkEntryDto {
  custom?: Record<string, string>;
  tag?: string;
  companyName?: string;
  workTitle?: string;
  workPostalAddress?: PostalAddressDto;
}

export interface OnboardingBusinessEntryDto {
  custom?: Record<string, string>;
  tag?: string;
  businessName?: string;
  businessTitle?: string;
  businessPostalAddress?: PostalAddressDto;
}

export interface OnboardingSocialEntryDto {
  custom?: Record<string, string>;
  tag?: string;
}

export interface OnboardingBankAccountDto {
  tag?: string;
  bankName?: string;
  accountHolder?: string;
  /** Encrypted at rest by the API automatically. */
  accountNumber?: string;
  ifsc?: string;
  currency?: string;
}

export interface OnboardingDigitalWalletDto {
  tag?: string;
  platform?: string;
  /** Encrypted at rest automatically. */
  handleOrLink?: string;
}

export interface OnboardingCryptoWalletDto {
  tag?: string;
  network?: string;
  /** Encrypted at rest automatically. */
  address?: string;
}

export interface OnboardingFinancialDto {
  bankAccounts?: OnboardingBankAccountDto[];
  digitalWallets?: OnboardingDigitalWalletDto[];
  cryptoWallets?: OnboardingCryptoWalletDto[];
}

/**
 * One-shot: 409 `ONBOARDING_ALREADY_COMPLETED` on a second call. Only `identity` is
 * required. Do NOT send `primaryPhone` or `profilePhoto` — both are rejected as unknown
 * properties by the validation pipe.
 */
export interface CompleteOnboardingDto {
  identity: OnboardingIdentityDto;
  personal?: OnboardingPersonalDto;
  work?: OnboardingWorkEntryDto[];
  business?: OnboardingBusinessEntryDto[];
  socials?: OnboardingSocialEntryDto[];
  financial?: OnboardingFinancialDto;
}

export interface CreateProfileFieldDto {
  category: ApiFieldCategory;
  /** `PHOTO` is rejected here — use `POST /profile/photo`. */
  type: ApiFieldType;
  label: string;
  value: string;
  /** Defaults to last position when omitted. */
  position?: number;
  groupId?: string;
}

/** `type` is absent by design — it is immutable; delete and recreate to change it. */
export interface UpdateProfileFieldDto {
  category?: ApiFieldCategory;
  label?: string;
  value?: string;
  position?: number;
}

export interface ReorderProfileFieldsDto {
  /** All-or-nothing: one foreign id and nothing is reordered (403 `PROFILE_FIELD_NOT_OWNED`). */
  orderedIds: string[];
}

export interface CreateProfileFieldGroupDto {
  category: ApiGroupCategory;
  tag?: string;
}

export interface UpdateProfileFieldGroupDto {
  category?: ApiGroupCategory;
  tag?: string;
}

export interface PhotoResponseDto {
  id: string;
  url: string;
}

/* ── contacts ────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠ An **outbound recipient**, not a saved lead. This carries a phone number and your
 * private note about it — no job title, no company, no email, because the API never
 * collects those. The UI's old inbound `Contact` (with `fields[]`) has no source here.
 */
export interface ContactResponseDto {
  id: string;
  phoneE164: string;
  displayName: string | null;
  /** Private to the owner — never shown to the contact. */
  notes: string | null;
  source: ApiContactSource;
  /** Set when they texted STOP. Blocks future sends; existing links stay live. */
  optedOutAt: string | null;
  createdAt: string;
}

/** Upserts on `(you, phoneE164)` — a repeat call updates rather than 409s. */
export interface UpsertContactDto {
  phoneE164: string;
  displayName?: string;
  notes?: string;
}

export interface UpdateContactDto {
  displayName?: string;
  notes?: string;
}

export interface ImportContactEntryDto {
  phoneE164: string;
  displayName?: string;
}

export interface ImportContactsDto {
  contacts: ImportContactEntryDto[];
}

export interface ImportContactsResponseDto {
  /** Numbers that were not already in the registry. */
  created: ContactResponseDto[];
  /** Numbers already present — `displayName` refreshed from the import when provided. */
  updated: ContactResponseDto[];
}

/* ── cards ───────────────────────────────────────────────────────────────────────────── */

export interface CardFieldResponseDto {
  fieldId: string;
  category: ApiFieldCategory;
  type: ApiFieldType;
  /** `labelOverride` when set on this card, else the field's own label. */
  label: string;
  value: string;
  visible: boolean;
  position: number;
}

/**
 * ⚠ Carries no appearance. `templateId`, `paletteId`, `groundHex`, `surfaceStyle`,
 * `patternId`, `headerLayout` and `slug` all exist on the UI's `ContactCard` and none of
 * them exist here. Appearance is derived from `kind` in `map.ts` for the demo.
 */
/**
 * A card's saved design, as the API stores it — the seven axes of the material system.
 *
 * ⚠ `templateId` and `paletteId` are **enum-validated server-side** against exactly this build's
 * vocabulary, so an unknown id is a 400, not a stored surprise. The remaining five are plain
 * `text` columns with no server-side check: nothing stops a bad value being written, so the
 * reader validates (`toContactCard`, `parsePublicCard`) rather than trusting the column.
 *
 * Every axis is independently optional. `null`/absent means "this card never chose", which the
 * readers answer with `appearanceForKind(kind)` — so a card that picked only a colour keeps its
 * template's finish instead of being reset to a global default.
 */
export interface CardAppearanceDto {
  templateId?: string | null;
  paletteId?: string | null;
  /** `#RRGGBB`. Overrides `paletteId` when set. */
  groundHex?: string | null;
  finish?: string | null;
  texture?: string | null;
  texturePresence?: string | null;
  textureScale?: string | null;
}

export interface CardResponseDto extends CardAppearanceDto {
  id: string;
  name: string;
  kind: ApiCardKind;
  /**
   * The card's own public URL — what its QR encodes. Independent of any recipient: it exists
   * from the moment the card is created, before it has been shared with anyone, and revoking
   * one recipient's link never affects it.
   *
   * Always the **full URL**, never a bare token. Assembling a public URL is the API's job, not
   * ours — the previous `${SITE_URL}/c/${slug}` guess this replaces is exactly what happens
   * when the two sides each hold half the answer.
   *
   * ⚠ **Optional on purpose.** `Card.publicToken` exists in the API repo but is not on staging
   * yet, so a live `GET /cards` comes back without this key. Typing it as required made the
   * compiler certify a guarantee the wire does not give, and a card list then crashed on
   * `undefined` reaching the URL formatter. `toContactCard` coalesces it to `null` — the one
   * boundary where the absence is turned into the domain's "not published yet".
   *
   * Make this required only once staging's `/api/docs-json` lists it.
   */
  publicUrl?: string;
  fields: CardFieldResponseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCardDto extends CardAppearanceDto {
  name: string;
  kind?: ApiCardKind;
}

export interface UpdateCardDto extends CardAppearanceDto {
  name?: string;
  kind?: ApiCardKind;
}

export interface CardFieldEntryDto {
  /** Must be one of your own non-archived, non-`PHOTO` profile fields. */
  fieldId: string;
  visible?: boolean;
  labelOverride?: string;
}

/** ⚠ REPLACES the whole set. Send everything to keep, not just what changed. */
export interface SetCardFieldsDto {
  fields: CardFieldEntryDto[];
}

export interface ShareCardDto {
  /** ⚠ Required. There is no anonymous share link — every link is bound to one contact. */
  contactId: string;
}

/* ── share-links ─────────────────────────────────────────────────────────────────────── */

export interface ShareLinkResponseDto {
  id: string;
  /** What goes in the WhatsApp message. Resolves live — never a snapshot. */
  url: string;
  cardId: string;
  cardName: string;
  contactId: string;
  contactPhoneE164: string;
  contactDisplayName: string | null;
  status: ApiShareLinkStatus;
  viewCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  createdAt: string;
}

/** `REVOKED` immediately 410s the public link; `ACTIVE` restores the *same* token. */
export interface UpdateShareLinkDto {
  status: ApiShareLinkStatus;
}

/* ── whatsapp-templates ──────────────────────────────────────────────────────────────── */

export interface WhatsAppTemplateResponseDto {
  id: string;
  key: string;
  purpose: ApiTemplatePurpose;
  contentSid: string;
  locale: string;
  bodyPreview: string;
  buttonLabel: string | null;
  variableSchema: Record<string, string>;
  approvalStatus: ApiTemplateApproval;
  rejectionReason: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateWhatsAppTemplateDto {
  key: string;
  purpose: ApiTemplatePurpose;
  /** The ContentSid Twilio assigned. Registering here does not create anything in Twilio. */
  contentSid: string;
  locale?: string;
  bodyPreview: string;
  buttonLabel?: string;
  variableSchema: Record<string, string>;
  approvalStatus?: ApiTemplateApproval;
}

export interface UpdateWhatsAppTemplateDto {
  approvalStatus?: ApiTemplateApproval;
  rejectionReason?: string;
  isActive?: boolean;
}
