import type { ReactNode } from "react";

import { mkcn } from "./mk-cn";
import { MkRevealGroup } from "./mk-reveal";
import type { MarketingSectionId } from "@/fixtures/marketing";

/**
 * A pass in the deck.
 *
 * ## The structure, and why it is this one
 * The page is a wallet. Each section is a pass, inset from the viewport, with its own ground,
 * its own radius and a real shadow, sitting slightly over the pass above it. The reader is
 * scrolling down a stack of the product's own object.
 *
 * That is not decoration standing in for structure: the wallet pass is the thing this product
 * makes, and a page that is literally a stack of them says what the product is before a word
 * is read. It also solves the problem the previous build could not: separating twelve bands
 * with hairlines on one flat ground gave every section the same weight and made the page read
 * as a document rather than as a product.
 *
 * ## Depth is the separation device, not hairlines
 * Passes overlap by `--mk-pass-overlap` and each sits above the one before it. The shadow does
 * the work a 1px rule used to: it says these are objects at different depths, which a hairline
 * on a flat plane cannot say. Radius, ground and shadow are the pass; nothing else may add a
 * second frame inside one.
 *
 * ## No entrance animation, deliberately
 * Every pass lifting identically on scroll is "one identical entrance on every section", which
 * is the motion failure mode — it reads as a template with a plugin on it. The page has one
 * authored moment, the hero film, and after that motion belongs to interaction: a control
 * pressing, an answer opening, a link underlining. The stack's depth is present on first paint
 * for a reader who lands mid-page, for a crawler, and with scripting off.
 */

export interface SectionProps {
  id: MarketingSectionId;
  children: ReactNode;
  /**
   * The pass's ground.
   *
   * The four washes are card grounds — Clay, Pistachio, Periwinkle, Amber — not pastels
   * invented for this page. They replaced mint / peach / lavender / teal-mist.
   *
   * ⚠ A wash changes which ink is legal on it, and these are stricter than the pastels were:
   * `--mk-stone` measures **2.30–3.07:1** on the four (it was 3.99–4.21 on the pastels — a
   * near miss; this is not close), and `--mk-ink` at 70% composites to 4.34:1 on Clay. Body
   * copy inside a wash pass is `<Prose tone="ink">` at full strength, and there is no
   * secondary text level available on a wash at all.
   *
   * ⚠ `amber` is also the primary action fill. A pass on that tone may not carry the primary
   * CTA — the button would be its own ground at 1.0:1. No section takes it today.
   */
  /**
   * ⚠ THREE GROUNDS, AND THE MIGRATION SHIMS ARE GONE, 2026-09-08.
   *
   *   · `white` — the default
   *   · `wash`  — #F2FAF8, the near-white brand-green tint. Alternates with white so a section
   *               boundary needs no border and no rule.
   *   · `deep`  — #286257, the brand green at 7.03:1, carrying WHITE text. Used exactly once
   *               (the close), which is what makes it read as an ending.
   *
   * `paper`, `clay`, `pistachio`, `periwinkle`, `amber` and `ink` were kept for one build as
   * aliases pointing at white or the wash, so that sections still awaiting their rewrite kept
   * compiling. Every one of those sections has now been rewritten or deleted, so the shims are
   * deleted with them — a shim nobody removes becomes a second palette again, which is the
   * exact defect `marketing.css`'s HUES block was written against.
   *
   * The nine card grounds are untouched and are what the example tiles wear. The four washes
   * were the marketing layer's *dilution* of them, and diluting a measured palette is what
   * produced the substitution rule DESIGN.md used to carry.
   */
  tone?: "white" | "wash" | "deep";
  /** The hero, which is not a pass — it is the sky the deck sits on. */
  bare?: boolean;
  labelledBy?: string;
  label?: string;
  className?: string;
  innerClassName?: string;
}

const GROUND: Record<NonNullable<SectionProps["tone"]>, string> = {
  white: "bg-mk-white",
  wash: "bg-mk-wash",
  deep: "bg-mk-green-deep",
};

/**
 * The tones that carry WHITE text, so a section can hand its children the right ink without
 * every one of them re-deriving it. `deep` is the brand green at 7.03:1 — white reads 12.4:1
 * on it.
 */
const DARK_GROUND = new Set(["deep"]);

/** design.md's 1200px page with its gutters. */
export const CONTENT_COLUMN = "mx-auto w-full max-w-mk-page px-6 md:px-10";

/**
 * The rhythm inside a pass. Generous, because a pass with tight padding reads as a panel and
 * the whole point is that it reads as an object you could pick up.
 */
const PASS_PAD = "py-20 md:py-28 lg:py-32";

export function Section({
  id,
  children,
  tone = "white",
  bare = false,
  labelledBy,
  label,
  className,
  innerClassName,
}: SectionProps) {
  if (bare) {
    return (
      <section
        id={id}
        data-section={id}
        data-tone={tone}
        aria-labelledby={labelledBy}
        aria-label={label}
        className={mkcn("relative scroll-mt-28", className)}
      >
        {children}
      </section>
    );
  }

  return (
    <section
      id={id}
      data-section={id}
      data-tone={tone}
      aria-labelledby={labelledBy}
      aria-label={label}
      // `scroll-mt` clears the fixed bar AND the pass's own overlap, so a jumped-to heading
      // lands inside its pass rather than under the lip of the one above it.
      className={mkcn(
        // ⚠ FLAT AND FULL-BLEED, 2026-09-08. This used to pull itself up by
        // `--mk-pass-overlap` and inset itself by `px-3 md:px-6` so that each section read as
        // a rounded pass riding over the lip of the one above it — the page as a wallet of
        // the product's own cards.
        //
        // It goes because the brief asks for a page that "just scrolls down", and an
        // overlapping stack makes every boundary a visual event: eight of them in a row is
        // the opposite of calm, and the reader is made to notice the furniture instead of
        // the argument. A ground change is now the only separator, which is why `wash`
        // exists.
        //
        // The ground is on the SECTION now rather than on an inset child, so it runs edge to
        // edge at every width. `--mk-pass-overlap` and `--mk-pass-shadow` are unreferenced
        // from here on.
        "relative scroll-mt-28",
        GROUND[tone],
        DARK_GROUND.has(tone) ? "text-mk-white" : "",
        className,
      )}
    >
      {/*
        ⚠ THE DECK'S SCROLL MOVE LIVES HERE, ONCE, RATHER THAN IN EACH SECTION.

        The client asked for scroll motion; DESIGN.md's standing objection to it was that
        scattered reveals "make every section behave identically", which is a real failure and
        the one to design against. Owning the move at `<Section>` is the answer: the deck moves
        as a deck — every pass makes the same `deal` — and an individual section cannot quietly
        invent a seventh entrance for itself.

        `MkRevealGroup` renders `display: contents`, so it generates no box and the pass is
        still the section's own child for layout, radius and shadow. `stagger` is off because
        each group holds exactly one pass, and a delay on a single element is a pause.

        Hero is unaffected: it is `bare` and returns above this, and its motion is a LOAD
        sequence rather than a scroll one, because nobody scrolls to the first thing they see.
      */}
      <MkRevealGroup selector="[data-pass]" move="deal" stagger={false}>
        <div data-pass="" className={mkcn("relative", PASS_PAD)}>
          <div className={mkcn(CONTENT_COLUMN, innerClassName)}>{children}</div>
        </div>
      </MkRevealGroup>
    </section>
  );
}
