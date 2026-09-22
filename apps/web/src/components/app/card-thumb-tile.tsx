import type { CSSProperties } from "react";

import Link from "next/link";

import { CardPageThumb } from "@/card/card-page-thumb";
import { FACE_WIDTH } from "@/card/share-face";
import { paletteVars } from "@/card/template-palettes";
import { CardTypeChip } from "@/components/app/card-type-chip";
import { FieldCountMeter } from "@/components/app/field-count-meter";
import { cn } from "@/lib/cn";
import type { ResolvedCard } from "@/types/domain";

import "@/styles/card-tile.css";

/**
 * `CardThumbTile` — a card as it appears in a list: the live miniature plus the four facts
 * a reader needs to tell one card from another (spec §8D.3 — `/cards` and `/dashboard`).
 *
 * The preview is a real `<CardPageThumb>` — live component output rather than a picture of one
 * (§8C.2), so it cannot drift from the card it previews. Whatever the card draws, the tile
 * draws: its cover photograph, its logo in the badge, its palette, its wordmark, its position,
 * its bio, its action, its rows. Whatever the card does *not* draw, the tile does not either.
 *
 * ## ⚠ NOTHING OF THE LIST'S OWN INVENTION MAY APPEAR INSIDE THE PREVIEW
 *
 * This is the rule, and it is written down because it was broken. On 2026-09-21 the tile grew a
 * "Tap for QR" pill on its foot and a flip to a QR face on its back. Both were removed the same
 * day, at the client's instruction and correctly: **a tile is a picture of the card**, and a
 * card is not a surface for the list's controls. A reader looking at a tile must be able to
 * trust that what they see is what the card is — the moment the tile adds a control of its own,
 * they cannot.
 *
 * The frame is the one exception and it is not inside the card: a radius, a hairline and a
 * shadow, because a card is a physical object and an object on a page has an edge. The veil that
 * resolves the crop is painted in the card's **own paper colour** for the same reason — see
 * `card-tile.css`, which carries the full argument for why a crop needs a bottom drawn under it.
 *
 * ## ⚠ It was `<ShareFace mode="thumb">` — the wallet face with the QR — until 2026-09-18
 *
 * Every tile was the same rectangle with a QR on it whatever theme, cover or bio the card
 * carried, because the face has no theme axis and no cover. The face is unchanged and is still
 * the object that gets scanned, walleted and exported at full size on `/cards/{id}`; this is
 * only about which of a card's two presentations a *list* shows.
 *
 * ## Three decisions worth keeping
 *
 * - **One stretched link, and the whole tile is it.** Clicking anywhere — the card, the name,
 *   the chips — opens that card's page. `after:absolute after:inset-0` on the name's link is
 *   what does it, which is also why nothing inside the preview may be interactive: a control
 *   under a full-bleed link is unreachable by pointer.
 * - **The preview is `aria-hidden`.** It is a miniature of information the caption already
 *   states, and it contains its own `<h2>` and its own copy of every field label. Left in the
 *   accessibility tree, a grid of twelve tiles reads as a wall of duplicate headings.
 *   `<CardPageThumb>` renders its subtree `inert`, so nothing focusable is hidden — which is the
 *   one thing that would make `aria-hidden` a violation in its own right. There is exactly one
 *   tab stop per tile.
 * - **E-13 is a width problem, not a text problem.** A 40+ character name clamps to one line
 *   *and* the cell is allowed to shrink below its content (`min-w-0`), because a grid item's
 *   automatic minimum size is its content — without that, one long caption widens its column
 *   and reflows the entire grid. The full text stays in `title`, so the clamp costs
 *   presentation and never information.
 */

/**
 * How far down the card the tile's window reaches, in design px at scale 1.
 *
 * 620 rather than the share face's 500: ~478 of the card is cover and identity, so a 500px
 * window shows no field rows at all and 620 shows about three before the veil starts. Two cards
 * on the same template are told apart by their rows, so the rows are the part worth buying.
 *
 * The **width** is still `FACE_WIDTH`, untouched, because the grid's column caps and its
 * `--card-thumb-scale` breakpoints are derived from 336 and nothing here should re-derive that
 * table (`cards-list-client.tsx` carries it).
 *
 * ⚠ `TILE_ASPECT_CLASS` in `loading-skeleton.tsx` restates this as `aspect-[336/620]` — Tailwind
 * needs the class name at build time, so it cannot import the number. If this moves, that moves
 * with it, or the loading bones sit in a different box than the tiles and the grid shifts the
 * moment the cards arrive (AC-17).
 */
export const TILE_CROP_HEIGHT = 620;

export interface CardThumbTileProps {
  /** The same `ResolvedCard` the detail screen and the payload share (I-5). */
  resolved: ResolvedCard;
  /** Usually `/cards/{cardId}`. Omit for a tile that is a preview and not a destination. */
  href?: string;
  /** Passed through to `<CardPageThumb>`; `--card-thumb-scale` overrides it (§6.5). */
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

  /* The same mechanism the thumbnail uses, and for the same reason: a scale measured in
     JavaScript renders one size on the server and possibly another on the client (§11 E-45).
     The grid sets the variable at ordinary CSS breakpoints; this only supplies the fallback. */
  const scaleVar = `var(--card-thumb-scale, ${thumbScale ?? 200 / FACE_WIDTH})`;

  return (
    <article
      data-card-tile={resolved.cardId}
      className={cn("relative flex w-full min-w-0 flex-col gap-3", className)}
    >
      <div
        data-card-tile-preview=""
        aria-hidden="true"
        className="cb-tile-frame min-w-0"
        style={{
          width: `calc(${FACE_WIDTH}px * ${scaleVar})`,
          height: `calc(${TILE_CROP_HEIGHT}px * ${scaleVar})`,
          /* E-13: the tile may shrink below its content, so one long caption cannot widen the
             column and reflow the grid. */
          maxWidth: "100%",
          /* ⚠ The palette's own variables, on the FRAME. The veil fades to `--c-sheet` — the
             paper this card is printed on — and that variable is set by `paletteVars` inside
             the card root, which the veil is a sibling of rather than a descendant. Without
             this the fade falls back to `--canvas` and leaves a visible seam on six of the
             nine palettes. */
          ...(paletteVars(resolved.palette) as CSSProperties),
        }}
      >
        <CardPageThumb resolved={resolved} scale={thumbScale} height={TILE_CROP_HEIGHT} />
        <span className="cb-tile-veil" />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Heading
          data-card-tile-name=""
          data-tile-clamp="1"
          title={resolved.cardName}
          /* ⚠ Two lines on touch, one from `lg` up. A clamped name's full text lives only in
             `title`, and a `title` tooltip never opens on a phone — so a 40-character card
             name was unrecoverable there. Two lines holds every name in practice; the desktop
             grid keeps one so the tile heights stay even down a three-up row. */
          className="line-clamp-2 text-lg text-ink lg:line-clamp-1"
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
