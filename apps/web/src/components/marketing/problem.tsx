import { problem } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";
import { Section } from "./section";
import { Figure, HEAD_TO_BODY, Prose, RULE, SectionHead } from "./type";

/**
 * The wedge — the only pass in the deck that argues instead of demonstrating.
 *
 * Everything below the hero shows the product doing something. This one does not: it is three
 * paragraphs about why digital address books rot, and it has to earn the eight sections that
 * follow it. So it sets like the opening of an essay, and every decision here is about keeping
 * it from setting like a feature block. There is no panel, no fill, no illustration and no
 * icon in it — which is also the honest answer to "what would an icon depict here?" The pass
 * itself is already the object; a card drawn inside it would be a second frame around prose.
 *
 * ## White, not paper, and that is about the stack
 * `paper` is the deck's resting ground and `white` is one step above it. This is the first
 * pass after the sky, so it takes the lighter ground: the reader comes off a saturated
 * gradient onto the brightest surface in the stack, and the passes settle down from there.
 * White also buys the essay its contrast outright — ink measures 17.41:1 here and stone
 * 4.96:1, against 15.97:1 and 4.55:1 on paper — so the default `tone="stone"` is legal for the
 * body copy without the ink substitution the four wash passes are built around.
 *
 * ## 5 · air · 6 across the twelve
 * Heading on columns 1 to 5, the prose on 7 to 12, column 6 left empty. Two rejected
 * alternatives: a 6/6 split, which is the proportion a reader recognises as a layout template
 * before reading a word; and the full-width head with the body beneath it that `how-it-works`
 * uses, which is right for a set of peers and wrong here — the heading is a claim and the
 * paragraphs answer it, so they need to sit opposite each other rather than in sequence.
 *
 * This pass is the ORIGIN of the 5/air/6 figure and it is the only one still on it. When
 * seven bands were all reaching for a narrow head and a wider block, the figure had stopped
 * being a composition; the others were moved off it so this one could keep it.
 *
 * At the 1200px page the content column is 1120px (two 40px gutters), so twelve tracks with
 * eleven 48px gaps run about 49px each and the 6-span measures roughly 536px. That is inside
 * the 65 to 75 character band at the 16px step, so **the column is what governs the measure
 * today and `max-w-mk-measure` is the guard, not the active constraint** — it only starts
 * doing work if the page ever widens. A cap alone would not have survived that; a column alone
 * would not either.
 *
 * ## The first paragraph is the only one in ink, and that is the hierarchy
 * Opening paragraph: `lead` (18px) in ink. The two that follow: `body` (16px) in stone. Size
 * and colour carry the drop into the essay and the weight never changes, because a heavier
 * first paragraph is a deck and this is prose. There is no separate lead line above the
 * heading for the same reason — the paragraphs opposite ARE the lead, which is why
 * `SectionHead` is passed a heading and nothing else.
 *
 * And nothing above the heading. A small uppercase label there would be the page apologising
 * for a headline that does not need it. The kicker field this pass used to read was deleted
 * from the copy fixture outright, so reintroducing one now would mean inventing a string in
 * the component — which the "every word comes from the fixture" rule forbids on its own.
 *
 * ## The three numerals are this pass's entire iconography
 * A page of unbroken prose gives a scanner nothing to land on, and this is the band that needs
 * a landing point most. `<Figure>` is the page's one numeral treatment — the same object the
 * step ordinals are set in, decided once in `type.tsx` — at `text-mk-heading-lg`, the same
 * step as the section headline, so the row reads as a second voice in the same type system
 * rather than as a statistics widget. `tone` stays at its `ink` default: these figures ARE the
 * content, unlike a step ordinal that merely counts.
 *
 * **There are three figures and there cannot be a fourth.** The fixture's own note says why:
 * 21, 9 and 1 are facts this repository can be checked against (21 `FieldType` members, 9
 * entries in `PALETTE_ORDER`, one URL per card), and a fourth would have to be a market
 * statistic with no source behind it. The layout says so too — a fourth count wraps onto a
 * second row under `md:grid-cols-3` and arrives carrying a left rule and no top rule, which is
 * the visible symptom to look for if the fixture ever grows.
 *
 * ## Interior rules, not cards
 * The counts are a `<dl>` on the bare ground. `RULE.ROW_MD` draws every interior hairline —
 * one per shared edge, owned by the cell that FOLLOWS it, horizontal while stacked and
 * vertical once the row forms — so the outer edges of the set stay clean with no `first:` or
 * `last:` negation of a border. A `border` on each item instead double-draws every interior
 * edge (2px where two 1px rules meet) and leaves a stray rule around the outside.
 *
 * The `border-t` on the `<dl>` itself is not an interior rule and stays hand-written: it is
 * the set's top edge, the boundary between the essay and the counts. It is `--mk-hairline` to
 * match the weight `RULE` draws inside, because a top rule a step darker than the three it
 * introduces reads as a mismatch.
 *
 * Since `RULE.ROW_MD` rotates its rules from horizontal to vertical at exactly `md:`, the grid
 * has to flip at `md:` too. If the two ever disagree the rules turn while the layout is still
 * stacked, which looks like a rendering bug rather than a breakpoint.
 *
 * ## No motion and no states, deliberately
 * There is not a single control in this pass — no link, no button, nothing focusable — so
 * there is nothing here to press, open or underline. The page's one authored moment is the
 * hero film above; a scroll reveal on an essay would be a plugin announcing itself.
 */
