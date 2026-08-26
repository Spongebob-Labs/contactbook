/**
 * The API↔domain boundary. The only file allowed to know that the two models differ.
 *
 * ## Why the disagreements are resolved here and not in `schema.ts`
 * `schema.ts` describes the wire exactly. `types/domain.ts` describes what the UI needs.
 * Where they disagree — and they disagree in five documented places — the translation lives
 * here, so a spec change shows up as a type error in one file instead of rippling through a
 * hundred components.
 *
 */

import {
  API_FIELD_CATEGORIES,
  type ApiCardKind,
  type ApiFieldCategory,
  type ApiFieldType,
  type CardFieldEntryDto,
  type CardResponseDto,
  type ContactResponseDto,
  type MeResponseDto,
  type ProfileFieldGroupResponseDto,
  type ProfileFieldResponseDto,
  type ShareLinkResponseDto,
} from "@/lib/api/schema";
import type {
  CardType,
  Contact,
  ContactCard,
  ContactShare,
  FieldGroup,
  ProfileField,
  User,
} from "@/types/domain";
import type { PaletteId } from "@/card/template-palettes";
import type { TemplateId } from "@/card/template-types";
import { dialPrefixOf } from "@/lib/countries";

/* ── Identity ────────────────────────────────────────────────────────────────────────── */

/**
 * `GET /profile/me` + the caller's id → the domain `User`.
 *
 * `userId` is a separate argument because `MeResponseDto.identity` does not carry one — the id
 * lives on `POST /auth/me` instead, since the API keeps "who is this token for" separate from
 * "what do we know about them". The session loader fetches both.
 *
 * Three fields the API has no answer for, and what each becomes:
 *
 * · **`firstName` / `lastName`** are nullable upstream (a user exists from the moment their
 *   phone is verified, which is before they have given a name) and non-nullable here. Empty
 *   string, not `"Unknown"` — the avatar's monogram derives from these, and a placeholder name
 *   would render as a confident `U`.
 * · **`isActive`** has no concept upstream. `true`: holding a valid session *is* being active,
 *   and there is no endpoint that could ever report otherwise.
 * · **`countryCode`** is the dial prefix, derived from the E.164 number by longest match —
 *   which is why `+1` being shared by the US and Canada does not matter here.
 */
export function toUser(me: MeResponseDto, userId: string): User {
  const { identity } = me;
  return {
    id: userId,
    email: identity.primaryEmail,
    phone: identity.primaryPhone,
    countryCode: dialPrefixOf(identity.primaryPhone),
    firstName: identity.firstName ?? "",
    lastName: identity.lastName ?? "",
    isActive: true,
    onboardingCompleted: me.onboardingCompleted,
    avatarUrl: identity.profilePhoto,
  };
}

/* ── Card kind ───────────────────────────────────────────────────────────────────────── */

/**
 * `CardResponseDto.kind` → `ContactCard.type`.
 *
 * ⚠ The one-word difference that would otherwise be a silent bug: the API says `WORK`, the UI
 * says `BUSINESS`, for the same thing. Both directions are pinned by
 * `tests/contract/api-contract.test.ts`, so a regression here is a test failure rather than a
 * card filed under the wrong heading.
 */
export function toCardType(kind: ApiCardKind): CardType {
  return kind === "WORK" ? "BUSINESS" : kind;
}

/** The inverse, for `POST /cards` and `PATCH /cards/{id}`. */
export function toApiCardKind(type: CardType): ApiCardKind {
  return type === "BUSINESS" ? "WORK" : type;
}

/* ── Appearance ──────────────────────────────────────────────────────────────────────── */

/**
 * A card's look, derived from its `kind`.
 *
 * ## Why this function exists at all
 * `CardResponseDto` carries no appearance: no `templateId`, no `paletteId`, no `groundHex`,
 * no `surfaceStyle`, no `patternId`, no `slug`. `types/domain.ts` flagged every one of those
 * for this integration. So a template-and-palette choice cannot survive a reload, and the
 * three ways to handle that are: persist it client-side (the same card renders in different
 * colours on different devices — a bad thing to find out on stage), block on the backend, or
 * derive it deterministically from something the API *does* store.
 *
 * Deriving from `kind` was the decision. It means every card renders identically everywhere,
 * with zero backend change, and the design panel is honestly read-only until the columns
 * exist rather than pretending to save.
 *
 * `paletteId` is left `undefined` for the two kinds whose natural colour is already their
 * template's default (Meridian→Sapphire, Marigold→Amber). That is not laziness: `undefined`
 * means "whatever this template defaults to", so those two keep tracking the template if its
 * default ever changes, while `PAYMENT` and `CUSTOM` are pinned because they need to be
 * visually distinct from the kind they share a template with.
 */
