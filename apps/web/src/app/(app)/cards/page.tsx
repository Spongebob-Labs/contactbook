import type { Metadata } from "next";
import { Suspense } from "react";

import { CardsListClient, CardsListSkeleton } from "./cards-list-client";

/**
 * `/cards` — the cards list (spec §6.1 R-10, §8D.3, §4.4 step 2).
 *
 * Two things this file, and only this file, is responsible for:
 *
 * 1. **The `<Suspense>` boundary.** The screen reads `?state=` and `?q=` through
 *    `useSearchParams()`, which requires a boundary above it or `next build` fails on
 *    prerender (plan §0.5). That is the whole reason the screen is split in two, and the
 *    fallback is the same skeleton `loading.tsx` renders, so the two never disagree.
 *
 * 2. **`cardFontsClassName`.** This *is* a card-rendering route — every tile is a live
 *    `<ShareFace mode="thumb">` — so it opts the two card-only typefaces in on a wrapper
 *    above the grid (`card-fonts.ts`). Without it Terminal renders in Arial Narrow and
 *    Marquee in Trebuchet: the fallback stacks, not the real faces. It is scoped to the
 *    route rather than to `(app)/layout.tsx` on purpose — `/` and the `(auth)` group must
 *    never pay for two typefaces no screen in them renders (AC-17 / N-3).
 *
 * The page renders no `<h1>` of its own: `PageHeader` inside the client component is the
 * page heading, and `AppShell` owns the one `<main id="main">` both of them render into.
 */

export const metadata: Metadata = {
  title: "Cards",
  description:
    "Every card you've made, newest first, with the number of profile fields each one shares.",
};

export default function CardsPage() {
  return (
    <div>
      <Suspense fallback={<CardsListSkeleton />}>
        <CardsListClient />
      </Suspense>
    </div>
  );
}

