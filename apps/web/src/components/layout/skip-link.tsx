import { cn } from "@/lib/cn";

/**
 * The first focusable element on every authenticated route (spec §8D.3, AC-26).
 *
 * Three decisions worth not re-litigating:
 *
 * · **It is hidden by `transform`, not by `display` or `sr-only`.** A `display: none`
 *   skip link is not focusable at all, and the `sr-only` → `not-sr-only` pair fights over
 *   the `position` property: `not-sr-only` sets `position: static`, so whether the link
 *   reappears depends on the emitted order of two utilities rather than on anything this
 *   file controls. A `fixed` element parked above the viewport is unconditional.
 * · **`fixed`, not `absolute`.** `absolute` with no positioned ancestor resolves against
 *   the initial containing block, so on a scrolled page the link would slide back to the
 *   top of the *document* — off-screen, and unreachable for the one user who needs it.
 * · **No focus styling of any kind.** T02 ships exactly one unlayered `:focus-visible`
 *   rule whose ink → white → ground sandwich clears 3:1 on all thirteen grounds (§8.3).
 *   Adding `outline-*` or `ring-*` here would override it and break AC-26 — which is why
 *   the suite asserts those class prefixes are absent.
 *
 * `#main` is the `<main id="main" tabIndex={-1}>` that `AppShell` renders. The negative
 * tabindex is what lets the fragment jump actually move focus rather than only scroll.
 */

export interface SkipLinkProps {
  /** The fragment target. Overridable so `(auth)` and `(marketing)` can reuse this. */
  href?: string;
  label?: string;
  className?: string;
}

export function SkipLink({
  href = "#main",
  label = "Skip to content",
  className,
}: SkipLinkProps) {
  return (
    <a
      data-skip-link=""
      href={href}
      className={cn(
        "fixed left-4 top-4 z-50 -translate-y-[200%] rounded-md border border-line",
        "bg-surface px-4 py-2 text-sm font-medium text-ink",
        "transition-transform duration-[var(--dur-fast)] ease-out",
        "focus-visible:translate-y-0",
        className,
      )}
    >
      {label}
    </a>
  );
}
