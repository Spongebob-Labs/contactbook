/**
 * The domain model — spec §5, plus the derived and gateway shapes from §6.3 and §6.4.
 *
 * Frontend-only mirrors of the shapes mined from the previous build. No Prisma, no DB, no
 * persistence: every screen reads fixtures through the gateway (§3.1).
 *
 * Types only. This module imports *from* `@/card/template-types` and is never imported by it.
 */

import type { CardSurface, ResolvedSurface } from "@/card/card-surface";
import type { PaletteId, TemplatePalette } from "@/card/template-palettes";
import type { CardTemplate, TemplateId } from "@/card/template-types";

/* ── §5.1 Enumerations (exactly as the old build defined them) ───────────────────────── */

export type CardType = "BUSINESS" | "PERSONAL" | "PAYMENT" | "CUSTOM";

/**
 * Declaration order is load-bearing: it is the primary sort key of the §6.4 ordering rule,
 * which is what makes a rendered card and its `.vcf` byte-stable.
 */
export type FieldCategory =
  | "IDENTITY"
  | "PERSONAL"
  | "WORK"
  | "BUSINESS"
  | "SOCIAL"
  | "FINANCIAL"
  | "CUSTOM";

/**
 * 21 members. Every one needs a renderer (§6.6, AC-21) and a vCard mapping (§6.7); a missing
 * renderer is a build-time type error, not a runtime blank.
 */
export type FieldType =
  | "PHONE"
  | "LANDLINE"
  | "FAX"
  | "EMAIL"
  | "ADDRESS"
  | "URL"
  | "SOCIAL_LINK"
  | "PHOTO"
  | "TEXT"
  | "DATE"
  | "JOB_TITLE"
  | "COMPANY"
  | "REG_NUMBER"
  | "DEPARTMENT"
  | "RELATION"
  | "STATUS"
  | "LOCATION_TRACKING"
  | "BANK_ACCOUNT"
  | "DIGITAL_WALLET"
  | "CRYPTO_WALLET"
  | "CUSTOM";

/* ── §5.2 Entities ──────────────────────────────────────────────────────────────────── */

export interface User {
  id: string;
  email: string | null;
  phone: string;
  countryCode: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  /**
   * Whether first-time setup is done.
   *
   * A boolean rather than the `profileOnboardingCompletedAt: string | null` timestamp this
   * used to be, because a boolean is all the API knows: `MeResponseDto.onboardingCompleted`.
   * Inventing a completion date to satisfy a nullable-string field would be fabricating data
   * the server never sent — and the timestamp had no readers, so nothing is lost.
   *
   * Load-bearing now: `(app)/layout.tsx` redirects an incomplete profile into `/signup`, and
   * `POST /profile/onboarding` is one-shot (409 on a second call), so this is what decides
   * whether that call may be made at all.
   */
  onboardingCompleted: boolean;
  /** Nullable — §11 E-19 (the monogram fallback) depends on it. Never defaulted. */
  avatarUrl: string | null;
}

export interface FieldGroup {
  id: string;
  userId: string;
  category: FieldCategory;
  name: string;
  fieldIds: readonly string[];
}

export interface ProfileField {
  id: string;
  groupId: string;
  type: FieldType;
  label: string;
  /** Always a plain string at the UI boundary — never a union, never an object (§5.2). */
  value: string;
  isSensitive: boolean;
  /** Present only for the four structured types. */
  detail?: FieldDetail;
}

/**
 * The structured payload behind the four field types whose `value` alone cannot be composed
 * into a display line or a vCard property.
 *
 * Discriminated on `kind`, whose members are the `FieldType`s they belong to, so a renderer
 * narrows with `field.detail?.kind === field.type`.
 */
export type FieldDetail =
  | AddressDetail
  | BankAccountDetail
  | DigitalWalletDetail
  | CryptoWalletDetail;

/** Composed to 1–2 display lines and to the seven-component vCard `ADR` (§6.6, §6.7). */
export interface AddressDetail {
  kind: "ADDRESS";
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
}

/** `accountNumber` renders masked on every public surface — last 4, remainder `••••` (§7.3). */
export interface BankAccountDetail {
  kind: "BANK_ACCOUNT";
  bankName: string;
  accountNumber: string;
  /** IFSC / sort code / routing number, depending on the bank. */
  routingCode: string | null;
}

/** `handle` renders masked on every public surface (§7.3). */
export interface DigitalWalletDetail {
  kind: "DIGITAL_WALLET";
  /** e.g. "UPI", "PayPal", "Apple Pay". */
  provider: string;
  handle: string;
}

/** `address` renders masked on every public surface (§7.3). */
export interface CryptoWalletDetail {
  kind: "CRYPTO_WALLET";
  /** e.g. "Bitcoin", "Ethereum". */
  network: string;
  address: string;
}

