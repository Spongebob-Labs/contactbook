"use client";

import { useId, type ComponentPropsWithRef, type MouseEvent } from "react";

import { cn } from "@/lib/cn";

/**
 * Button — one component, five variants, two sizes (spec §8D.7).
 *
 * Behaviour notes that downstream tracks depend on and must not re-solve:
 *
 * · **Disabled is `aria-disabled`, never the native attribute.** A natively disabled
 *   button leaves the tab order and announces nothing about why it is dead, which fails
 *   AC-26 and the §8D.7 sentence "an `aria-disabled` explanation". Pass `disabledReason`
 *   and the control stays focusable, announces the reason, and swallows the click.
 * · **Disabled text is `--ink-3`, not `--ink-4`.** §8D.7's Button paragraph says
 *   `--ink-4`, but AC-13 is a binary gate — "`--ink-4` appears in ZERO text-colour
 *   declarations" — and §8.3's own prose confirms "AC-13 fails the build if it is used as
 *   a text colour". T02's `contrast-sweep.test.ts` enforces exactly that. The gate wins;
 *   `--ink-4` survives here only as a non-text disabled fill (see `switch.tsx`).
 *   Disabled still reads as disabled from the `--surface-sunk` ground, the suppressed
 *   hover and `cursor: not-allowed` — and now at 4.98:1 instead of 2.89:1.
 * · **The focus ring is the single global `:focus-visible` rule** in `globals.css`
 *   (§8.3, AC-26). Nothing here touches outline, ring or offset — a per-component ring
 *   is exactly how the AA guarantee on accent fills breaks.
 * · **`buttonClassName` is the escape hatch for anchors.** The marketing hero CTA is a
 *   text link, not a filled `<button>` (§8C.2), and "Message on WhatsApp" is an
 *   `<a href="https://wa.me/…">` (§6.9). Both wear this skin on a real anchor; neither
 *   nests a button inside a link.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "text-link";
export type ButtonSize = "md" | "lg";

export interface ButtonClassNameOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconOnly?: boolean;
  className?: string;
}

/** Shared skeleton. No outline/ring rules — §8.3 owns focus, globally and only once. */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium " +
  "whitespace-nowrap align-middle select-none transition-colors duration-[var(--dur-fast)] " +
  "ease-out aria-disabled:cursor-not-allowed";

/**
 * 40px and 52px (§8D.7) — **on a pointer. On touch `md` is 44px, and that is not a rounding.**
 *
 * ## ⚠ Why `md` has two heights
 *
 * §8D.7's 40px is a mouse number and it is right for a mouse: a cursor is a single pixel, so
 * 40px is generous and a taller control would coarsen a dense desktop toolbar. A fingertip is
 * not a pixel. Apple's HIG, Android's Material guidance and WCAG 2.5.5 independently land on
 * **44** (48 for Material), and this is the size the entire product's primary controls are —
 * Save, Create link, Notify, every dialog action, every Input and every Select trigger inherit
 * this map or copy its `h-10`. Shipping the whole app 4px under the floor is a defect you feel
 * as mis-taps rather than see as a layout break, which is exactly why it survived this long.
 *
 * The breakpoint is `md` (768px), matching the shell's own rail↔bottom-bar swap — the same line
 * the product already uses to mean "this is a phone". Below it: 44. From `md` up: the original
 * 40, unchanged, so no desktop screen moves by a pixel.
 *
 * `max-md:` rather than a `md:` override, deliberately: written the other way (`h-11 md:h-10`)
 * the *mobile* value is the base, and any caller passing `h-10` in `className` would silently
 * win at every width through tailwind-merge. As a `max-md:` variant the touch floor and the
 * caller's class are different utilities, so a caller can still opt a specific control out
 * without accidentally opting out everywhere.
 */
const SIZES: Record<ButtonSize, string> = {
  md: "h-10 max-md:h-11 px-4",
  lg: "h-13 px-6 text-base",
};

const ICON_ONLY_SIZES: Record<ButtonSize, string> = {
  /* Square at both sizes: 44x44 on touch, 40x40 on a pointer. This is what the dialog and
     sheet close buttons and every row action resolve to. */
  md: "w-10 max-md:w-11 px-0",
  lg: "w-13 px-0",
};

