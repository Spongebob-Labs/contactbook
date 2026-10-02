/**
 * The domain model — spec §5, plus the derived and gateway shapes from §6.3 and §6.4.
 *
 * Frontend-only mirrors of the shapes mined from the previous build. No Prisma, no DB, no
 * persistence: every screen reads fixtures through the gateway (§3.1).
 *
 * Types only. This module imports *from* `@/card/template-types` and is never imported by it.
 */

import { formatPhoneDisplay } from "@/lib/format";
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
  | "FAMILY"
  | "WORK"
  | "BUSINESS"
  | "SOCIAL"
  | "FINANCIAL"
  | "CUSTOM";

/**
 * 22 members. Every one needs a renderer (§6.6, AC-21) and a vCard mapping (§6.7); a missing
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
  | "COMPANY_LOGO"
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
   * The card's own public URL — `CardResponseDto.publicUrl`, passed through verbatim.
   *
   * This is what the QR encodes, and it is **not** a per-recipient share link. The API mints a
   * `Card.publicToken` at creation, so this exists before the card has been shared with anyone
   * and survives revoking any individual recipient. Never assembled here: the API hands us the
   * finished URL (see `CardResponseDto.publicUrl` for why).
   *
   * `null` means **not published yet** — the builder's unsaved card, which has no server row and
   * therefore no token. A `null` here must render as an explicit "activates on save" state, never
   * as a QR that looks live and resolves to nothing. It replaces the old assumed `slug` field,
   * which guessed a URL against a column that never landed.
   */
  publicUrl: string | null;
  /**
   * The card's uploaded logo — `CardResponseDto.logoUrl`, passed through verbatim.
   *
   * ⚠ **Optional, and absent means exactly what `null` means: this card has no logo.** There is
   * no third state, which is why this is not modelled as a required `string | null` the way
   * `publicUrl` is. `publicUrl`'s `null` carries real information — "saved, but the API has not
   * minted a token" is different from "never saved" — so every construction site is made to say
   * it. A logo has nothing equivalent to distinguish, and sixteen fixtures each declaring
   * `logoUrl: null` would state nothing a reader does not already know.
   *
   * ⚠ **This is not a field the UI may write.** The API rejects `logoUrl` as a plain string on
   * both create and update; a value here only ever originates from an uploaded file. Nothing in
   * the builder puts a string in it — see `builder-reducer.ts` for the state that stands in
   * while a chosen file has not been uploaded yet.
   *
   * Resolved into {@link ResolvedAvatar} by `resolveCard` — it fills the card's circular
   * identity slot, ahead of any photograph — and every renderer reads it from there.
   */
  logoUrl?: string | null;

  /* ── ⚠ THREE UI-ONLY SLOTS. THE API HAS NO COLUMN FOR ANY OF THEM YET ─────────────────────
   *
   * `coverUrl`, `headline` and `bio` are set by the builder and rendered by the card. They are
   * NOT sent to the server and NOT read back from it: `toCreateCardForm` and `updateCard` do not
   * carry them, and `toContactCard` never populates them, so a reload drops whatever the owner
   * typed.
   *
   * That is deliberate and temporary. The composition needs all three to be worth judging — a
   * card with no cover, no position and no bio is not the card the client approved — and the
   * front end can hold them today while the columns are specified. Keeping them on
   * `ContactCard` rather than in a side-channel means the renderer, the resolver and the
   * preview all take the same object they already take, so making them real is three mappings
   * and no redesign.
   *
   * ⚠ **What the backend has to add, stated here so it is not archaeology later:**
   *   · `Card.coverUrl`  — nullable text, written by a multipart upload exactly like
   *                        `logoUrl` (`POST /cards/{id}/cover`, same size and type limits).
   *   · `Card.headline`  — nullable text, ≤ 80 chars. The position line under the name.
   *   · `Card.bio`       — nullable text, ≤ 240 chars.
   * All three then need adding to `CardResponseDto`, to `toContactCard`, and to the update DTO.
   */

  /**
   * The card page's cover photograph, chosen in the builder.
   *
   * Outranks the `PHOTO` field and `User.avatarUrl` when set — it is the narrower choice, the
   * same precedence argument `logoUrl` makes against a profile photo.
   */
  coverUrl?: string | null;

  /**
   * The position line printed under the name — "Founder & CEO".
   *
   * Outranks the first mapped `JOB_TITLE`. An owner who has typed a position on THIS card has
   * made a decision about this card; the profile field is what they get when they have not.
   */
  headline?: string | null;

  /**
   * The bio printed under the position.
   *
   * Outranks `resolveBio`'s derivation entirely — including its `"{JOB_TITLE} at {COMPANY}"`
   * branch, which exists precisely because there was nothing better to show.
   */
  bio?: string | null;
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
 * One row of a card's "Sent to" list: a `ContactShare` plus who it went to, plus how far behind
 * they are on the card's current version.
 *
 * Lives here rather than on the card detail screen because two modules need it — the screen that
 * renders the list and the loader that assembles it — and a type owned by a `"use client"`
 * component would make the loader import from its own consumer.
 *
 * ⚠ The two notification fields are `null` for a **revoked** link, and that is load-bearing
 * rather than a missing value: `GET /cards/{id}/audience` returns ACTIVE links only, so a revoked
 * share has no audience entry and cannot be notified. `null` therefore means "not notifiable",
 * which is what gates it out of the picker — never read it as "0 versions behind".
 */
