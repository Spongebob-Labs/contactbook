import type { CSSProperties, ReactElement, ReactNode } from "react";

import { CardGround } from "@/card/card-ground";
import type { Finish, Texture, TexturePresence, TextureScale } from "@/card/card-surface";
import { paletteVars, type TemplatePalette } from "@/card/template-palettes";
import { cn } from "@/lib/cn";

/**
 * One painted rectangle of card ground, for a Design-panel cell.
 *
 * ## ⚠ It does not paint anything. That is the entire point of this file.
 *
 * Every cell in the panel is a live rendering of a treatment rather than a named chip, so the
 * panel has to be able to draw the five `SurfaceStyle`s and the five `PatternId`s at swatch
 * size. It draws them with **`<CardGround>`** — the card's own painter, the one that renders
 * `/c/{slug}` — and adds nothing but a box to put it in.
 *
 * The alternative was a second painter here, and for one afternoon there was one: ~120 lines of
 * motif SVG and gradient assembly, derived from `PATTERNS` and `PATTERN_ALPHA` so that at least
 * the tile sizes could not drift. It was deleted the moment `card-ground.tsx` existed, because
 * "two painters that agree today" is precisely the shape of the defect this whole build is
 * organised against — a preview that shows something the artefact does not. A cell that renders
 * the real component cannot describe a treatment the card will not produce, and the contrast
 * arguments the treatments raise (`motifAlpha`'s solve, the mesh envelope, why a motif sits on
 * the flat ground and never on the gradient) stay in the one file that reasons about them.
 *
 * ## Two things a caller has to know
 *
 * · **The palette reaches `<CardGround>` as CSS custom properties, not as props.** It paints
 *   `var(--c-ground)` and `var(--c-ground-gradient)`, which is what lets the card page set them
 *   once on its root. A swatch is not inside a card, so it declares them itself with
 *   `paletteVars` — the same function, so the same values.
 * · **⚠ Outside a card page the ground is an ordinary in-flow box, and something has to give it
 *   a size.** `card.css` positions it `absolute; inset: 0` only under
 *   `[data-card-variant="page"]`, precisely so that a swatch can size it instead of having it
 *   collapse or escape to some unrelated positioned ancestor. That job is done here, and it is
 *   done with a **one-cell grid**: the ground and the optional overlay are both placed in the
 *   same cell, so the ground stretches to whatever height the cell was given and the overlay
 *   sits on top of it without either of them being positioned by hand.
 *
 *   It is a grid and not `absolute; inset: 0` on the ground because that would be this file
 *   reaching in to re-position another component's element — the arrangement would then be
 *   stated in two places and would break the day the base rule changes again. A grid states
 *   only what is true here: *these two things occupy the same rectangle*.
 *
 *   The failure mode is worth naming, because it is silent: with no size the ground still has
 *   the right `background-color`, so an assertion that reads the paint passes while the cell
 *   renders as a blank white box. `tests/e2e/builder.spec.ts` therefore measures the cells'
 *   height as well as their colour.
 *
 * ⚠ Consequence worth knowing before writing a locator: the builder screen now contains
 * `[data-card-ground]` elements that are **not** the previewed card's. Scope to
 * `[data-builder-preview]` for the card's own, or to `[data-design-panel]` for the cells'.
 */

export interface SurfaceSwatchProps {
  /** ⚠ The card's own palette, from the screen's single `resolveCard` (I-5). */
  palette: TemplatePalette;
  /** How the colour is laid down, exactly as on the card. */
  finish: Finish;
  /** What is cut into it, exactly as on the card. */
  texture: Texture;
  /** Defaulted so a cell demonstrating a *finish* need not restate the texture dials. */
  texturePresence?: TexturePresence;
  textureScale?: TextureScale;
  /**
   * Sizing, radius and border — the *box*. The swatch never decides how big it is; its cell
   * does. **Not a layout hook**: `display` is the grid that stacks the ground and the overlay,
   * and a `flex` here would leave the ground a zero-width flex item.
   */
  className?: string;
  /** The overlay's own layout, when there are children to lay out. */
  contentClassName?: string;
  /** A composition drawn on top — the header-layout cells' bars and portrait. */
  children?: ReactNode;
}

/**
 * Decorative: the cell's caption is what names it, so there is nothing here for a screen reader.
 * `<CardGround>` marks itself `aria-hidden` as well, which is belt and braces on a decorative
 * element and costs nothing.
 */
export function SurfaceSwatch({
  palette,
  finish,
  texture,
  texturePresence = "medium",
  textureScale = "regular",
  className,
  contentClassName,
  children,
}: SurfaceSwatchProps): ReactElement {
  return (
    <span
      data-surface-swatch={`${finish}/${texture}`}
      aria-hidden="true"
      className={cn(
        // One cell, and everything in it. See the ⚠ in the module note.
        "relative grid w-full grid-cols-1 grid-rows-1 overflow-hidden rounded-md",
        "[&>*]:col-start-1 [&>*]:row-start-1",
        className,
      )}
      style={paletteVars(palette) as CSSProperties}
    >
      <CardGround
        palette={palette}
        finish={finish}
        texture={texture}
        texturePresence={texturePresence}
        textureScale={textureScale}
      />
      {children === undefined ? null : (
        /* `relative` is load-bearing: the ground carries `z-index: 0`, which makes it a
           positioned box, and a *static* sibling would paint underneath it however late it came
           in the markup. */
        <span className={cn("relative", contentClassName)}>{children}</span>
      )}
    </span>
  );
}
