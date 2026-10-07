import type { BuilderState } from "@/components/builder/builder-reducer";
import { toAppearanceDto } from "@/lib/api/card-appearance";
import type { UpdateCardDto } from "@/lib/api/schema";
import type { ContactCard } from "@/types/domain";

/**
 * The pure half of the workspace's card draft: what counts as a change, how a field joins or
 * leaves the draft, and the two bodies **Save changes** sends. No React, so all of it is
 * unit-testable.
 *
 * Client, 2026-10-07: edits to a card are no longer written as they are made. Adding or removing
 * a field, renaming the card, its position and bio, and its look all change a local draft; the
 * owner commits them with one **Save changes** button. Whether that button shows is a comparison
 * of the draft with the last saved card — never a count of edits — so adding a field and taking
 * it off again leaves nothing to save.
 */

/** The card columns the draft can change through `PATCH /cards/{id}`, as they would be stored. */
export interface CardDesignValues {
  name: string;
  templateId: BuilderState["templateId"];
  paletteId: BuilderState["paletteId"];
  /** `null` while a preset is in use. Lower-cased: a colour is the same colour in either case. */
  groundHex: string | null;
  finish: BuilderState["finish"];
  texture: BuilderState["texture"];
  texturePresence: BuilderState["texturePresence"];
  textureScale: BuilderState["textureScale"];
  headline: string;
  bio: string;
}

/** A builder state reduced to what a save would store — trimmed, as `designPayload` sends it. */
export function designValues(state: BuilderState): CardDesignValues {
  return {
    name: state.name.trim(),
    templateId: state.templateId,
    paletteId: state.paletteId,
    groundHex: state.groundHex === undefined ? null : state.groundHex.toLowerCase(),
    finish: state.finish,
    texture: state.texture,
    texturePresence: state.texturePresence,
    textureScale: state.textureScale,
    headline: state.headline.trim(),
    bio: state.bio.trim(),
  };
}

const DESIGN_KEYS: readonly (keyof CardDesignValues)[] = [
  "name",
  "templateId",
  "paletteId",
  "groundHex",
  "finish",
  "texture",
  "texturePresence",
  "textureScale",
  "headline",
  "bio",
];

/** The design columns that differ between two states. Empty means there is nothing to save. */
export function changedDesignKeys(
  draft: BuilderState,
  saved: BuilderState,
): (keyof CardDesignValues)[] {
  const a = designValues(draft);
  const b = designValues(saved);
  return DESIGN_KEYS.filter((key) => a[key] !== b[key]);
}

/** Two field sets in the same order. Order is compared because it is what `PUT` stores. */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** How many fields were added or removed — the size of the symmetric difference. */
export function fieldChangeCount(draft: readonly string[], saved: readonly string[]): number {
  const inDraft = new Set(draft);
  const inSaved = new Set(saved);
  let count = 0;
  for (const id of inDraft) if (!inSaved.has(id)) count += 1;
  for (const id of inSaved) if (!inDraft.has(id)) count += 1;
  return count;
}

/**
 * The draft's field set after one field is switched on or off.
 *
 * A field the saved card already carried goes back **where the saved card had it**, not to the
 * end, so taking a field off and putting it back returns the draft to exactly the saved set and
 * the Save button goes away again. A field the saved card never had is appended.
 */
export function withField(
  current: readonly string[],
  saved: readonly string[],
  fieldId: string,
  on: boolean,
): readonly string[] {
  const present = current.includes(fieldId);
  if (on === present) return current;
  if (!on) return current.filter((id) => id !== fieldId);
  if (!saved.includes(fieldId)) return [...current, fieldId];

  const keep = new Set([...current, fieldId]);
  const fromSaved = saved.filter((id) => keep.has(id));
  const added = current.filter((id) => !saved.includes(id));
  return [...fromSaved, ...added];
}

/** The body for `PATCH /cards/{id}`: the name, the seven design axes, the position and the bio. */
export function designPayload(state: BuilderState): UpdateCardDto {
  const name = state.name.trim();
  const headline = state.headline.trim();
  const bio = state.bio.trim();
  return {
    /* An emptied name is refused before a save starts; omitting it here is the second guard,
       because the API would reject a card called "". */
    ...(name === "" ? {} : { name }),
    ...toAppearanceDto(state),
    /* Cleared becomes an explicit `null` — an omitted key would leave the old value in place.
       ⚠ `coverUrl` is never here: `PATCH` accepts only `null` for it, so sending it would
       delete the cover. The cover has its own upload and delete. */
    headline: headline === "" ? null : headline,
    bio: bio === "" ? null : bio,
  };
}

/** The draft's design axes laid over the server's card. Fields, logo and cover are untouched. */
export function applyDesign(card: ContactCard, draft: BuilderState): ContactCard {
  /* Dropped, then re-added only when set — the builder's own shape, so `resolveCard` can tell
     "no choice" from "this value". */
  const { groundHex: _ground, headline: _headline, bio: _bio, ...rest } = card;
  void _ground;
  void _headline;
  void _bio;
  return {
    ...rest,
    name: draft.name,
    templateId: draft.templateId,
    paletteId: draft.paletteId,
    ...(draft.groundHex === undefined ? {} : { groundHex: draft.groundHex }),
    finish: draft.finish,
    texture: draft.texture,
    texturePresence: draft.texturePresence,
    textureScale: draft.textureScale,
    ...(draft.headline.trim() === "" ? {} : { headline: draft.headline }),
    ...(draft.bio.trim() === "" ? {} : { bio: draft.bio }),
  };
}
