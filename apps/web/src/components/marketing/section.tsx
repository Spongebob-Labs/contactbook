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
  tone?: "white" | "paper" | "clay" | "pistachio" | "periwinkle" | "amber" | "ink";
  /** The hero, which is not a pass — it is the sky the deck sits on. */
  bare?: boolean;
  labelledBy?: string;
  label?: string;
  className?: string;
  innerClassName?: string;
}

const GROUND: Record<NonNullable<SectionProps["tone"]>, string> = {
  white: "bg-mk-white",
  paper: "bg-mk-paper",
  clay: "bg-mk-clay",
  pistachio: "bg-mk-pistachio",
  periwinkle: "bg-mk-periwinkle",
  amber: "bg-mk-amber",
  ink: "bg-mk-ink",
};

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
        // The overlap lives on the SECTION, not on the pass inside it.
        //
        // It was `-mt-[…] first:mt-0` on `[data-pass]`, and `[data-pass]` is the only child of
        // its section — so `:first-child` matched all eight passes, `first:mt-0` won on
        // specificity, and the overlap never applied to any of them. The deck did not stack.
        //
        // `relative` is what makes DOM order the paint order, so each pass rides over the lip
        // of the one before it rather than under it. Without it the stack inverts.
        "relative z-0 -mt-[var(--mk-pass-overlap)] scroll-mt-32 px-3 md:px-6",
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
        <div
          data-pass=""
          className={mkcn(
            "relative mx-auto w-full max-w-[1320px]",
            "rounded-[28px] md:rounded-[36px]",
            GROUND[tone],
            PASS_PAD,
            className?.includes("shadow-none") ? "" : "",
          )}
          style={{ boxShadow: "var(--mk-pass-shadow)" }}
        >
          <div className={mkcn(CONTENT_COLUMN, innerClassName)}>{children}</div>
        </div>
      </MkRevealGroup>
    </section>
  );
}