export type CardShareRow = ContactShare & {
  contactId: string;
  contactLabel: string;
  /** `currentVersion - (lastNotifiedVersion ?? 0)`. `0` = caught up, `null` = not notifiable. */
  versionsBehind: number | null;
  /** `null` both for a revoked link and for one minted before this feature existed. */
  lastNotifiedVersion: number | null;
};

/**
 * What to call a contact on screen.
 *
 * `displayName` is nullable and an import routinely brings numbers without one, so every surface
 * needs the same fallback — and a blank cell where a name should be reads as a broken row. The
 * number is the honest answer, because it is the only thing that is always there.
 *
 * ⚠ **Formatted, not raw** (2026-09-24). The fallback used to be the bare E.164 string, so an
 * unnamed contact was headed "+919900000004" on the list and in their own detail page, directly
 * above a "Number" row reading "+91 99000 00004" — the same number in two spellings. QR-scan
 * contacts arrive with no name at all, so on a real account this was most of the list.
 */
export function contactLabel(contact: Pick<Contact, "displayName" | "phoneE164">): string {
  const name = contact.displayName?.trim() ?? "";
  return name.length > 0 ? name : formatPhoneDisplay(contact.phoneE164);
}

/* ── §5.3a Derived shapes — avatar and bio are DERIVED, not owned ───────────────────── */

/**
 * Source order: the mapped `PHOTO` field's value, else `User.avatarUrl`, else the monogram.
 * `CardTemplate.avatarKind` decides how the slot is *presented*, not what is in it.
 */
/**
 * What fills the card's one circular identity slot.
 *
 * ## ⚠ The card's logo is the **first** source, and that placement is the whole point
 *
 * There is exactly one image slot on a card and this is it. An uploaded logo was briefly given
 * a band of its own above the circle, which put two objects in a hero composed for one — a
 * banner stapled over the card rather than part of it. The circle is already the slot that
 * answers "who is this card", so a card that has a logo answers it with the logo.
 *
 * Four sources, in order, and the first that exists wins:
 *
 *   1. `ContactCard.logoUrl` — chosen **for this card**, deliberately, by upload.
 *   2. The mapped `PHOTO` field — this card's own override of the owner's portrait.
 *   3. `User.avatarUrl` — the profile-wide portrait.
 *   4. A monogram. §11 E-19: never an empty circle.
 *
 * The logo outranks both photographs because it is the narrower choice: the other two are the
 * owner's face wherever it is used, and a logo is a decision made about *this card*. Somebody
 * who uploads a mark to their work card and then sees their own face there has had their choice
 * silently overruled — the same reason `groundHex` beats `paletteId`.
 */
