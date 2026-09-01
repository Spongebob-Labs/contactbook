"use client";

import { Suspense, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ShareFace } from "@/card/share-face";
import { resolveCard } from "@/card/resolve-card";
import { buttonClassName } from "@/components/primitives";
import { AUTH_STEP_COUNT, authStepFor } from "@/lib/auth-flow-context";
import { cn } from "@/lib/cn";
import { useFixture } from "@/lib/fixture-gateway";
import { AuthProgress } from "./auth-progress";

/**
 * The `(auth)` chrome — spec §8D.2's shell paragraph, implemented clause by clause.
 *
 * `--canvas` ground · one centred column at `max-width: 420px` · vertically centred from
 * 768px up and top-aligned with `--space-16` below it · a `STEP n OF 6` progress indicator
 * on **every** screen · Back top-left on every screen except the first · and, from 1280px,
 * a `--surface-sunk` panel showing one live `<ShareFace mode="thumb">`.
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
 * ## The showcase is the product, not decoration
 * §8D.2 asks for a live card. It renders the first fixture card through the same
 * `<ShareFace>` `/c/[slug]` uses, so what someone sees while signing up is the thing they
 * are signing up to make. It deliberately does **not** import T04's card font class helper:
 * the two card-only typefaces must not appear in the `(auth)` bundle (AC-17 / N-3), and the
 * frame's font stacks already carry real fallbacks for exactly this surface.
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
          <Suspense fallback={null}>
            <AuthShowcase />
          </Suspense>
        </aside>
      )}
    </div>
  );
}

/**
 * One live `thumb`, plus a sentence about what it is.
 *
 * Exported because `/signup/done` renders the same card in its own column (§8D.2 A-6), and
 * two copies of "resolve the first fixture card and render it" is two places for the auth
 * surface to start loading the card typefaces by accident.
 *
 * `?state=loading` and `?state=error` hand back no data, so it renders nothing rather than
 * a placeholder — the panel is supporting material, and a broken frame beside a sign-in
 * form would be worse than an empty one.
 *
 * The width is pinned to `400 × 0.5`: `THUMB_MAX_SCALE` is 0.5, so a wider box would leave
 * the scaled canvas parked in its top-left corner (the frame's `transform-origin`).
 *
 * ⚠ **T04's card font class helper is deliberately not imported** — here or anywhere in
 * `(auth)`. AC-17 / N-3 assert that Archivo and Bricolage Grotesque never reach this bundle,
 * and the sweeps grep for the import by name; the frame's font stacks carry real fallbacks
 * for exactly this surface.
 */
export function AuthShowcase({
  caption = "A card is a filter over your profile: you pick the fields it carries. The QR is how someone else gets them.",
  className,
}: {
  caption?: ReactNode;
  className?: string;
}) {
  const { data } = useFixture((db) => db);

  const resolved = useMemo(() => {
    if (data === null) return null;
    const card = data.cards[0];
    return card === undefined
      ? null
      : resolveCard(card, data.user, data.groups, data.fields);
  }, [data]);

  if (resolved === null) return null;

  return (
    <div data-auth-card="" className={cn("flex w-[200px] flex-col gap-6", className)}>
      <ShareFace resolved={resolved} mode="thumb" thumbWidth={0.5} />
      {caption === null ? null : <p className="text-sm text-ink-3">{caption}</p>}
    </div>
  );
}
