"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { BottomBar } from "./bottom-bar";
import { isFocusRoute } from "./focus-route";
import { Sidebar } from "./sidebar";

/**
 * The authenticated chrome (spec §8D.3). Rail on the left ≥768px, bottom bar ≤767px,
 * and the single `<main id="main">` every screen in the `(app)` group renders into.
 *
 * ⚠ THE SHELL OWNS `<main>`. A screen that renders its own `<main>` — including
 * `<ScreenStateRoot as="main">` — puts two `main` landmarks on the page and fails axe's
 * `landmark-unique` in T29 (AC-25). Screens use `section` or `div`.
 *
 * The rail↔bar swap is pure CSS (`hidden md:flex` against `md:hidden`). It is deliberately
 * not a JavaScript viewport-width branch: that renders one navigation on the server and
 * possibly the other on the client, and §11 E-45 — collapse the rail, then cross to
 * mobile — is exactly the case where such a branch leaves an orphaned rail or two
 * navigations.
 *
 * The bottom padding is `--bottombar-height` plus `env(safe-area-inset-bottom)` (§8D.3),
 * dropped at `md` where the bar is gone. Without the inset the last row of every list on
 * an iPhone sits under the home indicator.
 *
 * ⚠ THE SIDE GUTTER IS RESPONSIVE, AND THE TWO VALUES ARE LOAD-BEARING ARITHMETIC.
 * §8D.3's `--space-8` sides describe the desktop rhythm and are kept verbatim from `md`
 * up. Below `md` the gutter is `--space-3`, which is §8D.5's own mobile number, because a
 * flat 32px a side leaves 296px at a 360px viewport and a `full` `<ShareFace>` floors
 * at `CARD_MIN_WIDTH` = 336px (§8A.3 / E-25 — the canvas is fluid and the content is
 * never `transform`-scaled, since scaling takes the QR symbol under its 140px floor).
 * 296 < 336, so every `(app)` screen holding a `full` card scrolled the page sideways,
 * which is E-15 and E-53, both P0. `360 - 2 × 12 = 336` is exactly the floor: the spec's
 * two numbers are tangent, not coincidentally.
 *
 * ⚠ Anything that bleeds back out to the viewport edge must mirror BOTH steps — a bleed
 * keyed only to `--space-8` over-compensates by 20px a side below `md` and reintroduces
 * the very scroll this padding removes. `builder-split.tsx` is the one such consumer.
 *
 * ── FOCUS MODE ───────────────────────────────────────────────────────────────────────
 *
 * On the routes `isFocusRoute` names — the card builder, and only the card builder — **the
 * desktop rail is not rendered.** The builder is an editor over one object and already spends
 * its width on a section rail, a control panel and a live phone; a second unrelated rail down
 * the left of that competes with the first for the same reading. `BuilderHeader` renders a
 * hamburger that opens the same navigation as a drawer (`nav-drawer.tsx`), so nothing is
 * unreachable — it is one press away instead of nought.
 *
 * ⚠ **The BOTTOM BAR stays in focus mode, and that asymmetry is the point.** Below `md` the
 * rail was never on screen, so there is no width to reclaim and no competing rail to remove —
 * dropping the bar there would be deleting navigation in exchange for nothing. What focus mode
 * buys is horizontal room, and horizontal room is a desktop problem.
 *
 * ⚠ **This component became a client component to read the route, and `usePathname()` is the
 * whole reason.** It renders nothing interactive of its own. The alternative — a `(builder)`
 * route group with its own layout — was the tidier structure on paper and would have had to
 * re-mount `FixtureAuthProvider`, `ToastProvider` and `SkipLink` beside the ones `(app)` already
 * mounts; the `ToastProvider` in particular carries the overlay elevation stylesheet, and two of
 * them is a bug with no visible connection to the file that caused it.
 */

export interface AppShellProps {
  children: ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  const focus = isFocusRoute(usePathname());

  return (
    <div
      data-app-shell=""
      data-app-chrome={focus ? "focus" : "full"}
      className={cn("flex min-h-svh w-full bg-canvas", className)}
    >
      {focus ? null : <Sidebar />}

      <div
        data-app-content=""
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          "pb-[calc(var(--bottombar-height)+env(safe-area-inset-bottom,0px))] md:pb-0",
        )}
      >
        {/* `tabIndex={-1}` is what makes the skip link actually move focus rather than
            only scroll the fragment into view. */}
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            "mx-auto w-full px-3 md:px-8",
            /* The editor gets the width back that the rail was using, and starts higher:
               `pt-16` is the breathing room a page title needs above it, and the builder's
               first row is a toolbar, not a title. A wider cap too — `--content-max` is a
               reading measure, and the editor is three panes rather than prose. */
            focus
              ? "max-w-[104rem] pt-5 md:pt-6"
              : "max-w-[var(--content-max)] pt-16",
          )}
        >
          {children}
        </main>
      </div>

      <BottomBar />
    </div>
  );
}
