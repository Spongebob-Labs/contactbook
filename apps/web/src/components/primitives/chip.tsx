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

const SIZES: Record<ChipSize, string> = {
  sm: "h-6 px-3 text-xs",
  md: "h-8 px-4 text-sm",
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
          className="-mr-1 inline-flex size-4 items-center justify-center rounded-full text-ink-3 hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </span>
  );
}
