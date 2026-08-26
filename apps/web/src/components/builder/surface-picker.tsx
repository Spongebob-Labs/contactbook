"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import type { ReactElement } from "react";

import {
  FINISHES,
  FINISH_ORDER,
  TEXTURES,
  TEXTURE_ORDER,
  TEXTURE_PRESENCE_ORDER,
  TEXTURE_SCALE_ORDER,
  type Finish,
  type Texture,
  type TexturePresence,
  type TextureScale,
} from "@/card/card-surface";
import type { TemplatePalette } from "@/card/template-palettes";
import { cn } from "@/lib/cn";

import { PreviewOption, PreviewOptionGroup } from "./preview-option";
import { SurfaceSwatch } from "./surface-swatch";

/**
 * **Finish**, **Texture** and the two dials — the controls that decide how the card's colour is
 * painted, once the colour itself has been chosen.
 *
 * Each export here is a **bare control cluster**: no heading, no caption, no width of its own.
 * `design-panel.tsx` puts each one in a `PanelRow` that supplies the name on the left. That
 * split is deliberate — a control that draws its own heading cannot be re-laid-out without
 * being rewritten, which is how the panel ended up as a column of competing blocks.
 *
 * ## ⚠ What this file replaces, and the defect that caused the rewrite
 *
 * It was `wallpaper-picker.tsx`: a **Wallpaper** control offering one axis of five —
 * `flat · gradient · mesh · grain · pattern` — and a **Pattern** control that appeared only in
 * pattern mode. It was reported, correctly, as "the worst patterns I have ever seen… they are
 * not at all visible… all the wallpapers look the same", and both halves of that had a cause:
 *
 * 1. **The motifs really were invisible.** `card-ground.tsx` drew them in `palette.ink`, so
 *    every mark spent contrast against the words above it and the solver clamped them to 0.060
 *    on Onyx — the panel's own default selection, and therefore the first thing anyone saw. The
 *    fix is in the renderer (see `textureDirection`), not here.
 * 2. **They really did all look the same, and that part was this file's fault.** One axis of
 *    five conflated *how the colour is laid down* with *what is cut into it*, so `flat`, `grain`
 *    and `pattern` were three cells of the same near-black rectangle and no motif could ever
 *    appear over a gradient. Two axes — three finishes, five textures — make fifteen grounds
 *    out of the same amount of picker.
 *
 * ## The comparison rule, unchanged and now actually load-bearing
 *
 * A picker is a comparison: **only the axis being chosen may vary.** The finish cells all carry
 * the owner's current texture; the texture cells all carry the owner's current finish; every
 * cell is painted on the owner's own colour by `<CardGround>` itself. That was true of the old
 * panel too, and it is what made the flaw visible — five cells that agree on everything except
 * an invisible variable look identical, because they are.
 *
 * ## Why the dials are absent rather than disabled
 *
 * `design-panel.tsx` does not render the two dial rows when the texture is `none`. A control for a state you are not
 * in occupies a scan, a tab stop and a screen-reader stop to offer a choice that cannot take
 * effect. The old file made the same argument about its Pattern control and it still holds —
 * with one thing removed: there is no longer a remembered value to preserve behind the absence,
 * because `texture` is its own axis and is never shadowed by the finish.
 *
 * `FINISHES`, `TEXTURES` and the two order arrays supply every name, blurb and tile edge.
 * Nothing here retypes one: a picker with its own copy of a label is a picker that can disagree
 * with the renderer about what the owner chose.
 */

/* ── Finish ─────────────────────────────────────────────────────────────────────────── */

export interface FinishPickerProps {
  selected: Finish;
  /** The card's palette, from the screen's single `resolveCard` (I-5). */
  palette: TemplatePalette;
  /** Held constant across the cells, so only the finish varies. */
  texture: Texture;
  texturePresence: TexturePresence;
  textureScale: TextureScale;
  onSelect: (finish: Finish) => void;
}

export function FinishPicker({
  selected,
  palette,
  texture,
  texturePresence,
  textureScale,
  onSelect,
}: FinishPickerProps): ReactElement {
  return (
    <PreviewOptionGroup
      label="Finish"
      value={selected}
      onValueChange={(value) => onSelect(value as Finish)}
      data-finish-picker=""
      data-selected-finish={selected}
      /* ⚠ `flex`, not the grid this used to be. In a row the cluster is ranged right against a
         common edge, so it has to be **content-width** — a three-column grid would stretch to
         the row and put 60px of air between three tiles. */
      className="flex flex-wrap justify-start gap-2 sm:justify-end"
    >
      {FINISH_ORDER.map((id) => (
        <PreviewOption
          key={id}
          value={id}
          data-finish-option={id}
          name={FINISHES[id].name}
          selected={id === selected}
          className="w-[5.5rem]"
        >
          {/* 56px over an 88px cell. Small enough that three sit in a row without the row
              owning the panel; tall enough that the gradient's rake and the mesh's three lobes
              still resolve, which was the whole reason these cells are renderings and not
              chips. Below that the two are indistinguishable and the control is decorative. */}
          <SurfaceSwatch
            palette={palette}
            finish={id}
            texture={texture}
            texturePresence={texturePresence}
            textureScale={textureScale}
            className="h-14 rounded-[10px]"
          />
        </PreviewOption>
      ))}
    </PreviewOptionGroup>
  );
}