export interface DerivedAppearance {
  templateId: TemplateId;
  paletteId?: PaletteId;
}

const APPEARANCE: Readonly<Record<ApiCardKind, DerivedAppearance>> = {
  // For work — Meridian seeds the work number and work email.
  WORK: { templateId: "meridian" },
  // For everyone else — Marigold seeds the mobile and personal email.
  PERSONAL: { templateId: "marigold" },
  // Meridian's structure, but its own colour: a payment card sharing Sapphire with every
  // work card would be indistinguishable at thumbnail size, which is where cards are picked.
  PAYMENT: { templateId: "meridian", paletteId: "onyx" },
  CUSTOM: { templateId: "marigold", paletteId: "pistachio" },
};

export function appearanceForKind(kind: ApiCardKind): DerivedAppearance {
  return APPEARANCE[kind];
}

/**
 * The public-URL slug for a card.
 *
 * ⚠ A placeholder, and the one mapping here that is knowingly wrong. `ContactCard.slug` wants
 * a short, non-enumerable id so the QR payload stays under 60 bytes; the API has no `slug`
 * column, so the card id stands in.
 *
 * This is harmless *today* only because there is no public endpoint to resolve a link against
 * (`docs/INTEGRATION.md` ask #1) — so nothing consumes the slug except a QR code pointing at a
 * page that is not live yet. When ask #1 and the `slug` column land, this function is the one
 * place to change.
 */
export function slugForCard(cardId: string): string {
  return cardId;
}

/* ── Profile: fields and groups ──────────────────────────────────────────────────────── */

/**
 * The four field types whose values are secrets.
 *
 * ## Why this is derived rather than read
 * `ProfileField.isSensitive` drives §7.3 masking on every public surface. The API has **no
 * such column** — what it has instead is a set of types it encrypts at rest, named in
 * `CreateProfileFieldDto`'s own documentation. So the flag is derived from the type, which is
 * both the honest reading of what the server knows and a stricter guarantee than a stored
 * boolean: a bank account cannot be un-marked by accident, because nothing stores the mark.
 *
 * The cost is real and is recorded as ask #6 in `docs/INTEGRATION.md`: a *non*-financial field
 * can no longer be marked sensitive, so the profile row's toggle is read-only against the API.
 * A home address that the owner wants masked has nowhere to record that wish.
 */
const SENSITIVE_TYPES: ReadonlySet<ApiFieldType> = new Set<ApiFieldType>([
  "BANK_ACCOUNT",
  "DIGITAL_WALLET",
  "CRYPTO_WALLET",
]);

export function isSensitiveType(type: ApiFieldType): boolean {
  return SENSITIVE_TYPES.has(type);
}

/**
 * The prefix marking a group this client invented rather than one the API owns.
 *
 * ## Why synthetic groups have to exist
 * The two models disagree about what a group *is*:
 *
 * · **The API**: a group is one instance of a repeatable thing — a specific job, a specific
 *   bank account. Only `WORK`/`BUSINESS`/`SOCIAL`/`FINANCIAL` can have them, there can be
 *   several per category, and a field's `groupId` is nullable.
 * · **The UI**: `FieldGroup.groupId` on a field is **required**, and the profile screen renders
 *   one collapsible section per group. `PERSONAL`, `IDENTITY` and `CUSTOM` fields are ungrouped
 *   upstream and would therefore have nowhere to render.
 *
 * So every category with ungrouped fields gets one synthetic group to hold them. It is a
 * presentation container, not a record: it has no id upstream, and a mutation aimed at it must
 * translate back to "ungrouped, in this category" — which is what {@link isSyntheticGroupId}
 * and {@link categoryOfSyntheticGroup} are for. Any code that sends a synthetic id to the API
 * as a real `groupId` is a bug, and a loud one: the API would 404.
 */