/**
 * A card owns no data. A card is a *filter* over `ProfileField`s (§5.3): `name` and `type` are
 * the only content it owns, and `fieldIds` replaces the old `CardFieldMapping` join entity —
 * there is no join entity at the UI boundary.
 *
 * ## Why it extends `CardSurface` rather than re-declaring its four members
 *
 * A card also stores **what it looks like**: `groundHex`, `surfaceStyle`, `patternId` and
 * `headerLayout` — the four axes of the material system, defined once in
 * `@/card/card-surface` and read by three parties that are built separately (the renderer, the
 * palette engine, the builder's Design panel). Transcribing the four names here would give the
 * vocabulary a second home and a second chance to be wrong; `extends` means the card carries
 * exactly what the contract defines, and adding an axis there adds it here.
 *
 * Every member of `CardSurface` is optional, and that is the compatibility guarantee:
 * `resolveCardSurface` applies the defaults in one place, so a card written before this system
 * existed — every fixture included — keeps rendering exactly as it did. `groundHex` absent means
 * "use the palette this card already resolves to", which is what keeps the nine curated palettes
 * as presets instead of flattening them into nine hex strings.
 *
 * ⚠ Cross-boundary flag for the later integration run: the API will need `groundHex`,
 * `surfaceStyle`, `patternId` and `headerLayout` columns.
 */
export interface ContactCard extends CardSurface {
  id: string;
  userId: string;
  name: string;
  type: CardType;
  isSensitive: boolean;
  /**
   * [ASSUMED — spec AS-03] A new field the API does not have yet. The public card URL needs a
   * stable, short, non-enumerable id; ≤ 24 chars, `/^[a-z0-9-]+$/`, so the QR payload stays
   * under 60 bytes and the symbol stays at or below version 6 (AC-08).
   *
   * ⚠ Cross-boundary flag for the later integration run: the API will need a `slug` column.
   */
  slug: string;
  /**
   * [ASSUMED — spec AS-02] A new field the API does not have yet. The old schema had no
   * template column, which is exactly why the old wizard taught a template choice and then
   * threw it away on Create. Typed as `TemplateId` so I-1 holds by construction:
   * `TEMPLATES[card.templateId]` can never be undefined.
   *
   * ⚠ Cross-boundary flag for the later integration run: the API will need a `templateId`
   * column.
   */
  templateId: TemplateId;
  /**
   * The owner's colour choice, independent of the template.
   *
   * ⚠ Cross-boundary flag for the later integration run: the API will need a `paletteId` column.
   *
   * `undefined` means "whatever this template defaults to" — an existing card keeps working, and
   * a card created before the picker existed does not need backfilling.
   *
   * The two axes are separate on purpose. A template is what the card is *for* (which fields it
   * starts with); a palette is what it looks like. They used to be the same field, which meant
   * somebody who wanted a navy personal card had to pick the business template and then change
   * its colour anyway — the model was making them choose twice to express one thing.
   */
  paletteId?: PaletteId;
  /** A subset of the ids reachable through the user's `FieldGroup`s. May dangle (I-2). */
  fieldIds: readonly string[];
  updatedAt: string;
}

/**
 * How a contact got into the registry.
 *
 * `IMPORTED` is the expected path — an address book handed over in one call. `QR_SCAN` and
 * `INBOUND` are the API's names for a contact who arrived by opening a card or replying, rather
 * than by being added.
 */
export type ContactSource = "MANUAL" | "IMPORTED" | "QR_SCAN" | "INBOUND";

/**
 * Someone you can send a card **to**.
 *
 * ## ⚠ This type was inverted, and the inversion is the whole point
 * It used to model a *saved lead*: "someone scanned your card and saved their details back to
 * you", carrying a denormalised `SavedContactField[]` snapshot of their job title, company and
 * email, plus the `sourceCardSlug` of the card they scanned.
 *
 * **The API has no such concept.** `ContactResponseDto` is a phone number, a name you chose for
 * it, and a private note — an *outbound recipient registry*. It collects nothing about the
 * contact, so no screen can show their job title, because the server was never told one.
 *
 * That is not a gap to work around; it is the locked scope. Sharing is a WhatsApp broadcast to
 * numbers you hold, so a contact is an address, and what you know about them is what you
 * yourself typed into `notes`.
 *
 * What *can* be shown per contact is which of your cards you have sent them and whether they
 * opened it — see {@link ContactShare}, joined from `GET /share-links`.
 *
 * ⚠ There is no delete. `POST/GET/PATCH /contacts` and `POST /contacts/import` are the whole
 * surface; `optedOutAt` is the only way a contact goes quiet, and only they can set it.
 */
