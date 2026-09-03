"use client";

import { Info } from "lucide-react";
import { useMemo, type ReactElement } from "react";

import type { Finish, Texture } from "@/card/card-surface";
import { derivePalette } from "@/card/derive-palette";
import {
  PALETTE_ORDER,
  TEMPLATE_PALETTES,
  type PaletteId,
  type TemplatePalette,
} from "@/card/template-palettes";
import { Field } from "@/components/primitives";
import { cn } from "@/lib/cn";
import { relativeLuminance } from "@/lib/contrast";

import { PreviewOption, PreviewOptionFrame, PreviewOptionGroup } from "./preview-option";
import { BUILDER_SCROLL_CLEAR } from "./scroll-clear";
import { SurfaceSwatch } from "./surface-swatch";

/**
 * **Background** — the Design panel's first control, and the whole of the colour axis.
 *
 * ## Why the nine presets and the colour input are one control and not two
 *
 * They are the same decision. "What colour is this card" has one answer, and a screen that asked
 * it twice would have to invent a precedence rule the owner never saw — a tick on Sapphire above
 * a colour input still holding last week's plum, with the card rendering one of them for reasons
 * nobody can read off the screen. So there is one axis here with one selected state:
 * `groundHex` set means the custom swatch wears the tick, `groundHex` absent means one of the
 * nine does, and the reducer's `palette` action clears the free colour precisely so that this
 * stays true (see `builder-reducer.ts`).
 *
 * The presets did not become decoration. They are, in DESIGN.md's words, the well-lit starting
 * points of a continuous space: nine grounds whose every derived value — two gradient stops, two
 * inks, a line and three button pairs — was measured against every stop by
 * `tests/contract/template-palettes.test.ts`. A card on a preset keeps all nine of those values;
 * only a card that goes off-piste is derived.
 *
 * ## Why the cells are swatches now, when the colour picker used to be nine live cards
 *
 * It used to render nine `<ShareFace>` thumbnails, on the argument that a swatch cannot show
 * whether your name reads on that ground. That argument was right and it has been answered
 * somewhere better:
 *
 * · **The system now guarantees it.** `derivePalette` searches for inks and buttons that clear
 *   their contracts on both stops, and *clamps the ground itself* when neither ink can — so
 *   "does my name read on this" is no longer a question the owner has to answer by eye. What is
 *   left for them to judge is the colour, which is exactly what a swatch shows.
 * · **The real card is pinned two inches away**, at full size, with their actual name on it, and
 *   it updates on the same frame this is clicked. Nine 96px copies of it were nine worse
 *   answers to a question already being answered better.
 * · **The face was the wrong object anyway.** Wallpapers, patterns and header layouts do not
 *   apply to the wallet pass (DESIGN.md), so a colour cell drawn as a pass would have ignored
 *   the other three controls in this very panel.
 *
 * ⚠ A consequence worth stating where somebody will find it: the nine `[data-qr-zone]`
 * thumbnails that `tests/e2e/qr-scannability.spec.ts` counts inside `[data-palette-picker]` no
 * longer exist, because the thumbnails no longer exist. That file belongs to the QR track.
 *
 * ## The clamp note
 *
 * `derivePalette` reports `clamped` when the chosen colour fell inside `LEGIBILITY_DEAD_BAND` —
 * the luminance band where neither white nor near-black ink can clear the 7:1 headroom rule — and
 * hands back a sentence saying so. It is shown here, next to the input, quietly: it is the
 * product keeping Principle 3's promise (*freedom with a floor*), not the owner making a
 * mistake. Nothing is rejected, nothing turns red, and the colour they picked stays in the
 * input; the card simply wears the nearest legal version of it and says so.
 */

