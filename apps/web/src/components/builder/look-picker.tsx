"use client";

import type { ReactElement } from "react";

import { CARD_LOOKS, type CardLook } from "@/card/card-looks";
import type { Finish } from "@/card/card-surface";
import { TEMPLATE_PALETTES, type PaletteId } from "@/card/template-palettes";

import { PreviewOption, PreviewOptionGroup } from "./preview-option";
import { SurfaceSwatch } from "./surface-swatch";

/**
 * THE LOOK PICKER — twelve pre-composed answers, and the panel's primary control.
 *
 * ## What it writes
 *
 * One click sets the card's palette AND its finish, and clears any custom `groundHex` — because
 * a look is a complete answer and a leftover custom colour would silently override the one the
 * owner just picked. `builder-client.tsx` dispatches the three in order; see {@link CARD_LOOKS}
 * for why those are the only columns a look touches.
 *
 * ## ⚠ The cells preview the LOOK, not the card
 *
 * Every other swatch in this panel paints from `palette` — the card's own palette out of the
 * screen's single `resolveCard` (I-5) — because it is demonstrating a *different axis* of the
 * card the owner already has. These cells are demonstrating a different **palette**, so they
 * necessarily read `TEMPLATE_PALETTES`. That is not an I-5 exception: I-5 is about nothing
 * re-resolving a *card*, and a preset table lookup resolves no card. `BackgroundPicker`'s preset
 * row does exactly the same thing for the same reason.
 *
 * ## Why the names are shown here and hidden there
 *
 * `BackgroundPicker` hides its captions: nine names under nine colours is 180px of type doing
 * work the colour does better. Here three of the twelve differ from another cell only by
 * finish — Onyx and Onyx Flat are the same hue — so the caption is the only thing that
 * distinguishes them, and hiding it would leave two cells that look nearly identical and
 * neither of them explained.
 */
export interface LookPickerProps {
  paletteId: PaletteId;
  finish: Finish;
  /** Set means the card is on a custom colour, so no look is selected. */
  groundHex: string | undefined;
  selected: CardLook | null;
  onSelect: (look: CardLook) => void;
}

export function LookPicker({ selected, onSelect }: LookPickerProps): ReactElement {
  return (
    <div data-look-picker="" data-selected-look={selected?.id ?? ""} className="w-full">
      <PreviewOptionGroup
        label="Card look"
        /* Radix reads `""` as "nothing selected", which is the honest state for a card on a
           custom colour or on a palette/finish pair the grid does not offer — see
           `selectedLook`. A grid that ticks a cell the card is not wearing is worse than one
           that ticks nothing. */
        value={selected?.id ?? ""}
        onValueChange={(value) => {
          const look = CARD_LOOKS.find((l) => l.id === value);
          if (look !== undefined) onSelect(look);
        }}
        className="grid grid-cols-4 gap-2"
      >
        {CARD_LOOKS.map((look) => (
          <PreviewOption
            key={look.id}
            value={look.id}
            data-look-option={look.id}
            name={look.name}
            compact
            selected={selected?.id === look.id}
          >
            {/* ⚠ `aspect-[4/5] w-full`, never `size-full`. The frame is a block span in a grid
                cell with no definite height, so a percentage height resolves against nothing and
                the swatch collapses — visible as a hairline. The aspect ratio derives the height
                from the width, which is always definite.
                4:5 rather than square: the card is a portrait object, and a square cell
                previewing a portrait surface reads as a colour chip rather than as a card. */}
            <SurfaceSwatch
              palette={TEMPLATE_PALETTES[look.paletteId]}
              finish={look.finish}
              /* The card page paints no motif, so neither does its preview — a cell showing a
                 texture the card will not wear is a promise the card breaks. */
              texture="none"
              className="aspect-[4/5] h-auto w-full rounded-[7px]"
            />
          </PreviewOption>
        ))}
      </PreviewOptionGroup>
    </div>
  );
}
