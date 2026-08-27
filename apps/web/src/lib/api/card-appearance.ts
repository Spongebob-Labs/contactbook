/**
 * A card's saved design, across the wire — **the one validator, and the one merge rule**.
 *
 * ## Why this is its own module
 * Two mappers read appearance off the API and they must agree exactly, or the owner's card and
 * the card their recipient opens are two different cards:
 *
 *   · `map.ts` → `toContactCard`, from `GET /cards/{id}` — what the owner sees
 *   · `public-card.ts` → `parsePublicCard`, from `GET /public/links/{token}` — what a stranger sees
 *
 * They cannot share code through either of those files: `public-card.ts` is `server-only` and
 * `map.ts` runs in the browser. So the rules live here, in a module neither owns and both import.
 * That drift is not hypothetical — the public page shipped with its own inline copy of the
 * appearance rule, and it disagreed with `map.ts` on half the card kinds.
 *
 * ## Why the API's own validation is not enough
 * `templateId` and `paletteId` are enum-checked server-side. The other five are plain `text`
 * columns with no check at all, so the wire can carry anything. That matters more than it
 * sounds: `resolveCard` looks ids up in registries and throws `UnknownRegistryIdError` on a
 * miss, and the page that would take down is the public one — no session, no owner watching,
 * nothing to recover from. Validation belongs at the wire.
 */

import {
  FINISHES,
  TEXTURES,
  TEXTURE_PRESENCE,
  TEXTURE_SCALE,
  type Finish,
  type Texture,
  type TexturePresence,
  type TextureScale,
} from "@/card/card-surface";
import { TEMPLATE_PALETTES, type PaletteId } from "@/card/template-palettes";
import { TEMPLATES } from "@/card/templates";
import type { TemplateId } from "@/card/template-types";
import type { CardAppearanceDto } from "@/lib/api/schema";
import type { ContactCard } from "@/types/domain";

/**
 * One card's design, validated.
 *
 * Every member nullable, and the three reasons are different:
 *  1. **The card never chose** — the common case, and not an error. Answered by the caller's
 *     `fallback`, which is `appearanceForKind(kind)`.
 *  2. **This API build does not send the column** — absent rather than null. Same handling.
 *  3. **The value is not one this build knows** — see {@link readAppearance}.
 */
export interface CardAppearance {
  templateId: TemplateId | null;
  paletteId: PaletteId | null;
  /** `#RRGGBB`. Overrides `paletteId` when set — see `CardSurface.groundHex`. */
  groundHex: string | null;
  finish: Finish | null;
  texture: Texture | null;
  texturePresence: TexturePresence | null;
  textureScale: TextureScale | null;
}

/** Nothing chosen — a card on its `kind`'s default look. Also what an old payload yields. */
export const NO_APPEARANCE: CardAppearance = {
  templateId: null,
  paletteId: null,
  groundHex: null,
  finish: null,
  texture: null,
  texturePresence: null,
  textureScale: null,
};

/**
 * Foreign spellings for values this build already has a word for.
 *
 * ## ⚠ A compatibility shim, not a second vocabulary
 * The API's own examples used `finish: "matte"` and `textureScale: "1x"`, and those five columns
 * are unvalidated text, so rows written by hand or by an older seed still carry them. They are
 * unambiguous synonyms of values we do have, so translating at the wire beats dropping them.
 *
 * **Only spellings actually observed on the wire belong here.** It is tempting to also map
 * `"0.5x"` and `"2x"` on the assumption that the scheme is what it looks like — do not. A
 * guessed alias is a rule nobody can verify, and if the real scheme differs the guess renders a
 * card wrong instead of reporting that it could not be read. Anything unrecognised is dropped
 * *and named*, which is how the next mismatch gets found rather than predicted.
 *
 * Now that this app writes these columns itself it always sends the canonical spelling, so these
 * fire only for rows it did not write. Delete an entry once no such row is left.
 */
const ALIASES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  finish: { matte: "flat" },
  textureScale: { "1x": "regular" },
};

/**
 * One value, accepted only if the registry that defines the vocabulary contains it.
 *
 * ⚠ Keyed off the registries themselves rather than a transcribed string union, so adding a
 * texture or a palette teaches this function about it automatically. A hand-written list would
 * be a second copy of the vocabulary and the copy nobody updates — and its failure mode is
 * silently dropping a colour the owner really did pick.
 *
 * A miss returns `null` and never throws: it means this build and the API disagree, and the
 * right answer to that is the card's default look, not a crashed page.
 */
function oneOf<T extends string>(
  axis: string,
  value: unknown,
  registry: Record<T, unknown>,
  rejected: string[],
): T | null {
  if (typeof value !== "string" || value.length === 0) return null;

  const translated = ALIASES[axis]?.[value] ?? value;
  if (Object.hasOwn(registry, translated)) return translated as T;

  rejected.push(`${axis}=${value}`);
  return null;
}

