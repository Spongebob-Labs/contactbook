import type { ReactElement } from "react";

import { ArrowRight, SmartphoneNfc } from "lucide-react";

import { CardActionButton } from "@/card/card-action-button";
import { CardPage } from "@/card/card-page";
import { FACE_HEIGHT, FACE_WIDTH } from "@/card/share-face";
import type { ResolvedCard } from "@/types/domain";

/**
 * THE CARD PAGE AS A THUMBNAIL — what a card looks like, small, in a list.
 *
 * ## ⚠ Why this replaced `<ShareFace mode="thumb">` in the tiles
 *
 * `/cards` and `/dashboard` drew the **wallet face**: the 336×500 object with the QR on it. That
 * was right while the face was the card's only presentation. It is not any more — the card page
 * is what a recipient opens, what the 2026-09-17 rebuild is about, and what an owner means when
 * they say "my card". A list of wallet faces showed none of it: every tile was the same blue
 * rectangle with a QR, whatever theme or cover the card was wearing.
 *
 * The face is not deleted and nothing about it changed. It is still the object that gets added
 * to a wallet, exported to PNG and scanned, and `/cards/{id}` still shows it at full size. This
 * is only about which of the two a *list* shows.
 *
 * ## ⚠ The box is the face's box, to the pixel, and that is deliberate
 *
 * 336×500 — `FACE_WIDTH` and `FACE_HEIGHT`, imported rather than restated. The grid's column
 * caps and its `--card-thumb-scale` breakpoints are tuned to exactly those numbers
 * (`cards-list-client.tsx` carries the table), so reusing them means the tiles change what they
 * draw and not where they sit. A different aspect here would need that whole table re-derived.
 *
 * It also happens to be a good crop: at 336 wide the cover is ~235px tall, and 500px reaches the
 * end of the primary action. A tile therefore shows cover, badge, wordmark, name, position, bio
 * and button — the whole identity — and cuts where the field list begins, which is the part that
 * differs least between cards.
 *
 * ## The scale mechanism is the face's, unchanged
 *
 * `--card-thumb-scale` with a prop fallback, read as a CSS variable rather than measured in
 * JavaScript: measuring renders one size on the server and possibly another on the client, which
 * is what §11 E-45 fails. See the note above `scaleVar` in `share-face.tsx`.
 *
 * ## ⚠ The thumbnail draws the card's ACTION, and that is not decoration
 *
 * The first version passed no `actions`, so a tile showed cover, name, position and bio and then
 * the field list. Three cards on three different themes came out looking identical: with a cover
 * photograph the palette paints almost nothing a reader can see at 200px — the accent is an
 * 11px wordmark and a few icon discs.
 *
 * The primary action is the one large block of palette colour on the card, so drawing it is what
 * makes an Onyx card look like an Onyx card in a list. It is also simply what the card looks
 * like; a preview that omits its main control is a preview of something else.
 *
 * ## ⚠ THE WHOLE THUMBNAIL IS `inert`, AND IT HAS TO BE
 *
 * The tile wraps this in `aria-hidden`, and `<CardPage>` renders a real `<a>` per actionable
 * field — twelve of them on a well-filled card. Focusable controls inside an `aria-hidden`
 * subtree is the one thing that makes `aria-hidden` a violation in its own right: a keyboard
 * user tabs into a link that no screen reader will announce, twelve times per tile, down a grid.
 * The face's thumbnail never had this problem because it rendered its controls as inert markup;
 * the card page renders the real thing, so the wrapper has to say so.
 *
 * `inert` on the outer box covers every descendant at once — the field links, the action, and
 * anything added to the card later without thinking about lists.
 *
 * ## `overflow: hidden` here is safe, and is the one place it is
 *
 * `card-page.tsx` rests on there being no overflow container inside it — that absence is what
 * fixed the clipped field list. This wrapper is OUTSIDE the card, cropping a miniature nobody
 * scrolls, and the card within it is laid out at its full natural height exactly as anywhere
 * else. Nothing about the card's own layout depends on this element.
 */
/**
 * ⚠ **The default is a WIDTH expressed as a scale, and it is 200px on purpose.**
 *
 * The API this component replaced took `thumbWidth` — a number of **pixels**, defaulting to
 * 200. This one takes `scale` — a **ratio**. The units changed and the default did not follow:
 * it was left at `1`, which means "paint at the full 336px design width and overflow whatever
 * contains you".
 *
 * That shipped as a visible break on `/dashboard`, the one caller that relied on the default.
 * Its featured card sits in an `18rem` (288px) column inside a 240px cap, so a 336px box with
 * `flex-shrink: 0` ran past both and was clipped by the viewport edge.
 *
 * So the fallback is the previous API's default, restated as a ratio rather than re-picked: a
 * caller that says nothing gets the 200px thumbnail it always got. A caller that wants another
 * size still sets `--card-thumb-scale`, which is the only responsive route (see above).
 */