const SYNTHETIC_PREFIX = "category:";

export function syntheticGroupId(category: ApiFieldCategory): string {
  return `${SYNTHETIC_PREFIX}${category}`;
}

export function isSyntheticGroupId(groupId: string): boolean {
  return groupId.startsWith(SYNTHETIC_PREFIX);
}

/** The category a synthetic group stands for, or `null` when the id belongs to a real group. */
export function categoryOfSyntheticGroup(groupId: string): ApiFieldCategory | null {
  if (!isSyntheticGroupId(groupId)) return null;
  const raw = groupId.slice(SYNTHETIC_PREFIX.length);
  return (API_FIELD_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as ApiFieldCategory)
    : null;
}

/** What a synthetic group is called. A real group uses its own `tag` instead. */
const CATEGORY_NAMES: Readonly<Record<ApiFieldCategory, string>> = {
  IDENTITY: "Identity",
  PERSONAL: "Personal",
  WORK: "Work",
  BUSINESS: "Business",
  SOCIAL: "Social",
  FINANCIAL: "Financial",
  CUSTOM: "Custom",
};

/**
 * Declaration order of `FieldCategory`, as a sort key.
 *
 * `types/domain.ts` says this order is load-bearing — it is the primary sort of the §6.4
 * ordering rule, which is what makes a rendered card and its `.vcf` byte-stable. The API
 * returns groups ordered by `position` *within* a category and says nothing about across, so
 * this supplies the missing half.
 */
const CATEGORY_ORDER: Readonly<Record<ApiFieldCategory, number>> = {
  IDENTITY: 0,
  PERSONAL: 1,
  WORK: 2,
  BUSINESS: 3,
  SOCIAL: 4,
  FINANCIAL: 5,
  CUSTOM: 6,
};

export interface MappedProfile {
  groups: FieldGroup[];
  fields: ProfileField[];
}

/**
 * `GET /profile/fields` + `GET /profile/groups` → the domain's `{ groups, fields }`.
 *
 * ## Why both endpoints, and not `GET /profile/me`
 * `MeResponseDto` buckets fields into `identity` / `personal` / `work` / `business` / `socials`
 * / `financial`. There is no bucket for `CUSTOM`, and `IDENTITY` fields are folded into a flat
 * identity object — so a profile read from `/profile/me` alone can silently omit fields that
 * `/profile/fields` returns. The flat list is authoritative about *what exists*; the group list
 * is authoritative about *what the containers are called*. This takes each from the one that
 * knows.
 *
 * ## What is lost on the way through, and why nothing had to change to absorb it
 * `ProfileField.detail` — the structured `ADDRESS` / `BANK_ACCOUNT` / `DIGITAL_WALLET` /
 * `CRYPTO_WALLET` payloads — is always `undefined` here, because `ProfileFieldResponseDto.value`
 * is a scalar string and the API does not serialize its own extension tables (ask #3).
 *
 * That degrades rather than breaks: `field-renderers.tsx` and `build-vcf.ts` already read
 * `field.detail?.x ?? field.value` at every site, so an address renders as its one stored line
 * and a vCard `ADR` carries that line in its street component instead of seven parsed ones.
 * Restoring the structure is a server change, not a client one.
 *
 * ⚠ **Shape-tolerant on purpose.** Exactly how the API explodes an onboarding bank account into
 * fields is unverified — it needs one authenticated session to settle. So nothing here assumes a
 * field layout: every group renders whatever fields it actually contains, in `position` order,
 * and an unexpected arrangement produces a group with unexpected rows rather than a crash or a
 * dropped field. Re-read this note when ask #3 is answered.
 */