export function Problem() {
  return (
    <Section id="problem" tone="white" labelledBy="problem-heading">
      <div className="grid grid-cols-1 gap-y-10 md:grid-cols-12 md:gap-x-8 lg:gap-x-12">
        {/* Columns 1 to 5. No lead: the paragraphs opposite are the lead. */}
        <div className="md:col-span-5">
          <SectionHead heading={problem.heading} headingId="problem-heading" />
        </div>

        {/*
          Columns 7 to 12, with 6 left as air. `gap-5` (20px) between paragraphs rather than a
          first-line indent: at the body step's 1.6 line height, 20px is the smallest gap that
          clears the leading and still reads as a paragraph break in a stack this short.
        */}
        <div className="flex max-w-mk-measure flex-col gap-5 md:col-span-6 md:col-start-7">
          {problem.paragraphs.map((paragraph, index) => (
            <Prose
              key={paragraph}
              size={index === 0 ? "lead" : "body"}
              tone={index === 0 ? "ink" : "stone"}
            >
              {paragraph}
            </Prose>
          ))}
        </div>
      </div>

      {/*
        `HEAD_TO_BODY` is the page's one gap between a pass's head and the body under it, and
        the counts are this pass's second body, so they take the same step the prose spread
        does. The row carries no `gap` on purpose: a gap would leave the interior rules
        floating in dead space, so the inset is padding on the cells and the rules sit flush.
      */}
      <dl
        className={mkcn(
          "grid grid-cols-1 border-t border-mk-hairline md:grid-cols-3",
          HEAD_TO_BODY,
          RULE.ROW_MD,
        )}
      >
        {problem.counts.map((count) => (
          <div
            key={count.figure}
            data-count={count.figure}
            className="flex flex-col gap-2 pt-8 md:px-8 md:pt-10 md:first:pl-0 md:last:pr-0"
          >
            {/*
              The figure is the term and the label defines it, so the pair runs
              figure-then-label in the DOM as well as on screen. Inverting it — label as `dt`,
              figure as `dd` — needs `flex-col-reverse` to keep the numeral on top, which
              decouples reading order from visual order for nothing.

              `<Prose as="dd">` is what puts body copy inside a `<dl>` group without retyping
              its tokens by hand. `--mk-measure-tight` (46ch) is the nearest shared measure to
              this copy: the three labels run 47 to 51 characters, so each one breaks to two
              lines and the row keeps a single bottom edge instead of a ragged one. Worth
              re-checking if the fixture labels are rewritten to different lengths.
            */}
            <Figure as="dt">{count.figure}</Figure>
            <Prose as="dd" size="small" className="max-w-mk-measure-tight">
              {count.label}
            </Prose>
          </div>
        ))}
      </dl>
    </Section>
  );
}