const DEFAULT_THUMB_WIDTH = 200;

/**
 * The default as a ratio, exported so a test can pin it.
 *
 * It is exported rather than inlined because jsdom cannot see the value any other way: React
 * writes the box through the CSSOM, and jsdom's parser rejects
 * `calc(336px * var(--card-thumb-scale, …))` outright — the width and height never reach the
 * rendered `style` attribute at all. A DOM assertion here would pass against every possible
 * scale, including the broken one, so the guard has to read the number itself.
 */
export const DEFAULT_THUMB_SCALE = DEFAULT_THUMB_WIDTH / FACE_WIDTH;

export interface CardPageThumbProps {
  resolved: ResolvedCard;
  /**
   * Fallback scale when no `--card-thumb-scale` is in scope. A ratio, where 1 is the card at
   * its full 336px design width — NOT a pixel width. Defaults to a 200px-wide thumbnail.
   */
  scale?: number;
  /**
   * How much of the card the window shows, in **design px at scale 1** — the crop's height,
   * not a scale. Defaults to `FACE_HEIGHT` (500), which is what the marketing tiles and the
   * auth showcase have always drawn.
   *
   * ⚠ It is a prop rather than a constant because 500 is right for a *fanned deck of small
   * objects* and wrong for a *list a reader picks a card out of*: at 336 wide, 500px ends
   * within a few pixels of the primary action, so the tiles on `/cards` cut off the instant a
   * card had one more line of bio than its neighbour. `<CardTilePreview>` opens the window to
   * {@link TILE_CROP_HEIGHT} and then draws a real bottom edge under it — see
   * `card-tile-preview.tsx`. Nothing here decides where the crop *looks* finished; this only
   * decides where it is.
   */
  height?: number;
  className?: string;
}

export function CardPageThumb({
  resolved,
  scale = DEFAULT_THUMB_SCALE,
  height = FACE_HEIGHT,
  className,
}: CardPageThumbProps): ReactElement {
  const scaleVar = `var(--card-thumb-scale, ${scale})`;

  return (
    <div
      /* The same hook the face's thumbnail published, so anything that locates a thumbnail from
         outside — the card tiles, the auth showcase — keeps working. */
      data-card-thumb=""
      data-card-thumb-variant="page"
      inert
      className={className}
      style={{
        width: `calc(${FACE_WIDTH}px * ${scaleVar})`,
        height: `calc(${height}px * ${scaleVar})`,
        overflow: "hidden",
        flexShrink: 0,
        /* The card is an object, so its miniature is one too. The full-size card takes its
           radius from `card.css` §1b, which is scoped to the public route — a thumbnail is on
           neither surface, so it states its own. */
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div
        style={{
          width: `${FACE_WIDTH}px`,
          /* ⚠ **A FLOOR, not a height — and the distinction is the whole reason this is safe.**

             There was no height here at all, on the rule that the card grows to its content and
             the wrapper crops it. That is right for a card taller than the window and wrong for
             one shorter: a five-field card ended a hundred pixels above the crop and left a
             transparent band under it, so the tile had a hole in its bottom third.

             `height` on the wrapper plus `flex: 1 0 auto` on the card means the card **never
             shrinks** (a tall one overflows and is cropped exactly as before) and **grows into
             the slack** when there is any. Growing is a no-op for the card's own layout: its
             sheet already carries `flexGrow: 1` so that paper runs to the bottom edge however
             few fields the owner mapped — that mechanism exists, and this is the first caller
             to give it a box to fill. Field count is not a design axis. */
          height: `${height}px`,
          display: "flex",
          flexDirection: "column",
          transform: `scale(${scaleVar})`,
          transformOrigin: "top left",
        }}
      >
        <CardPage
          className="grow shrink-0"
          resolved={resolved}
          actions={
            <div data-card-actions="" data-card-action-count={1}>
              <CardActionButton
                action="save"
                paletteId={resolved.palette.id}
                palette={resolved.palette}
                variant="primary"
                surface="canvas"
                shape={resolved.template.shape.buttonShape}
                icon={<SmartphoneNfc size={18} strokeWidth={1.75} />}
                trailing={<ArrowRight size={18} strokeWidth={1.75} />}
              >
                Send to Phone
              </CardActionButton>
            </div>
          }
        />
      </div>
    </div>
  );
}
