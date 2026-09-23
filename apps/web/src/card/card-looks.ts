import type { Finish } from "@/card/card-surface";
import { PALETTE_ORDER, TEMPLATE_PALETTES, type PaletteId } from "@/card/template-palettes";

/**
 * THE LOOKS — the twelve choices the builder actually offers, and what each one writes.
 *
 * ## Why a curated list rather than the dials
 *
 * The Design panel had six controls: Logo, Background, Finish, Texture, Strength, Size. Four of
 * those ask the owner to art-direct — "how strong should the grain be", "how large should the
 * dots be" — which is a question a person setting up a contact card has no reason to have an
 * opinion about, and the most likely way for them to make their own card worse.
 *
 * A look is a **named, pre-composed answer** to the two that reach the painted cover. Picking one
 * writes the card's existing columns and nothing else, so this file introduces no new state, no
 * new migration and no new wire format: `paletteId` and `finish` are two of the five the dials
 * were already writing.
 *
 * ⚠ **The dials are not deleted.** They live behind the panel's Advanced disclosure, together
 * with the custom-colour picker, because an owner with brand colours has a real need the twelve
 * cannot serve. This is a default, not a cage.
 *
 * ## ⚠ Why a look does NOT touch the three texture columns
 *
 * It would be tidier for a look to be a complete answer to all five, and it would be destructive:
 * the card page paints no motif at present — `<CardCover>` passes `texture="none"` while the
 * composition is evaluated without one — so a look that wrote `texture: "none"` would silently
 * erase a setting the owner had made in Advanced, to fix something they could not see. Wiping
 * invisible state is the worst kind of wipe, because nothing on screen explains it.
 *
 * So a look sets colour and finish, the three texture columns round-trip untouched, and the
 * Advanced dials remain their only writer. When the motif is switched back on, the looks that
 * want one gain a `texture` field and the pickers follow.
 *
 * ## What actually varies, and why twelve
 *
 * Two axes reach the painted cover, and they are exactly the two a look sets: the palette and
 * the finish. Nine palettes give nine
 * unmistakably different cards — that is the dominant axis and `template-palettes.ts` documents
 * at length why. `finish` is the second: `flat` is one colour, `gradient` a raking light, `mesh`
 * a bloom. Nine plus three finish-led alternates is twelve, which fills a four-column grid
 * exactly and is small enough to be read rather than scanned.
 */
export interface CardLook {
  /** Stable id — used as a React key and as the selected-state comparison. Never displayed. */
  id: string;
  /** What the owner reads. A material, not a number. */
  name: string;
  paletteId: PaletteId;
  finish: Finish;
}

/**
 * The nine palettes, each on `gradient`.
 *
 * Derived from `PALETTE_ORDER` rather than transcribed: a tenth palette appears here the moment
 * it is added to `TEMPLATE_PALETTES`, so the picker cannot silently fall behind the set. The
 * name is the palette's own — two names for one colour is how a user ends up unable to tell the
 * builder and the card apart.
 */
const PRESET_LOOKS: readonly CardLook[] = PALETTE_ORDER.map((paletteId) => ({
  id: `${paletteId}-gradient`,
  name: TEMPLATE_PALETTES[paletteId].name,
  paletteId,
  finish: "gradient" as const,
}));

/**
 * Three finish-led alternates, so the grid shows that finish is a real axis and not a dial.
 *
 * Chosen rather than generated: `flat` reads as a considered choice on a near-neutral ground and
 * as a mistake on a saturated one, and `mesh` needs a ground with enough chroma for the bloom to
 * be visible at all. Onyx flat, Sapphire mesh and Clay mesh are the three where the finish is
 * the point rather than a side effect.
 */
const FINISH_LOOKS: readonly CardLook[] = [
  { id: "onyx-flat", name: "Onyx Flat", paletteId: "onyx", finish: "flat" },
  { id: "sapphire-mesh", name: "Sapphire Bloom", paletteId: "sapphire", finish: "mesh" },
  { id: "clay-mesh", name: "Clay Bloom", paletteId: "clay", finish: "mesh" },
];

/**
 * ⚠ **Ivory leads, and that is a product decision rather than alphabetical luck.**
 *
 * It is the reference theme — the cream sheet, the gold marks, the black pill the client
 * approved — so it is the look a new card should be wearing before anybody touches this grid,
 * and the first cell is the one a user reads first. `PRESET_LOOKS` is derived from
 * `PALETTE_ORDER`, which would have put it last; pulling it out and prepending it is the only
 * hand-ordering in this file, and this comment is why.
 */
const IVORY_LOOK: CardLook = {
  id: "ivory-gradient",
  name: "Ivory",
  paletteId: "ivory",
  finish: "gradient",
};

export const CARD_LOOKS: readonly CardLook[] = [
  IVORY_LOOK,
  ...PRESET_LOOKS.filter((look) => look.paletteId !== "ivory"),
  ...FINISH_LOOKS,
];

/**
 * The look a card is currently wearing, or `null` when it is wearing none of them.
 *
 * `null` is the honest answer for a card on a custom `groundHex`, or on a palette/finish pair
 * the grid does not offer — and the picker shows no tick rather than guessing at the nearest
 * one. A grid that highlights a cell the card is not actually wearing is worse than a grid with
 * nothing highlighted: it tells the owner their card is something it is not.
 */
export function selectedLook(
  paletteId: PaletteId,
  finish: Finish,
  groundHex: string | undefined,
): CardLook | null {
  if (groundHex !== undefined) return null;
  return CARD_LOOKS.find((l) => l.paletteId === paletteId && l.finish === finish) ?? null;
}
