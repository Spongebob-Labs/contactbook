/**
 * `resolveCard` — the single source of truth for preview **and** payload (spec §6.4).
 *
 * ## The one structural fact this file encodes
 * **A card owns no data. A card is a *filter* over `ProfileField`s** (§5.3). `name`, `type`,
 * `templateId` and a set of `fieldIds` are the only content a `ContactCard` carries;
 * everything it displays is reached through that indirection. Resolving it in one place is
 * what makes the rendered card, the `.vcf` and the QR agree by construction rather than by
 * three call sites happening to do the same thing.
 *
 * That is invariant **I-5**: `<ShareFace resolved={r}/>`, `buildVcf(r)` and
 * `exportCardPng(r)` take the *same reference*. It is the structural fix for the old
 * build's "previewed file differs from sent file" bug — a convention would not have held.
 *
 * ## Purity (I-4)
 * No clock, no randomness, no `window`, no mutation of the four inputs — and, since the QR
 * payload became `card.publicUrl` rather than a URL assembled from `NEXT_PUBLIC_SITE_URL`, no
 * environment read either. A call is a pure function of its arguments in the strictest sense.
 * The returned arrays are fresh and mutable by design
 * (§6.4) — they are built here, never aliased from the inputs.
 *
 * ## What it deliberately does NOT do
 * No clamping, no truncation, no masking. `bio` carries its full text and the renderer
 * clamps it to three lines (§11 E-05); the `.vcf` writer masks (§6.7). A resolver that
 * pre-truncated would make the `title` attribute of E-05/E-10/E-11 impossible.
 */

import { UnknownRegistryIdError } from "@/card/errors";
import { TEMPLATE_PALETTES } from "@/card/template-palettes";
import { derivePalette } from "@/card/derive-palette";
import {
  resolveCardSurface,
  type ResolvedSurface,
} from "@/card/card-surface";
import type { CardTemplate } from "@/card/template-types";
import { TEMPLATES } from "@/card/templates";
import { initialsFor } from "@/lib/format";
import type {
  ContactCard,
  FieldCategory,
  FieldGroup,
  FieldType,
  ProfileField,
  ResolvedAvatar,
  ResolvedCard,
  ResolvedField,
  User,
} from "@/types/domain";

/**
 * Declaration order **is** the sort order (§6.4). Both tables are transcribed from
 * `@/types/domain`, where the same comment warns that the order is load-bearing; a `Record`
 * keyed by the union means adding an enum member without ranking it is a compile error.
 */
const CATEGORY_RANK: Record<FieldCategory, number> = {
  IDENTITY: 0,
  PERSONAL: 1,
  WORK: 2,
  BUSINESS: 3,
  SOCIAL: 4,
  FINANCIAL: 5,
  CUSTOM: 6,
};

const TYPE_RANK: Record<FieldType, number> = {
  PHONE: 0,
  LANDLINE: 1,
  FAX: 2,
  EMAIL: 3,
  ADDRESS: 4,
  URL: 5,
  SOCIAL_LINK: 6,
  PHOTO: 7,
  TEXT: 8,
  DATE: 9,
  JOB_TITLE: 10,
  COMPANY: 11,
  REG_NUMBER: 12,
  DEPARTMENT: 13,
  RELATION: 14,
  STATUS: 15,
  LOCATION_TRACKING: 16,
  BANK_ACCOUNT: 17,
  DIGITAL_WALLET: 18,
  CRYPTO_WALLET: 19,
  CUSTOM: 20,
};

/**
 * The §6.4 ordering rule: category, then type, then label, then id.
 *
 * Determinism is the whole point — a stable order is what makes a `.vcf` byte-comparable
 * and a card snapshot meaningful. The final `id` key makes the order *total*, so two
 * fields that agree on everything else still cannot swap between two runs.
 *
 * ⚠ **Exported, and exported for exactly one reason: so a second surface can agree with the
 * card instead of inventing its own order.** The builder's Fields section lists what the card
 * carries, and that list has to be in the order the card renders it — otherwise the owner reads
 * one sequence in the controls and sees another on the card and on the `.vcf`. It would have
 * been trivial to transcribe these four keys into `field-rows.ts`, and that transcription is
 * precisely the drift this export prevents.
 *
 * The rule itself is **unchanged** and must stay unchanged: `resolveCard` sorts with it below,
 * `buildVcf` writes in the order it produces, and byte-stability depends on both. There is no
 * owner-defined ordering in this product — no drag-to-reorder — and adding one is a change to
 * this comparator and to the `.vcf` contract, never a change at a call site.
 */
export function compareResolvedFields(a: ResolvedField, b: ResolvedField): number {
  const byCategory = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  if (byCategory !== 0) return byCategory;

  const byType = TYPE_RANK[a.type] - TYPE_RANK[b.type];
  if (byType !== 0) return byType;

  const byLabel = a.label.localeCompare(b.label, "en-GB");
  if (byLabel !== 0) return byLabel;

  return a.id.localeCompare(b.id, "en-GB");
}