export interface BackgroundPickerProps {
  /** The curated palette in force while there is no free colour. */
  paletteId: PaletteId;
  /** The free ground, or `undefined` while a preset is in force. */
  groundHex: string | undefined;
  /**
   * The card's own palette, from the screen's single `resolveCard` (I-5) — curated or derived,
   * whichever the card resolved to. Read for the colour input's starting value, so opening the
   * platform picker starts on the card's colour rather than on black.
   */
  palette: TemplatePalette;
  /**
   * The other two axes, held constant across the nine cells. A picker is a comparison, so the
   * only thing that may vary between cells is the axis being chosen — nine grounds under the
   * owner's *own* wallpaper, not nine grounds under a default one.
   */
  finish: Finish;
  texture: Texture;
  onPreset: (paletteId: PaletteId) => void;
  onGround: (hex: string) => void;
}

/**
 * Ids are fixed rather than generated: `<Field>` wires the label, and the clamp note has to be
 * addressable from the input's `aria-describedby` across a render in which it appears. There is
 * exactly one Background control on the screen, so a constant cannot collide.
 */
const HEX_INPUT_ID = "builder-ground-hex";
const CLAMP_NOTE_ID = "builder-ground-clamp";

/**
 * The custom ground's name, used twice — once as the input's accessible label and once as the
 * visible caption over its row.
 *
 * One constant rather than two strings, because the two must match: a voice-control user reads
 * the caption and says it, and the browser matches what they said against the *accessible*
 * name. A caption reading "Your own" over a control named "Custom colour" is a control that
 * cannot be operated by voice at all, and nothing on screen would show it.
 */
const CUSTOM_LABEL = "Custom colour";

/** What `derivePalette` will parse. Anything else is not asked about — see the note at the call. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * The nine presets, in their two families.
 *
 * ## Why the grid is captioned rather than just wrapped
 *
 * Nine cells in a five-wide grid wrap 5 + 4, which looks like a grid that ran out of colours.
 * It is not: **the system contains exactly five deep grounds and four light ones, and nothing in
 * between, and that is arithmetic rather than taste.** Only two inks exist — white and
 * near-black — and the 7:1 headroom rule means white needs a very dark ground and near-black a
 * fairly light one. The luminance band between them cannot carry either, so no card in this
 * product has a mid-tone ground (`derive-palette.ts` clamps a colour that lands there to the
 * nearer edge and says so). The ragged row is the shape of that fact; captioning it turns an
 * apparent gap into the two real choices an owner is picking between.
 *
 * ## ⚠ The split is DERIVED from the palettes, never listed
 *
 * A hand-written list of which five are deep is a second source of truth that goes stale the
 * first time a palette is added or re-tuned — silently, because a mis-filed swatch still renders
 * perfectly. `ink` already answers the question exactly: a palette whose ink is light is a
 * palette standing on a deep ground, by construction, because that ink was *chosen* to clear
 * 7:1 on it. So the families are computed from the contract's own values.
 */
const DEEP_INK_LUMINANCE = 0.5;

interface PaletteFamily {
  id: "deep" | "light";
  label: string;
  ids: readonly PaletteId[];
}

const PALETTE_FAMILIES: readonly PaletteFamily[] = [
  {
    id: "deep",
    label: "Deep",
    ids: PALETTE_ORDER.filter(
      (id) => relativeLuminance(TEMPLATE_PALETTES[id].ink) > DEEP_INK_LUMINANCE,
    ),
  },
  {
    id: "light",
    label: "Light",
    ids: PALETTE_ORDER.filter(
      (id) => relativeLuminance(TEMPLATE_PALETTES[id].ink) <= DEEP_INK_LUMINANCE,
    ),
  },
];

/** The name the Design panel shows on the Colour row: a preset's name, or the free hex. */
export function groundLabel(paletteId: PaletteId, groundHex: string | undefined): string {
  return groundHex ?? TEMPLATE_PALETTES[paletteId].name;
}