/** `#RRGGBB`, exactly. Anything else is discarded and named — see {@link oneOf}. */
function hex(value: unknown, rejected: string[]): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  rejected.push(`groundHex=${value}`);
  return null;
}

/**
 * Read and validate a design off any object that might carry one.
 *
 * `rejected` collects `axis=value` for everything discarded, so a vocabulary drift surfaces as a
 * log line rather than as a card that is quietly the wrong colour.
 */
export function readAppearance(
  source: Record<string, unknown> | CardAppearanceDto | null | undefined,
  rejected: string[] = [],
): CardAppearance {
  if (source === null || source === undefined) return NO_APPEARANCE;
  const raw = source as Record<string, unknown>;

  return {
    templateId: oneOf<TemplateId>("templateId", raw.templateId, TEMPLATES, rejected),
    paletteId: oneOf<PaletteId>("paletteId", raw.paletteId, TEMPLATE_PALETTES, rejected),
    groundHex: hex(raw.groundHex, rejected),
    finish: oneOf<Finish>("finish", raw.finish, FINISHES, rejected),
    texture: oneOf<Texture>("texture", raw.texture, TEXTURES, rejected),
    texturePresence: oneOf<TexturePresence>(
      "texturePresence", raw.texturePresence, TEXTURE_PRESENCE, rejected,
    ),
    textureScale: oneOf<TextureScale>(
      "textureScale", raw.textureScale, TEXTURE_SCALE, rejected,
    ),
  };
}

/** Whether any axis survived validation. Drives the `appearance=` marker in the API log. */
export function hasAppearance(appearance: CardAppearance): boolean {
  return Object.values(appearance).some((value) => value !== null);
}

/** What a card's design contributes to a {@link ContactCard} — the renderer's own vocabulary. */
export type AppearanceFields = Pick<
  ContactCard,
  "templateId" | "paletteId" | "groundHex" | "finish" | "texture" | "texturePresence" | "textureScale"
>;

/**
 * The owner's saved choice over the `kind`-derived default, **axis by axis**.
 *
 * ## ⚠ Per-axis, never all-or-nothing
 * The axes are independent. A card that chose Emerald but never touched the finish must get
 * Emerald *and* its template's finish — not the whole default look because one field was null,
 * and not a bare template because only one was set. `??` on each line is what makes "chose a
 * colour, left the rest alone" render the way the owner left it.
 *
 * `templateId` falls back rather than being derived-then-overridden, because it is the one axis
 * `resolveCard` cannot resolve without: `TEMPLATES[templateId]` must exist, and the template is
 * also where an unset `paletteId` gets its default.
 *
 * ## `groundHex` and the surface axes have no fallback, and must not get one
 * `groundHex` is the owner's *free* colour, and `CardSurface`'s contract is that absent means
 * "use the palette this card already resolves to". The four surface axes have their own defaults
 * in `resolveCardSurface`. Substituting anything here would repaint every card that never chose.
 *
 * `undefined`, not `null`: these are optional members of `ContactCard`, and `resolveCard` reads
 * `card.paletteId ?? template.paletteId`. A literal `null` is both a type error and a rendering
 * bug.
 */
export function appearanceFields(
  chosen: CardAppearance,
  fallback: { templateId: TemplateId; paletteId?: PaletteId },
): AppearanceFields {
  return {
    templateId: chosen.templateId ?? fallback.templateId,
    paletteId: chosen.paletteId ?? fallback.paletteId,
    groundHex: chosen.groundHex ?? undefined,
    finish: chosen.finish ?? undefined,
    texture: chosen.texture ?? undefined,
    texturePresence: chosen.texturePresence ?? undefined,
    textureScale: chosen.textureScale ?? undefined,
  };
}

/**
 * A design going **out** — the builder's state as `POST`/`PATCH /cards` wants it.
 *
 * ## ⚠ Every axis is sent on every write, `null` included
 * A `PATCH` that omits an axis leaves the stored value alone, so omitting "the owner cleared
 * their custom colour" would be indistinguishable from "the owner did not touch it" — and the
 * cleared colour would come back on the next read. Sending `null` is how a choice is *unmade*.
 *
 * `groundHex` is the only axis that is genuinely optional in the builder: the other four always
 * hold a concrete value once the Design panel has been opened, and sending the resolved value is
 * correct — it is what the owner is looking at.
 */
export function toAppearanceDto(source: AppearanceFields): Required<CardAppearanceDto> {
  return {
    templateId: source.templateId,
    paletteId: source.paletteId ?? null,
    groundHex: source.groundHex ?? null,
    finish: source.finish ?? null,
    texture: source.texture ?? null,
    texturePresence: source.texturePresence ?? null,
    textureScale: source.textureScale ?? null,
  };
}
