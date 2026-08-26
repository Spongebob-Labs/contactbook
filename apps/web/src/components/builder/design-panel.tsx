"use client";

import type { ReactElement } from "react";

import { FINISHES, TEXTURES, type Finish, type Texture, type TexturePresence, type TextureScale } from "@/card/card-surface";
import type { PaletteId, TemplatePalette } from "@/card/template-palettes";

import { BackgroundPicker, groundLabel } from "./background-picker";
import { PanelGroup, PanelRow } from "./panel-row";
import {
  FinishPicker,
  TexturePicker,
  TexturePresenceDial,
  TextureScaleDial,
} from "./surface-picker";

/**
 * The **Design** section — the card's colour and how that colour is painted.
 *
 * ## ⚠ Header layout moved out, and it is now the Layout section
 *
 * This panel used to carry all four axes. Three of them answer one question — *what colour is
 * this card and how is it painted* — and the fourth answers a different one: *how much of it do
 * you see*. Reading four `<h3>`s down one box gave no clue which of them were the same decision,
 * and it is the single biggest reason this screen read as cluttered.
 *
 * The rail's three stops are now the three real questions — Fields, Design, Layout — and
 * `HeaderLayoutPicker` is rendered by `builder-client.tsx` under the Layout heading. **Nothing
 * about the control changed**: same component, same reducer action, same live preview. Only
 * which heading it sits under.
 *
 * ## Why Colour folded in here rather than sitting beside it
 *
 * The column was **Fields, then Colour**. The obvious move was **Fields, Design, Colour** — and
 * it is wrong, because "Colour" and this panel's first control are the same axis. An owner
 * choosing a background would have met the nine presets in one section and the colour input in
 * another, with one selected state split across two boxes and no way to tell from the screen
 * which of the two the card was actually wearing. One axis, one control, one tick.
 *
 * So Design opens on Background, and the order inside it is the order the decisions depend on
 * each other: the colour is the input to everything below it — a wallpaper is a way of painting
 * *that colour*, and a pattern is tinted from the ink derived from *that colour*.
 *
 * ## Every control is live, and none of them is a mode
 *
 * There is no apply, no preview button and no wizard step; the single commit affordance on this
 * screen is Save, in the header, and it commits the card rather than the design. Each control
 * dispatches a reducer action and the pinned card page re-renders from the same state on the
 * next frame — which is why the behaviour is tested in `tests/unit/builder-reducer.test.ts`
 * without a browser, and why this file is composition and prose and nothing else.
 *
 * ## The one resolution (I-5) reaches every cell
 *
 * `palette` below is the card's own palette out of the screen's single `resolveCard` — curated
 * when the card is on a preset, derived when the owner has picked their own colour. Every cell
 * in every control paints from it, so the panel cannot come to disagree with the card about what
 * colour the card is. **Nothing here re-resolves a card.** The nine-live-cards colour picker,
 * which was I-5's one documented exception, is gone with the ShareFace thumbnails; the only
 * derivation left in the panel is the `derivePalette` call in `background-picker.tsx` that asks
 * whether a colour was clamped, and it paints nothing at all.
 */

export interface DesignPanelProps {
  paletteId: PaletteId;
  groundHex: string | undefined;
  finish: Finish;
  texture: Texture;
  texturePresence: TexturePresence;
  textureScale: TextureScale;
  /** ⚠ The card's palette from the one resolution. Never looked up from a preset table here. */
  palette: TemplatePalette;
  onPreset: (paletteId: PaletteId) => void;
  onGround: (hex: string) => void;
  onFinish: (finish: Finish) => void;
  onTexture: (texture: Texture) => void;
  onPresence: (presence: TexturePresence) => void;
  onScale: (scale: TextureScale) => void;
}

export function DesignPanel({
  paletteId,
  groundHex,
  finish,
  texture,
  texturePresence,
  textureScale,
  palette,
  onPreset,
  onGround,
  onFinish,
  onTexture,
  onPresence,
  onScale,
}: DesignPanelProps): ReactElement {
  const textured = texture !== "none";

  return (
    <div data-design-panel="" className="flex flex-col gap-8">
      <PanelGroup title="Colour">
        <PanelRow
          label="Background"
          hint="Every ink, button and line is derived from this."
          value={groundLabel(paletteId, groundHex)}
          id="ground"
          last
        >
          <BackgroundPicker
            paletteId={paletteId}
            groundHex={groundHex}
            palette={palette}
            finish={finish}
            texture={texture}
            onPreset={onPreset}
            onGround={onGround}
          />
        </PanelRow>
      </PanelGroup>

      <PanelGroup title="Surface">
        <PanelRow
          label="Finish"
          hint="How the colour is laid down."
          value={FINISHES[finish].name}
          id="finish"
        >
          <FinishPicker
            selected={finish}
            palette={palette}
            texture={texture}
            texturePresence={texturePresence}
            textureScale={textureScale}
            onSelect={onFinish}
          />
        </PanelRow>

        <PanelRow
          label="Texture"
          hint="Pressed into the ground, never painted over it."
          value={TEXTURES[texture].name}
          id="texture"
          last={!textured}
        >
          <TexturePicker
            selected={texture}
            palette={palette}
            finish={finish}
            texturePresence={texturePresence}
            textureScale={textureScale}
            onSelect={onTexture}
          />
        </PanelRow>

        {/* ⚠ Absent, not disabled — see the note in `surface-picker.tsx`. With no texture there
            is no strength or size to set, and a dial for a state you are not in is two tab
            stops that answer nothing. Both rows go together: they are one idea in two axes, and
            leaving one behind would read as a control that had failed to load. */}
        {!textured ? null : (
          <>
            <PanelRow label="Strength" id="presence">
              <TexturePresenceDial value={texturePresence} onSelect={onPresence} />
            </PanelRow>
            <PanelRow label="Size" id="scale" last>
              <TextureScaleDial value={textureScale} onSelect={onScale} />
            </PanelRow>
          </>
        )}
      </PanelGroup>
    </div>
  );
}