export function BackgroundPicker({
  paletteId,
  groundHex,
  palette,
  finish,
  texture,
  onPreset,
  onGround,
}: BackgroundPickerProps): ReactElement {
  const custom = groundHex !== undefined;

  /**
   * ⚠ The one call to `derivePalette` in the builder, and it is here for one reason: to ask
   * whether the owner's colour was moved, and what to tell them about it.
   *
   * It does **not** paint anything. The palette the card actually wears is resolved with the
   * card, once, by the screen (I-5) — a second derivation used for rendering would be the old
   * build's "the preview differs from the payload" defect with a new coat of paint. This asks a
   * question about a colour; it does not answer one about a card.
   *
   * `derivePalette` throws on a colour it cannot parse, deliberately, so its callers cannot
   * quietly ignore half of what they are given. The guard is not a disagreement with that: this
   * hex can come off a stored card rather than from the input below, and the Design panel is the
   * wrong place for a malformed stored value to take the whole builder down (§11 E-34's rule,
   * applied to a colour). No note is the honest outcome — there is nothing to say about a colour
   * the engine never saw.
   */
  const clampNote = useMemo(() => {
    if (groundHex === undefined || !HEX.test(groundHex)) return null;
    const derived = derivePalette(groundHex, finish);
    return derived.clamped ? derived.clampNote : null;
  }, [groundHex, finish]);

  return (
    <div
      data-background-picker=""
      data-selected-ground={groundHex ?? paletteId}
      className="flex w-full flex-col items-start gap-3 sm:items-end"
    >
      {/* ⚠ **One flow of ten swatches, and the Deep/Light captions are gone.**
          They were two captioned grids, and the captions were explaining something the eye
          already had: a deep ground looks deep. What the split really encoded — the dead band
          in the middle that no ground may occupy — is arithmetic enforced by `derivePalette`,
          not a thing the owner picks between. Order still runs deep-then-light, so the reading
          survives without the chrome. */}
      <PreviewOptionGroup
        label="Background colour"
        /* Radix reads `""` as "nothing in this group is selected", which is exactly the state a
           custom colour puts it in: the tick has moved out of the group and onto the swatch
           below, and no preset may keep wearing one. */
        value={custom ? "" : paletteId}
        onValueChange={(value) => onPreset(value as PaletteId)}
        className="flex flex-wrap justify-start gap-2 sm:justify-end"
      >
        {PALETTE_FAMILIES.flatMap((family) => family.ids).map((id) => (
          <PreviewOption
            key={id}
            value={id}
            data-ground-option={id}
            /* ⚠ No visible caption. Nine names under nine swatches was ~180px of type doing
               work the swatch does better, and the chosen one is named by the row's own value
               line. The accessible name is unchanged, so nothing is lost to a screen reader. */
            name={TEMPLATE_PALETTES[id].name}
            hideName
            compact
            selected={!custom && id === paletteId}
            /* ⚠ 44px on touch, 40px on a pointer, and the row still packs five across.
               40px was under the 44px floor on the one control an owner taps nine times in a
               row while comparing colours. The arithmetic is tight and it was checked: at a
               320px viewport the panel's inner width is 254px, and 5 × 44 + 4 × 8 = 252 ≤ 254,
               so the grid keeps its 5 + 4 wrap and gains nothing to scroll. The colour inside
               grows from 32px to 36px with it. */
            className="w-10 max-md:w-11"
          >
            {/* 40px cell − 4px border − 4px inset = **32px of colour**. It was 16px: the cell's
                own `p-1.5` and the frame's `rounded-xl` chrome ate more of the swatch than the
                swatch had left, and the selected tick was wider than the colour under it. */}
            {/* ⚠ `aspect-square w-full`, never `size-full`. The frame is a `block` span in a
                flex column with no definite height, so a percentage height resolves against
                nothing and the swatch collapses to 0 — visible as a 40×8 frame. The aspect
                ratio derives the height from the width instead, which is always definite. */}
            <SurfaceSwatch
              palette={TEMPLATE_PALETTES[id]}
              finish={finish}
              texture={texture}
              className="aspect-square h-auto w-full rounded-[7px]"
            />
          </PreviewOption>
        ))}
      </PreviewOptionGroup>

      {/* ── the tenth ground ─────────────────────────────────────────────────────
          Still outside the `RadioGroup.Root`, and it has to be: an `input type="color"` opens
          the platform picker, so it cannot also be a `RadioGroup.Item` without nesting one
          interactive control inside another. `PreviewOptionFrame` is what makes the two look
          like one set — the same 2px accent border and the same tick, from the same component,
          so a selected custom colour cannot come to look different from a selected preset. */}
      <div
        data-ground-custom=""
        data-ground-custom-selected={custom ? "true" : "false"}
        className="flex w-full flex-col items-start gap-2 sm:items-end"
      >
        <Field label={CUSTOM_LABEL} hideLabel id={HEX_INPUT_ID}>
          {({ id, describedBy }) => (
            /* ⚠ **The custom swatch is dimensionally identical to the nine above it**, and that
               is what makes the wrap read as a continuation of the same row rather than as an
               orphaned second control. It was a 64×44 rounded rectangle beside nine 36px
               circles, which said "different kind of thing" about the tenth member of one axis.
               The visible caption stays: it is the same string as the input's accessible name,
               so a voice-control user saying what they can see hits the control they mean. */
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="text-xs text-ink-4">
                {CUSTOM_LABEL}
              </span>
              <PreviewOptionFrame selected={custom} compact>
                <input
                  id={id}
                  type="color"
                  /* The card's current ground, so the platform picker opens on the colour the
                     owner is looking at rather than on black.

                     Lower-cased because the DOM normalises `value` on a colour input and would
                     otherwise disagree with React's copy of it on every render — harmless, but
                     it makes the element re-written on each pass for no reason, and it makes
                     `toHaveValue` in the suite depend on which of the two you happened to read. */
                  value={(groundHex ?? palette.ground).toLowerCase()}
                  onChange={(event) => onGround(event.target.value.toUpperCase())}
                  aria-describedby={
                    [describedBy, clampNote === null ? undefined : CLAMP_NOTE_ID]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  className={cn(
                    /* ⚠ 44px on touch. This input is the ONLY route to any colour outside the
                       nine presets, and `size-8` made it a 32px target — the `PreviewOptionFrame`
                       around it looks like it adds slop, but that padding is on a plain
                       `<span>`, not a `<label>`, so tapping it does nothing at all. The live
                       target really was 32px.
                       The radius steps with the size so the swatch stays concentric inside the
                       frame's own `rounded-xl` chrome. */
                    "block size-8 max-md:size-11 max-md:rounded-[9px] cursor-pointer appearance-none rounded-[7px] border-0 bg-transparent p-0",
                    // The platform draws the swatch inside its own two shadow parts; without
                    // these it arrives as a bevelled grey chip with 2px of inset padding that
                    // no amount of styling on the input itself can reach.
                    "[&::-moz-color-swatch]:rounded-[7px] [&::-moz-color-swatch]:border-0",
                    "[&::-webkit-color-swatch-wrapper]:p-0",
                    "[&::-webkit-color-swatch]:rounded-[7px] [&::-webkit-color-swatch]:border-0",
                    /* The platform swatch draws its own corners, so the touch radius has to
                       reach it too or a 44px chip renders with 7px corners inside 9px ones. */
                    "max-md:[&::-moz-color-swatch]:rounded-[9px]",
                    "max-md:[&::-webkit-color-swatch]:rounded-[9px]",
                    BUILDER_SCROLL_CLEAR,
                  )}
                />
              </PreviewOptionFrame>
            </div>
          )}
        </Field>

        {clampNote === null ? null : (
          /* Calm, and deliberately not an error: nothing failed, and the owner is not being
             corrected. `role="status"` because it can appear while the platform picker has
             focus and the input's own description would never be re-read. Never colour alone —
             the icon and the sentence carry it, and neither is `--danger`. */
          <p
            id={CLAMP_NOTE_ID}
            data-ground-clamp=""
            role="status"
            className="flex max-w-[34ch] items-start gap-2 text-xs text-ink-2 sm:text-right"
          >
            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
            <span>{clampNote}</span>
          </p>
        )}
      </div>
    </div>
  );
}