/**
 * Every colour is a token utility from the `@theme inline` bridge (F-01).
 *
 * `destructive` hovers with `brightness` rather than a colour swap because the palette
 * declares no `--danger-hover` and adding a token is T02's call, not ours (plan §1.2).
 * Both ground and label darken together, so the 7.67:1 pair is preserved.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-hover " +
    "aria-disabled:bg-surface-sunk aria-disabled:text-ink-3 aria-disabled:hover:bg-surface-sunk",
  secondary:
    "bg-surface text-ink border border-line-control hover:bg-surface-sunk active:bg-surface-sunk " +
    "aria-disabled:bg-surface-sunk aria-disabled:text-ink-3 aria-disabled:border-line " +
    "aria-disabled:hover:bg-surface-sunk",
  ghost:
    "bg-transparent text-ink hover:bg-surface-sunk active:bg-surface-sunk " +
    "aria-disabled:bg-transparent aria-disabled:text-ink-3 aria-disabled:hover:bg-transparent",
  destructive:
    "bg-danger text-ink-inverse hover:brightness-90 active:brightness-90 " +
    "aria-disabled:bg-surface-sunk aria-disabled:text-ink-3 aria-disabled:hover:brightness-100",
  /**
   * ⚠ **Type, not a slab — and on touch it still has to be 44px tall.**
   *
   * This variant deliberately drops the box so the control reads as a link inside a sentence,
   * and that is right. What it produced was a **28px** target (a 13px `--text-sm` line box of
   * 20px plus `py-1` twice) on controls that are the *only* affordance for their action:
   * Copy link, Revoke, Restore, Undo in a six-second toast, "Reorder or delete fields", and
   * the profile's only add-group control.
   *
   * `max-md:py-3 max-md:-my-2` is the whole fix and it costs no layout: the padding grows the
   * hit box to 20 + 24 = 44px while the negative margin removes the same 8px a side from the
   * flow, so every row this sits in keeps the height it had. The control still *looks* like
   * type; it is simply reachable.
   */
  "text-link":
    "h-auto w-auto px-0 py-1 max-md:py-3 max-md:-my-2 " +
    "bg-transparent text-accent underline underline-offset-4 " +
    "decoration-line-control hover:text-accent-hover hover:decoration-accent-hover " +
    "aria-disabled:text-ink-3 aria-disabled:decoration-line",
};

/** The class string on its own, for an `<a>` that must look like a button. */
export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  iconOnly = false,
  className,
}: ButtonClassNameOptions = {}): string {
  return cn(
    BASE,
    SIZES[size],
    iconOnly && ICON_ONLY_SIZES[size],
    VARIANTS[variant],
    fullWidth && "w-full",
    className,
  );
}

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full-width primary action — the mobile auth pattern (§8D.2). */
  fullWidth?: boolean;
  /** Square box for a single icon. Requires `aria-label` at the type level (§8.8). */
  iconOnly?: boolean;
  /** In-flight action. Sets `aria-busy`, swallows clicks, swaps the label if given. */
  loading?: boolean;
  loadingLabel?: string;
  /**
   * Why the control is unavailable. Rendered to a visually-hidden node and wired with
   * `aria-describedby` — never a bare `disabled` with no reason (§8D.7).
   */
  disabledReason?: string;
};

type ButtonIconRequirement =
  | { iconOnly: true; "aria-label": string }
  | { iconOnly?: false | undefined };

export type ButtonProps = Omit<ComponentPropsWithRef<"button">, "iconOnly"> &
  ButtonOwnProps &
  ButtonIconRequirement;

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  iconOnly = false,
  loading = false,
  loadingLabel,
  disabled = false,
  disabledReason,
  type = "button",
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const generatedId = useId();
  const descriptionId = disabledReason ? `${generatedId}-reason` : undefined;
  const inert = disabled || loading;
  const label = loading && loadingLabel ? loadingLabel : children;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (inert) {
      // `aria-disabled` is advisory to the browser, so the guard has to be real —
      // including stopping a `type="submit"` from submitting its form.
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  }

  return (
    <>
      <button
        {...rest}
        type={type}
        aria-disabled={inert || undefined}
        aria-busy={loading || undefined}
        aria-describedby={cn(rest["aria-describedby"], descriptionId) || undefined}
        data-variant={variant}
        data-size={size}
        data-icon-only={iconOnly ? "true" : undefined}
        data-loading={loading ? "true" : undefined}
        onClick={handleClick}
        className={buttonClassName({ variant, size, fullWidth, iconOnly, className })}
      >
        {iconOnly ? (
          <span aria-hidden="true" className="inline-flex items-center justify-center">
            {label}
          </span>
        ) : (
          label
        )}
      </button>
      {disabledReason ? (
        <span id={descriptionId} className="sr-only">
          {disabledReason}
        </span>
      ) : null}
    </>
  );
}
