"use client";

import { X } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Chip — the `--radius-full` pill: a `CardType` marker, a category-rail item, a filter
 * token, a status chip (§8.6).
 *
 * Static by default. `interactive` promotes it to a real `<button>` with `aria-pressed`
 * — a selectable div with an onClick is the accessibility failure this prop exists to
 * prevent. A chip is never both `interactive` and removable: that nests a button inside
 * a button, which is invalid HTML and unusable with a keyboard.
 */

export type ChipTone = "neutral" | "accent" | "warning" | "danger" | "success";
export type ChipSize = "sm" | "md";

const TONES: Record<ChipTone, string> = {
  neutral: "bg-surface-sunk text-ink border-line",
  accent: "bg-accent-wash text-accent border-accent-wash",
  warning: "bg-warning-wash text-warning-ink border-warning-wash",
  danger: "bg-danger-wash text-danger border-danger-wash",
  success: "bg-accent-wash text-success border-accent-wash",
};

const SELECTED_TONES: Record<ChipTone, string> = {
  neutral: "bg-ink text-ink-inverse border-ink",
  accent: "bg-accent text-accent-ink border-accent",
  warning: "bg-warning-ink text-ink-inverse border-warning-ink",
  danger: "bg-danger text-ink-inverse border-danger",
  success: "bg-accent text-accent-ink border-accent",
};

/**
 * 24px and 32px — **the pill's drawn height, which on touch is not its tap target.**
 *
 * A chip is a small pill by design and making it 44px tall on a phone would turn a filter rail
 * into a stack of buttons. So the *box* keeps its size at every width and an `interactive` chip
 * grows a transparent 44px hit area around it instead — see `INTERACTIVE_HIT` below. The
 * decorative (`<span>`) chip needs none: it is a label, not a control.
 */
const SIZES: Record<ChipSize, string> = {
  sm: "h-6 px-3 text-xs",
  md: "h-8 px-4 text-sm",
};

/**
 * The touch hit area for a chip that is really a button.
 *
 * ## ⚠ Why a pseudo-element and not padding
 *
 * `interactive` promotes the chip to a `<button>`, and the filter rails and the add-field
 * category rail are made of them — 24px and 32px tall, both well under the 44px floor. Padding
 * would fix the target and destroy the design: the pill would become a slab and a rail of eight
 * of them would no longer fit on a phone at all.
 *
 * `before:-inset-y-*` grows an invisible box **outside** the pill's border box, so the pointer
 * region reaches 44px vertically while the painted pill, the rail's gaps and its wrapping all
 * stay exactly as they are. Only the vertical axis needs it: `px-3`/`px-4` plus a label already
 * clears 44px horizontally on every chip in the product except a one-character one.
 *
 * `relative` is on the same string because the pseudo-element is absolutely positioned against
 * it, and `before:content-['']` is required or the box never generates.
 */
const INTERACTIVE_HIT: Record<ChipSize, string> = {
  sm: "relative max-md:before:absolute max-md:before:-inset-y-2.5 max-md:before:inset-x-0 max-md:before:content-['']",
  md: "relative max-md:before:absolute max-md:before:-inset-y-1.5 max-md:before:inset-x-0 max-md:before:content-['']",
};

export interface ChipClassNameOptions {
  tone?: ChipTone;
  size?: ChipSize;
  interactive?: boolean;
  selected?: boolean;
  className?: string;
}

/** The pill on its own, for a category-rail `<a>` that must not be wrapped in a button. */
export function chipClassName({
  tone = "neutral",
  size = "md",
  interactive = false,
  selected = false,
  className,
}: ChipClassNameOptions = {}): string {
  return cn(
    "inline-flex items-center gap-2 rounded-full border align-middle",
    "transition-colors duration-[var(--dur-fast)] ease-out",
    SIZES[size],
    /* The 44px touch region, only where the chip is actually a control. A decorative chip is a
       label and must not grow an invisible box that swallows taps meant for what is beside it. */
    interactive && INTERACTIVE_HIT[size],
    selected ? SELECTED_TONES[tone] : TONES[tone],
    interactive && !selected && "hover:bg-accent-wash hover:text-accent hover:border-accent-wash",
    className,
  );
}

export interface ChipProps extends Omit<ComponentPropsWithRef<"button">, "children"> {
  tone?: ChipTone;
  size?: ChipSize;
  /** Renders a `<button>` with `aria-pressed`. Without it the chip is a `<span>`. */
  interactive?: boolean;
  selected?: boolean;
  /** Decorative glyph before the label — 16px only (§8.8). */
  icon?: ReactNode;
  /** Renders a dismiss control. Mutually exclusive with `interactive` (no nested buttons). */
  onRemove?: () => void;
  /** Required when `children` is not a plain string — the dismiss control needs a name. */
  removeLabel?: string;
  children: ReactNode;
}

export function Chip({
  tone = "neutral",
  size = "md",
  interactive = false,
  selected = false,
  icon,
  onRemove,
  removeLabel,
  className,
  children,
  ...rest
}: ChipProps) {
  const shell = chipClassName({ tone, size, interactive, selected, className });

  const body = (
    <>
      {icon ? (
        <span aria-hidden="true" className="inline-flex size-4 items-center justify-center">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </>
  );

  if (interactive) {
    return (
      <button
        {...rest}
        type={rest.type ?? "button"}
        aria-pressed={selected}
        data-chip=""
        data-tone={tone}
        data-selected={selected ? "true" : undefined}
        className={shell}
      >
        {body}
      </button>
    );
  }

  return (
    <span data-chip="" data-tone={tone} className={shell}>
      {body}
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel ?? `Remove ${typeof children === "string" ? children : "filter"}`}
          onClick={onRemove}
          /* ⚠ 16x16 of glyph, 44x44 of target. This is the only control that dismisses a
             filter, and at `size-4` it was the smallest tap target in the entire product.
             The hit slop is a pseudo-element for the same reason the chip's own is: growing
             the button to 44px would blow the pill apart, and `-inset-3.5` puts a 44px
             region around a 16px X without moving a pixel of what is drawn. */
          className={cn(
            "-mr-1 inline-flex size-4 items-center justify-center rounded-full text-ink-3 hover:text-ink",
            "relative before:absolute before:-inset-3.5 before:content-['']",
          )}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </span>
  );
}
