"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BrandCard } from "@/components/marketing/brand-card";
import { buttonClassName } from "@/components/primitives";
import { AUTH_STEP_COUNT, authStepFor } from "@/lib/auth-flow-context";
import { cn } from "@/lib/cn";
import { heroPhone } from "@/fixtures/marketing";
import { AuthProgress } from "./auth-progress";

/**
 * The `(auth)` chrome — spec §8D.2's shell paragraph, implemented clause by clause.
 *
 * `--canvas` ground · one centred column at `max-width: 420px` · vertically centred from
 * 768px up and top-aligned with `--space-16` below it · a `STEP n OF 6` progress indicator
 * on **every** screen · Back top-left on every screen except the first · and, from 1280px,
 * a `--surface-sunk` panel showing the website hero's card — Maya's.
 *
 * ## Why progress and Back live here and not in the pages
 * They are derived from the pathname, which means they cannot disagree with the route, and
 * a page cannot forget to render one. AC-28 is "a progress indicator on every screen and a
 * non-destructive Back on every screen except step 1" — a guarantee, not a habit, and a
 * guarantee belongs in one file.
 *
 * ## Why Back is a `<Link>` to the previous *step* rather than `router.back()`
 * History is not the flow. Someone who lands on `/signup/email` from a bookmark has a
 * history entry that is not step 4, and `router.back()` would take them out of the product.
 * The link always goes one step back, and the answers survive because they live in the
 * provider mounted by the layout above this component — the layout is not remounted by a
 * navigation between its own pages, so nothing is destroyed either way (E-46).
 *
 * ## The showcase is the landing page's own card
 * Client, 2026-10-09: the card beside the sign-in form should be the designed one of Maya from the
 * website's hero, not a product thumbnail of a fixture card. So the panel draws `<BrandCard>` — the
 * same component, the same `heroPhone` content, the same measured layout the hero's phone holds —
 * just without the phone around it. It is a picture of a card (the card is `inert` and carries a
 * text alternative), which is also all the hero is.
 *
 * `[data-mk-root]` on its wrapper is not decoration: the card's inks and faces are `--mk-phone-*`
 * tokens declared on that attribute, and an app screen has no ancestor that carries it. It only
 * scopes tokens and the two selection/tabular rules to the wrapper, so nothing marketing-shaped
 * leaks onto the form beside it.
 */

export interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  const pathname = usePathname();
  const step = authStepFor(pathname);
  const isLastStep = step?.nextHref === null;

  return (
    <div data-auth-shell="" className="flex min-h-full flex-1 bg-canvas">
      <main
        id="main"
        tabIndex={-1}
        data-auth-step={step?.index}
        className="flex min-h-full flex-1 flex-col px-5 pt-16 pb-12 md:justify-center md:px-10 md:py-16"
      >
        <div className="mx-auto flex w-full max-w-[420px] flex-col gap-10">
          <div className="flex flex-col gap-6">
            {/* The slot keeps its height on step 1 so the question does not jump when Back
                appears on step 2. An empty box, not an invisible button — nothing lands
                here in the tab order. */}
            <div className="flex min-h-8 items-center">
              {step?.backHref == null ? null : (
                <Link
                  href={step.backHref}
                  /* ⚠ NOT PREFETCHED — and this line is the "sent back to /signup/first-name after
                     Done" bug. A production build prefetches `<Link>` targets. Step 3's Back goes to
                     `/signin/otp`, which the proxy bounces to `/dashboard` for anyone signed in, and
                     `(app)/layout.tsx` — the owner not yet onboarded — bounces that to
                     `/signup/first-name`. Next caches the redirect under `/dashboard`, so after
                     onboarding "Done" → `router.push("/dashboard")` replays the stale redirect from the
                     client router cache without ever asking the server. `next dev` never prefetches,
                     which is why it worked locally. `tests/e2e/onboarding-gate.spec.ts`. */
                  prefetch={false}
                  data-auth-back=""
                  className={buttonClassName({
                    variant: "text-link",
                    className: "gap-1 no-underline hover:underline",
                  })}
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Back
                </Link>
              )}
            </div>

            {step === undefined ? null : (
              <AuthProgress step={step.index} total={AUTH_STEP_COUNT} />
            )}
          </div>

          {children}
        </div>
      </main>

      {/* The panel is a second copy of the card on the confirmation screen, which renders
          its own — so it stands down there rather than showing the same thing twice. */}
      {isLastStep ? null : (
        <aside
          data-auth-showcase=""
          aria-label="What you're building"
          className="hidden w-[420px] shrink-0 items-center justify-center border-l border-line bg-surface-sunk px-12 xl:flex"
        >
          <AuthShowcase />
        </aside>
      )}
    </div>
  );
}

/**
 * The website hero's card — Maya's — plus a sentence about what comes next.
 *
 * Exported because `/signup/done` once rendered the same card in its own column (§8D.2 A-6); it
 * does not any more, but the export is the one place that decides what the auth surface shows.
 *
 * ## Size
 * `.mk-hc__card` is a fixed 330×793 box, and the panel is 420px with 48px of padding either side,
 * so the card can never be wider than 0.98 of its design size. It is stepped down by viewport
 * HEIGHT the way the hero's phone is (`hero.tsx`): at 0.98 it is 777px tall, which only fits a
 * tall window, and `zoom` — not `transform: scale()` — keeps its text rasterised at the target
 * size instead of resampled.
 *
 * ## Why the caption is `w-0 min-w-full`
 * The wrapper is as wide as the zoomed card and no wider. A paragraph's own max-content width
 * would otherwise be what sizes it, and the caption would push the panel's column out under a
 * narrow card. `w-0 min-w-full` makes the caption take the card's width and wrap inside it.
 *
 * ⚠ **The hero's three faces arrive with this component** (`BrandCard` sets their next/font
 * classes), so the `(auth)` routes now load Libre Caslon, Inter and DM Sans. The old comment here
 * was about Archivo and Bricolage Grotesque, the product's former card-only faces; neither is
 * imported by this file.
 */
export function AuthShowcase({
  caption = "Once you\u2019re enrolled, let\u2019s build your first card",
  className,
}: {
  caption?: ReactNode;
  className?: string;
}) {
  const c = heroPhone;

  return (
    <div data-auth-card="" className={cn("flex w-fit flex-col gap-6", className)}>
      <div
        data-mk-root=""
        data-auth-hero-card=""
        className="overflow-hidden rounded-[28px] shadow-[0_18px_48px_-12px_rgb(0_0_0/0.28)] ring-1 ring-black/5 [zoom:0.7] [@media(min-height:820px)]:[zoom:0.8] [@media(min-height:900px)]:[zoom:0.9] [@media(min-height:1000px)]:[zoom:0.98]"
      >
        <BrandCard
          layout="measured"
          cover={{ kind: "photo", x2: c.portrait.x2, x3: c.portrait.x3 }}
          brand={c.brand}
          name={c.name}
          role={c.role}
          company={c.company}
          bio={c.bio}
          action={c.action}
          sections={c.sections}
          social={{ label: c.socialLabel, platforms: c.social }}
          caption={c.caption}
          idPrefix="mk-auth-hc"
        />
      </div>
      {caption === null ? null : <p className="w-0 min-w-full text-sm text-ink-3">{caption}</p>}
    </div>
  );
}
