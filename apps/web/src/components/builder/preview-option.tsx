"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Check } from "lucide-react";
import type { ComponentPropsWithRef, ReactElement, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { BUILDER_SCROLL_CLEAR } from "./scroll-clear";

/**
 * One cell of a builder picker: a **live rendering** of the thing you are choosing, that you
 * choose by clicking it.
 *
 * Four consumers now — the Design panel's background swatches, wallpaper styles, patterns and
 * header layouts — and the anatomy is the part that carries the three rules below. Adding a
 * fifth axis to the panel must inherit them rather than re-derive them:
 *
 * 1. **The cell renders the treatment, never a label or an abstract chip** (§8C.2). The gallery
 *    learned this first: a picker of named chips asks the owner to imagine the result, and the
 *    whole point of a live preview is that they do not have to. What goes inside the frame is
 *    the caller's business; that it is a real rendering is not.
 * 2. **Selection is a 2px `--accent` border *and* a tick** (§8D.4). Colour is never a status —
 *    and on a picker whose cells are themselves nine different colours, a colour-only selection
 *    marker is close to invisible.
 * 3. **Radix owns the keyboard.** A radiogroup needs a roving tabindex and arrow-key wrap, which
 *    hand-rolled versions get wrong and axe always catches. Only the visual layer is ours (Q29)
 *    — `primitives/radio-group.tsx` is a dot-and-label list and is deliberately not bent into a
 *    grid of cards.
 *
 * ## ⚠ What changed when the material system arrived
 *
 * This used to take a `ResolvedCard` and render a `<ShareFace mode="thumb">` itself, because its
 * one consumer was a nine-palette picker whose cells were whole wallet passes. Both halves of
 * that stopped being true at once:
 *
 * · **The wallet face is the wrong object to preview a card *page* axis with.** The face is one
 *   fixed 336×500 format whose only permitted variation is colour (DESIGN.md); wallpapers,
 *   patterns and header layouts do not apply to it at all. A Design panel whose first control
 *   previewed the pass while its other three previewed the page would be comparing two different
 *   objects, and the first one would silently ignore three of the four choices.
 * · **A whole card per cell buys nothing when the axis is the ground.** Nine faces are nine
 *   copies of the same name and the same QR, at 96px, around the one rectangle of colour the
 *   owner is actually judging — while the real card, at full size, is pinned two inches to the
 *   left and updates on the same frame.
 *
 * So the frame takes `children`. The cell is still a live rendering; what it renders is now the
 * caller's to decide, and the three rules above did not move.
 */

export interface PreviewOptionGroupProps
  extends Omit<ComponentPropsWithRef<typeof RadioGroupPrimitive.Root>, "children"> {
  /**
   * Names the group in the accessibility tree. There is no visible label of its own — the
   * control's own heading above it is what a sighted reader sees, and this is the same word so
   * the two cannot disagree.
   */
  label: string;
  children: ReactNode;
}

export function PreviewOptionGroup({
  label,
  className,
  children,
  ...rest
}: PreviewOptionGroupProps): ReactElement {
  return (
    <RadioGroupPrimitive.Root
      {...rest}
      aria-label={label}
      className={cn("grid gap-3", className)}
    >
      {children}
    </RadioGroupPrimitive.Root>
  );
}

export interface PreviewOptionFrameProps {
  /** Drawn only on the selected cell, so a test can assert the tick and not just the border. */
  selected: boolean;
  /** See {@link PreviewOptionProps.compact} — tightened chrome and an overhanging tick. */
  compact?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * The selection marker, extracted so the one control that is **not** a radio can wear it too.
 *
 * The Background control's custom-colour swatch is an `<input type="color">`: it opens the
 * platform's colour picker, so it cannot also be a `RadioGroup.Item` without nesting one
 * interactive control inside another. It is still the same axis and still shows the same
 * selected state, and the only way to guarantee those two look identical is for there to be one
 * of them.
 */
export function PreviewOptionFrame({
  selected,
  compact = false,
  className,
  children,
}: PreviewOptionFrameProps): ReactElement {
  return (
    <span
      data-preview-option-frame=""
      data-compact={compact ? "" : undefined}
      className={cn(
        // A border rather than an outline: §8.3's single global `:focus-visible` rule owns
        // `outline`, and a selected-and-focused cell has to be able to show both at once.
        "relative block border-2",
        /* ⚠ **The radius is 14, not `rounded-xl`, and the two are not interchangeable.**
           `--radius-xl` is 20px — a token sized for cards and panels. Nested outside a 10px
           swatch with 4px of chrome between them it produced three different curves in 14px of
           space, which is what made a selected cell read as a blob rather than as a frame. The
           rule for any nested radius: **outer = inner + the gap between them.** 10 + 4 = 14. */
        compact ? "rounded-[11px] p-[2px]" : "overflow-hidden rounded-[14px] p-0.5",
        selected ? "border-accent" : "border-transparent",
        className,
      )}
    >
      {children}

      {selected ? (
        <span
          data-preview-option-tick=""
          aria-hidden="true"
          className={cn(
            "absolute inline-flex items-center justify-center rounded-full bg-accent text-accent-ink",
            /* ⚠ In compact the tick **overhangs the corner**, which is why compact frames are
               not `overflow-hidden`. A badge that sits *inside* a 32px swatch covers the one
               thing the swatch exists to show — at the old size-5 it was literally larger than
               the 16px of colour it was marking. The `ring` is what keeps it legible where it
               overlaps a ground of any luminance. */
            compact
              ? "-end-1 -top-1 size-4 ring-2 ring-surface"
              : "end-1.5 top-1.5 size-5",
          )}
        >
          <Check className={compact ? "size-2.5" : "size-3"} strokeWidth={3} />
        </span>
      ) : null}
    </span>
  );
}

export interface PreviewOptionProps
  extends Omit<ComponentPropsWithRef<typeof RadioGroupPrimitive.Item>, "children"> {
  /** The caption under the frame — a colour name, a style name, a layout name. */
  name: string;
  /** A second caption line. The contract's own blurb, where the axis has one. */
  blurb?: string;
  /**
   * Keep `name` as the accessible name but draw no caption.
   *
   * ⚠ For cells whose rendering **is** the label. Nine colour swatches captioned with nine
   * colour names spent ~180px of the panel restating what each swatch already shows, and the
   * chosen one is named by its `PanelRow`'s value line anyway. Never set this on a cell whose
   * meaning is not visible — `grain` and `dots` at 60px are told apart by looking, a `Finish`
   * tile's difference from its neighbour is not always.
   */
  hideName?: boolean;
  selected: boolean;
  /**
   * Chrome-free sizing for cells that are **all content** — a 32px colour swatch and nothing
   * else. Drops the cell's padding, tightens the frame, and moves the tick out to overhang the
   * corner instead of covering the swatch. Never set it on a captioned cell.
   */
  compact?: boolean;
  /** The live rendering inside the frame. */
  children: ReactNode;
}

export function PreviewOption({
  name,
  blurb,
  hideName = false,
  compact = false,
  selected,
  className,
  children,
  ...rest
}: PreviewOptionProps): ReactElement {
  return (
    <RadioGroupPrimitive.Item
      {...rest}
      className={cn(
        "flex min-w-0 cursor-pointer flex-col items-stretch text-left",
        /* ⚠ **Compact cells carry no padding, and that is the whole fix for the colour row.**
           `p-1.5` is 12px of horizontal chrome; on the 36px cell the colour swatches used to
           be, plus the frame's own 8px, it left **16px of visible colour** — less than the tick
           sitting on it. A captioned cell can afford the padding because it is 88px wide. */
        compact ? "rounded-[11px]" : "gap-1.5 rounded-[14px] p-1.5 hover:bg-surface-sunk",
        "transition-colors duration-[var(--dur-fast)] ease-out",
        /* The global `:focus-visible` outline is drawn at offset 0, which on a captioned cell
           runs straight through the caption's baseline and reads as a rendering fault. Pushing
           it clear costs nothing and is the same ring. */
        "focus-visible:outline-offset-2",
        // Keeps a tapped or focused cell clear of the sticky preview on a phone.
        BUILDER_SCROLL_CLEAR,
        className,
      )}
    >
      <PreviewOptionFrame selected={selected} compact={compact}>
        {children}
      </PreviewOptionFrame>

      <span className={cn("flex min-w-0 flex-col gap-0.5 px-0.5", hideName && "sr-only")}>
        {/* ⚠ Not `truncate`. Every name in every picker comes from a contract table
            (`TEMPLATE_PALETTES`, `FINISHES`, `TEXTURES`) and is one
            short word, so clipping protects against nothing — while at five cells across it
            was actively wrong, printing "Periwink…" for a colour whose whole cell is that
            colour's name. A name that ever needed two lines gets two lines. */}
        <span data-preview-option-name="" className="text-sm text-ink">
          {name}
        </span>
        {blurb === undefined ? null : (
          <span data-preview-option-blurb="" className="text-xs text-ink-3">
            {blurb}
          </span>
        )}
      </span>
    </RadioGroupPrimitive.Item>
  );
}
