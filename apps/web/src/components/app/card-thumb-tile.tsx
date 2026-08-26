import Link from "next/link";

import { ShareFace } from "@/card/share-face";
import { CardTypeChip } from "@/components/app/card-type-chip";
import { FieldCountMeter } from "@/components/app/field-count-meter";
import { cn } from "@/lib/cn";
import type { ResolvedCard } from "@/types/domain";

/**
 * `CardThumbTile` — a card as it appears in a list: the live miniature plus the four facts
 * a reader needs to tell one card from another (spec §8D.3 — `/cards` and `/dashboard`).
 *
 * The preview is a real `<ShareFace mode="thumb">`, not a picture of one, because §8C.2
 * requires live component output rather than an image of a component — and because a
 * screenshot would drift from the template the moment either changed.
 *
 * ## Three decisions worth keeping
 *
 * - **The thumb is `aria-hidden`.** It is a miniature of information the caption already
 *   states, and it contains its own `<h2>` and its own copy of every field label. Left in
 *   the accessibility tree, a grid of twelve tiles reads as a wall of duplicate headings.
 *   T13 already renders `thumb` controls as inert markup, so nothing focusable is hidden —
 *   which is the one thing that would make `aria-hidden` a violation in its own right.
 * - **Its QR encodes nothing, and that is correct.** `thumb` is explicitly exempt from
 *   scannability (§8A.5): T06 draws a glyph whose rings are 1:1:1:1:1 rather than a finder
 *   pattern's 1:1:3:1:1, so no decoder can locate a symbol in it. AC-09(h) asserts it must
 *   **not** decode. Do not "fix" it into a real encode.
 * - **E-13 is a width problem, not a text problem.** A 40+ character name clamps to one line
 *   *and* the cell is allowed to shrink below its content (`min-w-0`), because a grid item's
 *   automatic minimum size is its content — without that, one long caption widens its column
 *   and reflows the entire grid. The full text stays in `title`, so the clamp costs
 *   presentation and never information.
 */

export interface CardThumbTileProps {
  /** The same `ResolvedCard` the detail screen and the payload share (I-5). */
  resolved: ResolvedCard;
  /** Usually `/cards/{cardId}`. Omit for a tile that is a preview and not a destination. */
  href?: string;
  /** Passed through to `<ShareFace>`; measured from the cell when absent (§6.5). */
  thumbScale?: number;
  /** Match the surrounding outline — the axe sweep checks heading order (AC-25). */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

export function CardThumbTile({
  resolved,
  href,
  thumbScale,
  headingLevel = 3,
  className,
}: CardThumbTileProps) {
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";

  return (
    <article
      data-card-tile={resolved.cardId}
      className={cn("relative flex w-full min-w-0 flex-col gap-3", className)}
    >
      <div data-card-tile-preview="" aria-hidden="true" className="min-w-0">
        <ShareFace resolved={resolved} mode="thumb" thumbWidth={thumbScale} />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Heading
          data-card-tile-name=""
          data-tile-clamp="1"
          title={resolved.cardName}
          className="line-clamp-1 text-lg text-ink"
        >
          {href ? (
            // A stretched link: the whole tile is the target, and there is exactly one tab
            // stop per tile because everything else in it is inert or hidden.
            <Link
              href={href}
              className="text-ink underline-offset-4 hover:underline after:absolute after:inset-0"
            >
              {resolved.cardName}
            </Link>
          ) : (
            resolved.cardName
          )}
        </Heading>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CardTypeChip type={resolved.cardType} />
          <span data-card-tile-template="" className="text-xs text-ink-3">
            {resolved.template.name}
          </span>
          {/* AC-36: the zero-field card wears its warning here, in the list, before anyone
              hands it out. `card_empty_demo` is the newest card by `updatedAt`, so a
              recency-sorted list puts it first — exactly where the old build hid it. */}
          <FieldCountMeter resolved={resolved} />
        </div>
      </div>
    </article>
  );
}