/**
 * A field's value, with serialisation artefacts treated as empty.
 *
 * ## Why this is not paranoia
 * A field came back from the API rendering as the literal text **`NULL`** on a card — visible in
 * the builder's field picker, where a value should be. `ProfileFieldResponseDto.value` is typed
 * `string` and required, so a `null` reaching here is already off-contract; what actually arrives
 * is either that `null` or the string `"NULL"` from something that stringified one upstream.
 *
 * Either way it is not a value the owner typed, and printing it on a business card is worse than
 * printing nothing. Coerced to `""`, which §11 E-07 already handles correctly: `resolveCard` drops
 * a blank field rather than rendering an empty row, so the field simply does not appear until it
 * has a real value.
 *
 * ⚠ The case-insensitive `"null"` / `"undefined"` check is a judgement call, and it is the right
 * one: nobody puts those on a card on purpose, and the cost of being wrong is one field needing
 * to be retyped, versus a card that reads `NULL` in front of a client. Worth telling the backend
 * about — a required `string` should not be able to carry this.
 */
function cleanValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const trimmed = value.trim();
  return /^(null|undefined)$/i.test(trimmed) ? "" : value;
}

export function toProfile(
  apiFields: readonly ProfileFieldResponseDto[],
  apiGroups: readonly ProfileFieldGroupResponseDto[],
  userId: string,
): MappedProfile {
  const groupsById = new Map<string, FieldGroup>();
  // Parallel to `groupsById`, because `FieldGroup` has no position and the sort below needs one.
  const sortKeys = new Map<string, { category: number; position: number }>();

  for (const group of apiGroups) {
    groupsById.set(group.id, {
      id: group.id,
      userId,
      category: group.category,
      // A group with no tag is a real possibility upstream (`tag` is nullable) and reads as an
      // unnamed section. Falling back to the category name keeps the heading meaningful.
      name: group.tag ?? CATEGORY_NAMES[group.category],
      fieldIds: [],
    });
    sortKeys.set(group.id, {
      category: CATEGORY_ORDER[group.category],
      position: group.position,
    });
  }

  // Sorted before assignment, so `fieldIds` comes out in the API's own display order and the
  // group — which is the ordering authority for the whole UI — never needs re-sorting later.
  const ordered = [...apiFields].sort((a, b) => a.position - b.position);

  const fields: ProfileField[] = [];
  const memberIds = new Map<string, string[]>();

  for (const field of ordered) {
    let groupId = field.groupId;

    if (groupId === null || !groupsById.has(groupId)) {
      // Ungrouped, or grouped into something `/profile/groups` did not return (an archived
      // group, say). Either way it needs a home, and its category names one.
      groupId = syntheticGroupId(field.category);
      if (!groupsById.has(groupId)) {
        groupsById.set(groupId, {
          id: groupId,
          userId,
          category: field.category,
          name: CATEGORY_NAMES[field.category],
          fieldIds: [],
        });
        // Synthetic groups sort to the front of their category: they hold the plain fields,
        // which read as the category's own before any named instance of it.
        sortKeys.set(groupId, { category: CATEGORY_ORDER[field.category], position: -1 });
      }
    }

    fields.push({
      id: field.id,
      groupId,
      type: field.type,
      label: field.label,
      value: cleanValue(field.value),
      isSensitive: isSensitiveType(field.type),
      // `detail` deliberately absent — see the note above.
    });

    const members = memberIds.get(groupId);
    if (members === undefined) memberIds.set(groupId, [field.id]);
    else members.push(field.id);
  }

  const groups = [...groupsById.values()]
    .map((group) => ({ ...group, fieldIds: memberIds.get(group.id) ?? [] }))
    .sort((a, b) => {
      const ka = sortKeys.get(a.id);
      const kb = sortKeys.get(b.id);
      if (ka === undefined || kb === undefined) return 0;
      return ka.category - kb.category || ka.position - kb.position;
    });

  return { groups, fields };
}

/* ── Contacts and share links ────────────────────────────────────────────────────────── */

/**
 * `ContactResponseDto` → the domain `Contact`.
 *
 * Nearly a pass-through, which is itself the finding: once the UI's inbound-lead model was
 * replaced by the API's outbound registry, there was almost nothing left to translate. The only
 * addition is `ownerId`, which the API omits because every contact is implicitly the caller's —
 * the domain carries it so a contact can be attributed without consulting the session.
 */
export function toContact(dto: ContactResponseDto, ownerId: string): Contact {
  return {
    id: dto.id,
    ownerId,
    phoneE164: dto.phoneE164,
    displayName: dto.displayName,
    notes: dto.notes,
    source: dto.source,
    optedOutAt: dto.optedOutAt,
    createdAt: dto.createdAt,
  };
}