/* ── Texture ────────────────────────────────────────────────────────────────────────── */

export interface TexturePickerProps {
  selected: Texture;
  palette: TemplatePalette;
  /** Held constant across the cells, so only the texture varies. */
  finish: Finish;
  texturePresence: TexturePresence;
  textureScale: TextureScale;
  onSelect: (texture: Texture) => void;
}

export function TexturePicker({
  selected,
  palette,
  finish,
  texturePresence,
  textureScale,
  onSelect,
}: TexturePickerProps): ReactElement {
  return (
    <PreviewOptionGroup
      label="Texture"
      value={selected}
      onValueChange={(value) => onSelect(value as Texture)}
      data-texture-picker=""
      data-selected-texture={selected}
      className="flex flex-wrap justify-start gap-2 sm:justify-end"
    >
      {TEXTURE_ORDER.map((id) => (
        <PreviewOption
          key={id}
          value={id}
          data-texture-option={id}
          name={TEXTURES[id].name}
          selected={id === selected}
          className="w-[3.75rem]"
        >
          {/* Square, 60px. A texture is judged on its *grain* rather than on its composition,
              and a square shows more repeats per pixel than the wide cell this used to be —
              `topo` tiles at 64 and `grain` at 160, so the old 68px-tall full-width cell showed
              less than one repeat of either and the owner was comparing crops. */}
          <SurfaceSwatch
            palette={palette}
            finish={finish}
            texture={id}
            texturePresence={texturePresence}
            textureScale={textureScale}
            className="aspect-square h-auto w-full rounded-[10px]"
          />
        </PreviewOption>
      ))}
    </PreviewOptionGroup>
  );
}

/* ── The two dials ──────────────────────────────────────────────────────────────────── */

/**
 * A compact segmented choice — the right shape for an axis whose options are an **ordered
 * intensity** rather than five different things.
 *
 * It is deliberately not a `PreviewOption` grid. Those cells exist to show a rendering you
 * cannot imagine from a label; "Subtle / Medium / Strong" is a label you can read, the result is
 * already live on the card two inches to the left, and three more 68px swatches for a dial would
 * out-weigh the axis they modify. It is not a slider either: three named stops are three named
 * stops, and a slider would invent a continuum the renderer does not have.
 *
 * Radix owns the keyboard for the same reason `PreviewOption` gives — a roving tabindex with
 * arrow-key wrap is what hand-rolled radio groups get wrong.
 */
function SegmentedChoice<T extends string>({
  label,
  value,
  options,
  format,
  onSelect,
  dataAttr,
}: {
  label: string;
  value: T;
  options: readonly T[];
  format: (id: T) => string;
  onSelect: (next: T) => void;
  dataAttr: string;
}): ReactElement {
  /* No visible label of its own: the `PanelRow` this sits in supplies it, and two copies of
     "Strength" is exactly the doubled-heading noise the row layout exists to remove. The
     accessible name still comes from the same string, so the two cannot drift. */
  return (
    <RadioGroupPrimitive.Root
      aria-label={label}
      value={value}
      onValueChange={(next) => onSelect(next as T)}
      /* Horizontal so arrow keys match the visual order — Radix's default orientation is
         vertical and would make Left/Right inert on a row. */
      orientation="horizontal"
      className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5"
    >
      {options.map((id) => (
        <RadioGroupPrimitive.Item
          key={id}
          value={id}
          {...{ [dataAttr]: id }}
          className={cn(
            "cursor-pointer rounded-[6px] px-3 py-1.5 text-sm transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            id === value
              ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              : "text-ink-3 hover:text-ink",
          )}
        >
          {format(id)}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

/** Sentence case off the union member, so the label cannot disagree with the value. */
function titleCase(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export interface TextureDialProps<T extends string> {
  value: T;
  onSelect: (next: T) => void;
}

/**
 * How strong the texture is, and how big — two controls, because they are two decisions.
 *
 * ⚠ **These exist because the contrast budget stopped being the binding constraint.** Under the
 * old ink-side motif there was nothing to offer: strength was rationed to 0.06–0.07, and a
 * "Strong" that rendered at 0.07 would have been a lie in the UI. A ground-side mark spends
 * nothing, so strength becomes the owner's to set — which is the difference between a picker
 * and an editor.
 */
export function TexturePresenceDial({
  value,
  onSelect,
}: TextureDialProps<TexturePresence>): ReactElement {
  return (
    <SegmentedChoice
      label="Strength"
      value={value}
      options={TEXTURE_PRESENCE_ORDER}
      format={titleCase}
      onSelect={onSelect}
      dataAttr="data-presence-option"
    />
  );
}

export function TextureScaleDial({
  value,
  onSelect,
}: TextureDialProps<TextureScale>): ReactElement {
  return (
    <SegmentedChoice
      label="Size"
      value={value}
      options={TEXTURE_SCALE_ORDER}
      format={titleCase}
      onSelect={onSelect}
      dataAttr="data-scale-option"
    />
  );
}