/**
 * THE COVER — the card page's photographic zone, and the first of two image slots.
 *
 * ## Why this exists rather than reusing `ResolvedAvatar`
 *
 * `ResolvedAvatar` is ONE slot with a four-step ladder, and the card page's composition needs
 * TWO images at once: a photograph filling the cover, and a brand mark in the badge that
 * straddles the curve below it. Asking one ladder to answer both questions produced a real
 * defect — `card.logoUrl` outranks every photograph, so uploading a logo silently deleted the
 * owner's face from their own card.
 *
 * So the ladder is split by *what the image is for* rather than by precedence:
 *
 *   · COVER  — a photograph of the person. `PHOTO` field → `User.avatarUrl` → none.
 *   · BADGE  — the brand mark. `Card.logoUrl` → monogram. See {@link ResolvedBadge}.
 *
 * ⚠ `avatar` is NOT removed and its ladder is unchanged. `<ShareFace>`, the PNG exporter and
 * the OpenGraph image all render one circle and are correct to; changing their slot to suit a
 * composition they do not use would be a redesign disguised as a refactor.
 *
 * `"none"` rather than `null` so the absent case is a member of the union and every consumer
 * has to name it — a card with no photograph is the COMMON case, not an edge one, and the
 * cover must be beautiful in it rather than empty.
 */
export type ResolvedCover =
  | { kind: "photo"; url: string; alt: string }
  | { kind: "none" };

/**
 * THE BADGE — the circular mark that straddles the curve between cover and sheet.
 *
 * Two members, because the badge always paints: a card with no logo wears its owner's
 * initials, never an empty ring (§11 E-19, restated for the second slot).
 */
export type ResolvedBadge =
  | { kind: "logo"; url: string; alt: string }
  | { kind: "monogram"; initials: string };

export type ResolvedAvatar =
  /** The card's uploaded logo. Drawn exactly as a photograph is — same circle, same crop. */
  | { kind: "logo"; url: string; alt: string }
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
  /** `ContactCard.publicUrl`, carried through. `null` until the card is saved. */
  publicUrl: string | null;
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
  /**
   * The card page's cover photograph, or `none`. See {@link ResolvedCover} for why this is a
   * separate slot from `avatar` rather than a reading of it.
   */
  cover: ResolvedCover;
  /** The card page's badge mark. See {@link ResolvedBadge}. */
  badge: ResolvedBadge;
  /**
   * The position line, resolved: the card's own `headline` if it has one, else the first mapped
   * `JOB_TITLE`. `null` when the owner has neither, and the slot collapses.
   *
   * Resolved here rather than in the renderer for the same reason `palette` is: the builder's
   * preview and the page a stranger opens must not disagree about what the card says.
   */
  headline: string | null;
  /** `null` collapses the bio slot rather than reserving empty space (§11 E-06). */
  bio: string | null;
  /** Ordered by the §6.4 ordering rule. */
  fields: ResolvedField[];
  /** `SOCIAL_LINK` only, split out for the social row. */
  socialFields: ResolvedField[];
  /**
   * What the QR encodes: **always the card's own `publicUrl`**, never a recipient's share link.
   *
   * Computed once, here, and read by everything downstream — the share face, the vCard NOTE, the
   * PNG export and the OpenGraph image — so they cannot disagree about where the card points.
   *
   * ⚠ This deliberately does *not* prefer the newest ACTIVE ShareLink, which is what it used to
   * do. A QR is one-to-many: it gets printed, put on a lock screen and shown to strangers. Baking
   * one recipient's private token into it means revoking that person kills the printed code for
   * everyone, and a stranger's scan inflates that recipient's view count.
   *
   * `null` when the card has no server row yet (builder, pre-save). Renderers must show the
   * pending state rather than encoding a placeholder.
   */
  qrPayload: string | null;
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