/** §11 E-07: a blank value is excluded entirely, never rendered as an empty row. */
function hasValue(field: ProfileField): boolean {
  return field.value.trim().length > 0;
}

function fullNameOf(user: User): string {
  return [user.firstName, user.lastName]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

/**
 * §5.3a: the mapped `PHOTO` field's value, else `User.avatarUrl`, else a monogram.
 *
 * §11 E-19 is explicit that the last branch is a monogram and **never** an empty circle, so
 * the initials fall back through the user's name to the card's name rather than resolving
 * to `''` for a user who has not filled in a name yet.
 */
function resolveAvatar(
  photoField: ResolvedField | undefined,
  user: User,
  fullName: string,
  cardName: string,
): ResolvedAvatar {
  const alt = fullName.length > 0 ? fullName : cardName;

  if (photoField !== undefined) {
    return { kind: "photo", url: photoField.value.trim(), alt };
  }

  const avatarUrl = user.avatarUrl?.trim() ?? "";
  if (avatarUrl.length > 0) {
    return { kind: "photo", url: avatarUrl, alt };
  }

  const fromName = initialsFor(user.firstName, user.lastName);
  const fromCard = cardName.trim().charAt(0).toUpperCase();
  return { kind: "monogram", initials: fromName || fromCard || "?" };
}

/**
 * §5.3a bio precedence: first mapped `TEXT` → `"{JOB_TITLE} at {COMPANY}"` → `JOB_TITLE` →
 * `COMPANY` → `null` (and the slot collapses, §11 E-06).
 *
 * "First" means first in the resolved order, not first in `card.fieldIds`: the bio then
 * depends only on *which* fields are mapped, never on the order they were ticked in.
 *
 * A bio is a derived *view* — it never removes its source field from `fields`. §6.7's
 * worked example proves it: `card_minimal_demo` composes its bio from JOB_TITLE and COMPANY
 * and still emits `TITLE:` and `ORG:` in the `.vcf`.
 */
function resolveBio(fields: readonly ResolvedField[]): string | null {
  const firstOf = (type: FieldType): string | undefined =>
    fields.find((field) => field.type === type)?.value;

  const text = firstOf("TEXT");
  if (text !== undefined) return text;

  const jobTitle = firstOf("JOB_TITLE");
  const company = firstOf("COMPANY");

  if (jobTitle !== undefined && company !== undefined) return `${jobTitle} at ${company}`;
  return jobTitle ?? company ?? null;
}

/**
 * Resolve a card against a profile.
 *
 * `groups` and `fields` are `readonly` so the frozen `as const` fixtures pass without a
 * copy at every call site; a mutable `FieldGroup[]` is assignable to a `readonly` parameter,
 * so this accepts everything the §6.4 signature does.
 *
 * Never throws for a *field* that no longer resolves — an id absent from the profile is
 * dropped into `droppedFieldIds` instead (I-2, §11 E-40), so a card whose profile moved on
 * underneath it still renders.
 *
 * It DOES throw `UnknownRegistryIdError` (`@/card/errors`) if `card.templateId`, or the
 * palette id it falls back to, is not a key of the relevant registry. §5.6's **I-1** and the
 * `Record<TemplateId, CardTemplate>` shape of `TEMPLATES` are supposed to make that
 * impossible — the error's own comment is where the exception to that is recorded, and why
 * failing loudly, here, naming the id, is the fix rather than a silent fallback.
 */
export function resolveCard(
  card: ContactCard,
  user: User,
  groups: readonly FieldGroup[],
  fields: readonly ProfileField[],
): ResolvedCard {
  const fieldById = new Map(fields.map((field) => [field.id, field] as const));
  const categoryByGroupId = new Map(
    groups.map((group) => [group.id, group.category] as const),
  );

  const droppedFieldIds: string[] = [];
  const resolved: ResolvedField[] = [];
  const seen = new Set<string>();

  for (const id of card.fieldIds) {
    // `fieldIds` is a set in meaning if not in type: a duplicate must not double a row.
    if (seen.has(id)) continue;
    seen.add(id);

    const field = fieldById.get(id);
    // I-2: absent from the profile entirely.
    if (field === undefined) {
      droppedFieldIds.push(id);
      continue;
    }

    // §5.3: a card's ids are a subset of what is reachable through the user's FieldGroups.
    // A field whose group is gone is not reachable and has no FieldCategory to sort on, so
    // it is dropped for the same reason and reported the same way.
    const category = categoryByGroupId.get(field.groupId);
    if (category === undefined) {
      droppedFieldIds.push(id);
      continue;
    }

    // §11 E-07: a blank value is not a dangling id — the field exists, it just says
    // nothing. It is excluded from the card and from the `.vcf`, and reported as neither.
    if (!hasValue(field)) continue;

    resolved.push({
      id: field.id,
      type: field.type,
      category,
      label: field.label,
      value: field.value,
      isSensitive: field.isSensitive,
      ...(field.detail === undefined ? {} : { detail: field.detail }),
    });
  }

  resolved.sort(compareResolvedFields);

  // §6.6: PHOTO is consumed by the avatar slot and never rendered as a row, so it is in
  // neither array — which keeps AC-22's set equality provable, since both sides of that
  // assertion derive from `fields` and `socialFields`.
  const photoField = resolved.find((field) => field.type === "PHOTO");
  const socialFields = resolved.filter((field) => field.type === "SOCIAL_LINK");
  const rowFields = resolved.filter(
    (field) => field.type !== "SOCIAL_LINK" && field.type !== "PHOTO",
  );

  /* I-1, guarded rather than trusted: see `UnknownRegistryIdError` for why a `TemplateId`
     reaching here can still, in the one documented circumstance, fail to be a key of
     `TEMPLATES`. `card.templateId` is read into a local exactly once, so both this check and
     the returned `template` field are the same lookup — a second `TEMPLATES[card.templateId]`
     below would be a second chance for the two to disagree. */
  const template: CardTemplate | undefined = TEMPLATES[card.templateId];
  if (template === undefined) {
    throw new UnknownRegistryIdError("template", card.templateId, card.id);
  }

  /* The card's own choice wins; the template's default is the fallback. Resolved here, once,
     for the same reason `qrPayload` is — so the face, the scan page, the PNG export and the
     OpenGraph image cannot disagree about what colour the card is.

     Guarded the same way as `template`, immediately above, and for the same reason: a
     `paletteId` — the card's own or the template's default — is typed as `PaletteId` and
     `TEMPLATE_PALETTES` is a `Record<PaletteId, TemplatePalette>`, so this lookup is exactly
     as "impossible" to miss, by construction, as the template one. */
  const paletteId = card.paletteId ?? template.paletteId;
  const presetPalette = TEMPLATE_PALETTES[paletteId];
  if (presetPalette === undefined) {
    throw new UnknownRegistryIdError("palette", paletteId, card.id);
  }

  /**
   * ⚠ **The wire between the owner's four surface axes and every renderer.**
   *
   * Without this the system is three-quarters built and inert: the builder writes `groundHex`,
   * `surfaceStyle`, `patternId` and `headerLayout` onto the card, `<CardPage>` knows how to paint
   * all four — and nothing carries them across. That was the state each parallel track correctly
   * refused to fix from its own side.
   *
   * It belongs **here** and nowhere else, for the same reason `qrPayload` and `palette` already
   * do. `resolveCard` is the single resolution (I-5): the builder's preview, the scan page, the
   * PNG export and the OpenGraph image all take the object it returns. Deriving a free colour in
   * the builder instead would make `/cards/{id}/edit` show a card `/c/{slug}` does not — which is
   * precisely the "previewed file differs from the sent file" defect the invariant exists to
   * prevent.
   *
   * Two rules, in this order:
   *
   * 1. **A chosen colour beats a preset id.** They are one axis, not two, so `groundHex` wins
   *    outright rather than blending; `paletteId` stays as the fallback for a card that never
   *    picked one, and for the wallet face, which has no surface axes at all.
   * 2. **The surface style reaches the derivation.** `derivePalette` spends a different gradient
   *    span per style — a `flat` card needs two near-identical stops, a `mesh` card a real range
   *    — so passing the style is what stops a flat card from being handed a gradient's palette.
   *
   * `derivePalette` clamps an illegible ground itself and can only return a palette that
   * satisfies every `PALETTE_CONTRACT` pair, so nothing downstream has to re-check legibility.
   */
  /* ⚠ This used to also apply `LEGACY_HEADER_LAYOUT[template.pageHeader]`, because the resolver
     was the one place that saw both the card's chosen layout and its template. The layout axis
     is gone, so the resolution is now exactly what `resolveCardSurface` returns and nothing
     here has a second opinion about it. */
  const surface: ResolvedSurface = resolveCardSurface(card);
  const palette =
    card.groundHex === undefined
      ? presetPalette
      : derivePalette(card.groundHex, surface.finish).palette;

  const fullName = fullNameOf(user);

  return {
    cardId: card.id,
    publicUrl: card.publicUrl,
    cardName: card.name,
    cardType: card.type,
    template,
    palette,
    /* Published so `<CardPage>` can stop reading it through a structural cast. Always concrete:
       `resolveCardSurface` applies the defaults, so a card written before these axes existed
       resolves to the treatment it already rendered. */
    surface,
    fullName,
    avatar: resolveAvatar(photoField, user, fullName, card.name),
    bio: resolveBio(rowFields),
    fields: rowFields,
    socialFields,
    /* ⚠ The card's OWN public URL, and never a recipient's share link.
       This used to prefer whichever ShareLink had most recently been minted, which meant the
       moment an owner shared with one person their card's QR silently switched to advertising
       that person's private token — revocable out from under the printed code, and counting a
       stranger's scan against a real recipient. The API mints `Card.publicToken` at creation
       precisely so there is a one-to-many link to encode here.
       `null` propagates: an unsaved card has no server row, so renderers show the pending state
       rather than a symbol that resolves to nothing. */
    qrPayload: card.publicUrl,
    droppedFieldIds,
    fieldCount: rowFields.length + socialFields.length,
  };
}
