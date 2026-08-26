import type { Metadata } from "next";
import { Suspense } from "react";

import { GalleryClosingBand } from "@/components/gallery/gallery-closing-band";
import {
  TemplateGallery,
  TemplateGallerySkeleton,
} from "@/components/gallery/template-grid";

/**
 * `/templates` — the template gallery (spec §8B.5, §6.1 R-02, AC-30, AS-16: public).
 *
 * Three things this file, and only this file, is responsible for:
 *
 * 1. **The `<Suspense>` boundary.** The gallery reads `?state=` and `?category=` through
 *    `useSearchParams()`, which requires a boundary above it or `next build` fails on
 *    prerender (plan §0.5). That is the whole reason the screen is split in two.
 *
 * 3. **The page heading, and no top clearance.** `(marketing)/layout.tsx` owns
 *    `<main className="pt-20">`, which is the allowance under the fixed pill bar. This page
 *    adds only its own section rhythm below that — a second allowance here would push the
 *    heading 160px down the page.
 */

export const metadata: Metadata = {
  title: "Templates",
  description:
    "Nine card designs, each rendered live. One layout every time — your name, your number, your email and your QR code — in nine colours across two field presets.",
};

export default function TemplatesPage() {
  return (
    <div>
      <header className="mx-auto w-full max-w-[var(--content-max)] px-5 pt-12 pb-10 md:px-8 md:pt-16 md:pb-12">
        <h1 className="text-h1 text-ink">Templates</h1>
        <p data-prose className="mt-5 text-lg text-ink-3">
          Nine designs, one layout. Every card carries your name, your number, your email and a
          QR code — scan it and the full card opens, with everything else you chose to share.
        </p>
      </header>

      <Suspense fallback={<TemplateGallerySkeleton />}>
        <TemplateGallery />
      </Suspense>

      <GalleryClosingBand />
    </div>
  );
}
