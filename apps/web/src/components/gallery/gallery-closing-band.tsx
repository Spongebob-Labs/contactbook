"use client";

import Link from "next/link";

import { buttonClassName } from "@/components/primitives/button";

/**
 * The band that closes `/templates` — spec §8B.5's last line: "Linktree's device, our copy:
 * a `--text-h1` line plus one CTA."
 *
 * Three deliberate choices:
 *
 * · **One call to action, not two.** The reader has just looked at eight designs; the only
 *   remaining question is whether they make a card. A second, competing link would answer a
 *   question nobody asked.
 * · **A hairline and a change of ground, not a shadow or a rounded panel** (§8.7, F-09,
 *   F-10). The band separates itself by sitting on `--surface-sunk` under a 1px rule.
 * · **Plain copy: nouns and numbers, no adjectives** (§8C.2). The second line states the
 *   actual mechanic — a card is a *filter* over the profile (§5.3), so changing the
 *   template genuinely does not touch the fields.
 *
 * `"use client"` is not decoration: `buttonClassName` lives in a `"use client"` module, and
 * a server component that calls it hits a client reference and throws before rendering.
 * `PillNav` carries the directive for exactly the same reason.
 */
export function GalleryClosingBand() {
  return (
    <section data-gallery-closing-band="" className="border-t border-line bg-surface-sunk">
      <div className="mx-auto w-full max-w-[var(--content-max)] px-5 py-20 md:px-8 md:py-24 lg:py-32">
        <h2 data-prose className="text-h1 text-ink">
          Eight templates. Pick one now, change it later.
        </h2>
        <p data-prose className="mt-5 text-lg text-ink-3">
          A card is a filter over your profile, so swapping the template never touches the
          fields you chose to share.
        </p>
        <Link
          href="/signup/first-name"
          className={buttonClassName({ variant: "primary", size: "lg", className: "mt-8" })}
        >
          Make your card
        </Link>
      </div>
    </section>
  );
}