export interface Contact {
  id: string;
  ownerId: string;
  /**
   * E.164, including the leading `+`.
   *
   * The identity a contact is matched by, and **not editable** — `PATCH /contacts/{id}` accepts
   * only `displayName` and `notes`. A wrong number is corrected by adding the right one, which
   * upserts rather than duplicating.
   */
  phoneE164: string;
  /**
   * What you call them. `null` when an import brought a number with no name — which is common,
   * so every surface needs a fallback rather than a blank cell (see `contactLabel`).
   */
  displayName: string | null;
  /** Private to you. Never shown to the contact, and never sent anywhere. */
  notes: string | null;
  source: ContactSource;
  /**
   * Set when this contact texted STOP.
   *
   * Blocks future sends — but **existing links stay live**, which is the part that surprises
   * people: opting out stops new messages, it does not revoke what they already have. Revoking
   * is a separate, deliberate act on the share link.
   */
  optedOutAt: string | null;
  createdAt: string;
}

/**
 * One card, sent to one contact — a `ShareLink` from the contact's side.
 *
 * Derived, not owned: assembled from `GET /share-links` filtered by `contactId`. It is the only
 * thing the API knows about a contact beyond their number, and it is what makes the broadcast
 * model legible on screen: *which* card they got, whether they opened it, and how often.
 *
 * `url` resolves live rather than being a snapshot, so it keeps working as the underlying card
 * changes — and stops working the moment `status` becomes `REVOKED` (the public link 410s).
 */
export interface ContactShare {
  shareLinkId: string;
  cardId: string;
  cardName: string;
  /** What actually went in the WhatsApp message. Safe to copy and send by hand. */
  url: string;
  status: "ACTIVE" | "REVOKED";
  viewCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  createdAt: string;
}

/**
 * What to call a contact on screen.
 *
 * `displayName` is nullable and an import routinely brings numbers without one, so every surface
 * needs the same fallback — and a blank cell where a name should be reads as a broken row. The
 * number is the honest answer, because it is the only thing that is always there.
 */
export function contactLabel(contact: Pick<Contact, "displayName" | "phoneE164">): string {
  const name = contact.displayName?.trim() ?? "";
  return name.length > 0 ? name : contact.phoneE164;
}

/* ── §5.3a Derived shapes — avatar and bio are DERIVED, not owned ───────────────────── */

/**
 * Source order: the mapped `PHOTO` field's value, else `User.avatarUrl`, else the monogram.
 * `CardTemplate.avatarKind` decides how the slot is *presented*, not what is in it.
 */
export type ResolvedAvatar =
  | { kind: "photo"; url: string; alt: string }
  | { kind: "monogram"; initials: string };

/**
 * A mapped `ProfileField`, carried into the card with the `FieldCategory` of its owning
 * group — the primary key of the §6.4 ordering rule, which a bare `ProfileField` cannot
 * supply.
 */
export interface ResolvedField {
  /** The source `ProfileField.id`. */
  id: string;
  type: FieldType;
  category: FieldCategory;
  label: string;
  /** Never `''` — the resolver excludes blank values entirely (§11 E-07). */
  value: string;
  isSensitive: boolean;
  detail?: FieldDetail;
}

/* ── §6.4 `resolveCard` — the single source of truth for preview *and* payload ───────── */

export interface ResolvedCard {
  cardId: string;
  slug: string;
  cardName: string;
  cardType: CardType;
  template: CardTemplate;
  /**
   * The resolved palette: the card's own `paletteId` if it set one, else the template's default.
   *
   * Resolved here rather than looked up in the renderer for the same reason `qrPayload` is: one
   * definition, computed once, so the face, the scan page, the PNG export and the OpenGraph
   * image cannot disagree about what colour the card is.
   */
  palette: TemplatePalette;
  /**
   * The card's four surface axes, every one concrete.
   *
   * Resolved here for the same reason `palette` is: one derivation, so the builder's preview and
   * the page a stranger opens cannot disagree about what the card looks like. `<CardPage>` read
   * this through a structural cast while the resolver did not carry it; that cast is now dead.
   */
  surface: ResolvedSurface;
  fullName: string;
  avatar: ResolvedAvatar;
  /** `null` collapses the bio slot rather than reserving empty space (§11 E-06). */
  bio: string | null;
  /** Ordered by the §6.4 ordering rule. */
  fields: ResolvedField[];
  /** `SOCIAL_LINK` only, split out for the social row. */
  socialFields: ResolvedField[];
  /** `${SITE_URL}/c/${slug}` — computed once, here, and read by everything downstream. */
  qrPayload: string;
  /** Ids in `card.fieldIds` that are absent from the profile (I-2). */
  droppedFieldIds: string[];
  /** `fields.length + socialFields.length`. */
  fieldCount: number;
}

/* ── §6.3 Fixture gateway — the only data source, and the state switch ──────────────── */

/** The five states reachable through the `?state=` switch. Unrecognised values fall back to
 * `success`; the switch never throws (§11 E-34). */
export type ScreenState = "success" | "loading" | "empty" | "error" | "offline";

export interface FixtureResult<T> {
  state: ScreenState;
  data: T | null;
  error: FixtureError | null;
}

export interface FixtureError {
  kind: "network" | "not-found" | "forbidden" | "unknown";
  /** Human, sentence case, no jargon, no error codes. */
  title: string;
  /** One sentence explaining what the user can do. */
  detail: string;
  retryable: boolean;
}