/** One share link, from the recipient's side. */
export function toContactShare(dto: ShareLinkResponseDto): ContactShare {
  return {
    shareLinkId: dto.id,
    cardId: dto.cardId,
    cardName: dto.cardName,
    url: dto.url,
    status: dto.status,
    viewCount: dto.viewCount,
    firstViewedAt: dto.firstViewedAt,
    lastViewedAt: dto.lastViewedAt,
    createdAt: dto.createdAt,
  };
}

/**
 * Every share link, grouped by the contact it was minted for.
 *
 * `GET /share-links` returns one flat list across every card, so the join has to happen here.
 * Built as a `Map` rather than filtered per contact at each call site because the contacts list
 * needs a count for every row — filtering the whole list once per row is quadratic, and a
 * contact registry is exactly the kind of thing that arrives with several hundred entries.
 *
 * Newest first within each contact: the most recent send is what somebody is looking for.
 */
export function groupSharesByContact(
  links: readonly ShareLinkResponseDto[],
): Map<string, ContactShare[]> {
  const byContact = new Map<string, ContactShare[]>();

  for (const link of links) {
    const share = toContactShare(link);
    const existing = byContact.get(link.contactId);
    if (existing === undefined) byContact.set(link.contactId, [share]);
    else existing.push(share);
  }

  for (const shares of byContact.values()) {
    shares.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return byContact;
}

/* ── Cards ───────────────────────────────────────────────────────────────────────────── */

/**
 * `CardResponseDto` → the domain `ContactCard`.
 *
 * This is the mapper with the most invention in it, because the API's card is the thinnest of the
 * three entities: a name, a kind, and an ordered list of field references. Four domain properties
 * have no column behind them, and each is filled a different way:
 *
 * · **`slug`** — `slugForCard(id)`. Placeholder; see that function.
 * · **`templateId` / `paletteId`** — `appearanceForKind(kind)`. The decision recorded there: a
 *   deterministic look derived from something the API *does* store, so a card renders identically
 *   on every device with no backend change, and the design panel is honestly read-only.
 * · **`isSensitive`** — derived from whether any mapped field is a payment type. It currently has
 *   no reader anywhere in the app; deriving it beats hard-coding `false`, because the day
 *   something does read it the answer will be right rather than merely quiet.
 *
 * ## `visible: false` is folded into "not on the card"
 * `CardFieldEntryDto.visible` exists to soft-hide a field without losing its position or label
 * override. The builder has no such concept — a field is ticked or it is not — so a hidden field
 * maps to *absent* here, and every write sends `visible: true`. Nothing is lost that the UI could
 * express; a future "temporarily hide" control would need this mapper to grow a third state.
 */
export function toContactCard(dto: CardResponseDto, userId: string): ContactCard {
  const appearance = appearanceForKind(dto.kind);

  // Sorted, then filtered: `position` is the API's display order, and a hidden field still
  // occupies one, so ordering before dropping keeps the survivors in the right sequence.
  const ordered = [...dto.fields].sort((a, b) => a.position - b.position);
  const visible = ordered.filter((field) => field.visible);

  return {
    id: dto.id,
    userId,
    name: dto.name,
    type: toCardType(dto.kind),
    isSensitive: visible.some((field) => isSensitiveType(field.type)),
    slug: slugForCard(dto.id),
    templateId: appearance.templateId,
    paletteId: appearance.paletteId,
    fieldIds: visible.map((field) => field.fieldId),
    updatedAt: dto.updatedAt,
  };
}

/**
 * The card's curated set, as the API wants it back.
 *
 * ⚠ `PUT /cards/{id}/fields` **replaces** the whole set — it is not a patch. So this takes the
 * complete ordered list of ids the card should end up with, and the caller must send everything
 * it wants kept, not just what changed.
 *
 * `visible` is always `true`: see `toContactCard` for why the UI has no hidden state to preserve.
 * `labelOverride` is never sent — the builder edits the field's own label through the profile
 * endpoints instead, so a per-card override would be a second, competing answer to "what is this
 * row called".
 */
export function toCardFieldEntries(fieldIds: readonly string[]): CardFieldEntryDto[] {
  return fieldIds.map((fieldId) => ({ fieldId, visible: true }));
}
