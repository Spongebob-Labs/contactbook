import { derivePalette } from "@/card/derive-palette";
import { TEMPLATE_PALETTES, type TemplatePalette } from "@/card/template-palettes";
import { TEMPLATES } from "@/card/templates";
import type { ContactCard } from "@/types/domain";

/**
 * WHAT COLOUR IS THIS CARD — the cheap answer, for surfaces that draw a card without rendering it.
 *
 * ## Why this exists next to `resolveCard`
 *
 * `resolveCard` already resolves a palette, and it is the **only** correct answer for anything
 * that renders a card: it also resolves the fields, the QR payload, the surface axes and the
 * template, so preview and payload cannot disagree (I-5).
 *
 * The dashboard's charts need none of that. A reach bar wants one colour for one `cardId`, and
 * resolving eleven fields and a QR payload per row to get it would be work thrown away — on a
 * screen that already resolves the featured card properly.
 *
 * So this is the **same precedence, and nothing else**:
 *
 *     groundHex (free colour)  →  card.paletteId  →  the template's default
 *
 * ⚠ That order is not a convenience; it is the one `resolve-card.ts` documents and the one the
 * builder writes. A dashboard that ranked `paletteId` above `groundHex` would paint a bar in the
 * preset colour of a card the owner has since recoloured by hand, and the chart would disagree
 * with the card sitting beside it on the same page.
 *
 * ⚠ **Never use this to render a card.** It knows nothing about fields, masking or the QR, and a
 * caller that starts reaching for those from here is rebuilding `resolveCard` badly.
 */
export function cardPalette(card: ContactCard): TemplatePalette {
  if (card.groundHex !== undefined) {
    /* `flat` rather than the card's real finish: this returns one representative colour and the
       finish only changes how far apart the two gradient stops sit. Asking for the true finish
       would mean threading `SurfaceStyle` through every chart for a difference no bar shows. */
    return derivePalette(card.groundHex, "flat").palette;
  }

  const template = TEMPLATES[card.templateId];
  const paletteId = card.paletteId ?? template?.paletteId;
  const palette = paletteId === undefined ? undefined : TEMPLATE_PALETTES[paletteId];

  /* ⚠ Falls back rather than throwing, unlike `resolveCard`, and the difference is the caller.
     `resolveCard` throws on an unknown id because a card that cannot be resolved must not be
     handed to a recipient. This feeds a decorative swatch on the owner's own dashboard: a bad id
     should cost a grey bar, never a thrown error that takes the whole screen down with it. */
  return palette ?? TEMPLATE_PALETTES.onyx;
}

/**
 * The two colours any dashboard mark of a card is drawn with.
 *
 * ## ⚠ Why this is one shared helper and not a choice each component makes
 *
 * The reach bars and the attention list both mark the same cards on the same screen, and the
 * first pass had them disagree: the bars filled with `ground` while the list's rule used
 * `canvasActionBg`, so a Marigold card was **ochre in the chart and deep brown in the queue**.
 * A reader matching a row to a bar has no way to know those are one card. Two components each
 * making a reasonable local choice is exactly how that happens, so the choice is made once,
 * here, and both read it.
 *
 * ## Why two colours rather than one
 *
 * `fill` is what the card actually looks like — the thing a reader matches. But grounds come in
 * two tiers, and the four light ones nearly vanish on the white app canvas: Pistachio `#BFD48C`
 * measures about 1.6:1, under 1.4.11's 3:1 for a graphical object that carries meaning.
 *
 * `edge` is the fix, and it is not a workaround: 1.4.11 asks that the object's **boundary** be
 * discernible and "does not care whether the fill or the border provides it" — the exact reading
 * `buttonAltBorder` already runs on in `template-palettes.ts`. `canvasActionBg` is the slot
 * proven against `#FFFFFF` by `PALETTE_CONTRACT`, so an outline in it clears the bar on every
 * palette while the fill stays true to the card. On a deep ground the two nearly coincide and
 * the edge simply disappears, which is correct — a deep ground needs no help being seen.
 */
export interface CardSwatch {
  /** The colour the card wears. Match this to the card, not to a legibility proxy. */
  fill: string;
  /** A boundary proven ≥3:1 on the white app canvas. Always draw it with the fill. */
  edge: string;
}

export function cardSwatch(palette: TemplatePalette): CardSwatch {
  return { fill: palette.ground, edge: palette.canvasActionBg };
}

/** `cardId` → palette, for a list that draws many cards at once. */
export function cardPalettes(
  cards: readonly ContactCard[],
): ReadonlyMap<string, TemplatePalette> {
  return new Map(cards.map((card) => [card.id, cardPalette(card)]));
}
