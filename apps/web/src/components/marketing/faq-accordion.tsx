"use client";

import * as Accordion from "@radix-ui/react-accordion";

import { faq } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";
import { Section } from "./section";
import { Footnote, HEAD_TO_BODY, Prose, QuestionTitle, SectionHead } from "./type";

/**
 * The FAQ — seven objections, collapsed.
 *
 * ## Why this pass is allowed to be interactive when the rest of the deck is not
 * The seven answers run 149-364 characters and total 1,712. Laid out flat on the page's body
 * measure that is thirty-odd lines of copy plus the gaps between them, immediately before the
 * closing call to action — a wall the reader scrolls past rather than reads, and it pushes the
 * one section with a decision in it a full viewport further down. Collapsed, the same pass is a
 * seven-line index of the objections, which is what a sceptical reader is actually scanning
 * for.
 *
 * This is also not a violation of the page's motion policy. The deck has one authored moment,
 * the hero film, and nothing here animates because the reader scrolled — the panel opens
 * because somebody pressed a control, which is feedback, and its absence would read as the
 * interface being broken rather than as the page being calm.
 *
 * The cost is real and accepted: Radix unmounts a closed panel, so an unopened answer is not
 * in the DOM and a browser find-in-page will not hit it. The questions carry the searchable
 * words ("QR", "WhatsApp", "delete", "number"), which is the mitigation; the alternative —
 * `forceMount` plus a clipped panel — puts 1,712 characters back into the accessibility tree
 * with nothing to gain, since a screen reader already has `aria-expanded` and can open them.
 *
 * ## The indicator is a drawn plus that turns into a drawn minus
 * It used to be the character `+` rotated 45 degrees into a multiplication cross, because a
 * superseded spec banned every `<svg>` above the footer and a typed glyph was the only shape
 * available. That ban is retired, and a unicode character standing in for an icon is now the
 * thing that is banned: it inherits the body font's metrics, it is a different width in every
 * face the page might fall back to, and it cannot be given a stroke weight, so it never
 * matched the 2px hairline vocabulary the rest of the deck is drawn in.
 *
 * So: two 2px `currentColor` strokes in a 20-unit box rendered at 20px, which is 1:1 and puts
 * the stroke on the pixel grid. The vertical stroke turns 90 degrees about the centre of the
 * box and lands exactly on the horizontal one — `(10,4)-(10,16)` rotated about `(10,10)` is
 * `(4,10)-(16,10)` — so a plus becomes a minus with one object moving. That pairing says
 * "expand" and "collapse" without a legend, where a cross says "close" and a chevron says
 * "there is more below", neither of which is what this control does.
 *
 * Rotating a line rather than swapping two glyphs is the whole reason to draw it: a character
 * swap cannot be transitioned, so the indicator would pop between two shapes while the panel
 * under it is still moving, and the two would read as unrelated events. A rotation is also
 * interruptible mid-flight when a reader closes a row they only half-opened.
 *
 * ⚠ **Three properties on that line are load-bearing and none of them is decoration.**
 *   · `[transform-box:view-box]` — the CSS initial value for SVG children, restated because a
 *     reset that sets `transform-box: border-box` anywhere above this element would move the
 *     origin to the line's own 2x12 bounding box and the minus would land off-centre.
 *   · `origin-center` — without it SVG's `transform-origin` default of `0 0` swings the line
 *     out of the box entirely.
 *   · `rotate` in the transition list — Tailwind v4 emits `rotate-90` as the standalone
 *     `rotate` property, NOT as `transform`, so a bare `transition-transform` never fires and
 *     the stroke snaps. `transform` stays in the list so a later translate or scale utility on
 *     the same element still animates.
 *
 * `aria-hidden` on the whole svg: the trigger already exposes `aria-expanded`, so a screen
 * reader that also reached the graphic would announce the state twice. It is likewise the one
 * mark on this pass that is not in `@/fixtures/marketing` — it is an indicator, not copy, and
 * there is nothing for the fixture to hold.
 *
 * ## The height transition is deliberately NOT in this file
 * `marketing-motion.css` animates `[data-faq-answer][data-state]` from 0 to
 * `--radix-accordion-content-height`, which is the only way to reach `auto` without measuring
 * in JS. Two consequences for the markup here:
 *
 *   · `data-faq-answer` is load-bearing, not a test hook. Drop it and the panel jumps open.
 *   · **No padding on `Accordion.Content`.** Height animates to 0; padding does not collapse
 *     with it, so padding on the animating element leaves a band of blank ground under every
 *     closed question and the ruled list looks broken at rest. The answer's `pb-6` sits on the
 *     child instead.
 *
 * The indicator runs at `--mk-dur-tap` (120ms) while the panel runs at `--mk-dur-lift`, and
 * that mismatch is intended: the indicator is acknowledging the press and should be done
 * almost before the finger lifts, while the panel is revealing content and needs the longer
 * curve to arrive rather than appear.
 *
 * ## The figure: a narrow head of 4, one empty column, an accordion of 7
 * Inside the 1200px page less its gutters a 12-column grid on `gap-8` gives ~65px columns: the
 * head takes 4 of them and the accordion 7, with column 5 left empty as the air between them.
 * An even 6/6 would give the questions ~552px and the head ~552px it has no use for — the head
 * is a label, the questions are the thing being read.
 *
 * At the accordion's ~649px a 16px answer sets around 80 characters per line, past the top of
 * the 65-75ch band, so the answers take `max-w-mk-measure` (68ch) and the column's extra width
 * is spent on the questions instead. The two longest questions are 63 characters, which lands them at the
 * single-line limit at 18px: some wrap and some do not. That is why the indicator is offset
 * with a fixed `mt-1` against `items-start` rather than centred on the row — at 18px on a 1.55
 * line-height the first line box is 27.9px and a 20px mark centres on it at 3.95px, so the
 * mark pins to the first line of a question that wraps instead of drifting half a line down.
 *
 * `items-baseline` was the previous answer and is wrong for a drawn mark: an `<svg>` is an
 * inline-replaced element whose baseline is its bottom margin edge, so baseline alignment sets
 * the mark's descender on the text baseline and hangs the whole glyph high.
 *
 * The head is sticky at `lg`. With an answer open this column is shorter than the accordion
 * beside it, and a reader scrolling the questions should still see which pass they are in.
 * `lg:top-32` matches the `scroll-mt-32` `<Section>` sets, so the head parks exactly where a
 * `/#faq` jump would have put it — clear of the fixed bar and of the pass overlap above.
 *
 * ## Two contract notes
 * · **Stone is legal here.** The ground is `paper`, which is the ground `--mk-stone` was
 *   measured against: 4.55:1. This pass therefore keeps `<Prose>`'s default tone. The
 *   `tone="ink"` substitution the wash passes make is a wash-only rule — stone drops to
 *   2.30-3.07:1 on the four washes and fails AA there, and on paper it does not. The
 *   indicator is `--mk-pebble` (4.52:1 on paper) rather than an ink opacity, because it is the
 *   only carrier of open/closed state and so answers to 1.4.11's 3:1 with measured headroom,
 *   where `ink/60` would land near 3.1:1 by accident.
 * · **The triggers are the only buttons in this pass, and the count is asserted.** The suite
 *   reads `getByRole("button")` inside `[data-section="faq"]` and expects `faq.entries.length`,
 *   all seven with `aria-expanded="false"`. The obvious FAQ tail — a "still stuck, talk to us"
 *   link under the last row — would break that test, and the fixture carries no copy for one
 *   anyway.
 */

/**
 * The indicator's own transition, shared by the graphic's colour and the stroke's rotation so
 * the two halves of one gesture cannot drift apart. Written once because a second copy is how
 * a 120ms tap quietly becomes 120ms in one place and 150ms in the other.
 */
const INDICATOR_MOTION = "duration-[var(--mk-dur-tap)] ease-[var(--mk-ease)]";

export function FaqAccordion() {
  return (
    <Section id="faq" tone="paper" labelledBy="faq-heading">
      {/*
        No row `gap` on the grid: at one column the distance from the head to the accordion is
        the page's `HEAD_TO_BODY` step, carried on the accordion itself like every other
        pass's body. A `gap` here would be a second mechanism for the same measurement, which
        is how the page ended up with five different head-to-body distances.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-8">
        {/*
          `lg:self-start` is what makes the sticky work at all: a grid item stretches to its
          row by default, so a sticky child of full row height has nothing left to stick
          within and silently behaves as static.
        */}
        <div className="lg:sticky lg:top-32 lg:col-span-4 lg:self-start">
          <SectionHead heading={faq.heading} headingId="faq-heading" />

          {/*
            The aside as a `<Footnote>` rather than as `<SectionHead>`'s `lead`. It is a remark
            about the pass, not a subhead for it, and at the 18px lead step directly beneath a
            48px headline it would read as the second half of the headline.

            `<Footnote>` is the page's one closing-caveat device — a short qualification under a
            hairline — and it owns the gap above and below its rule, so no hand-set `mt`/`pt`
            belongs here. The hairline is the same device separating the rows opposite, which is
            the entire drawing vocabulary this pass has: a 1px rule, and nothing else. Adding a
            frame around either column would put a second radius inside the pass, and the pass
            is already the card.
          */}
          <Footnote>{faq.aside}</Footnote>
        </div>

        {/*
          `border-t` on the root, `border-b` on every item: the list closes at both ends without
          any item drawing an edge its neighbour has already drawn. This is the one repeated set
          on the page that is not `RULE.STACK` — that construction leaves the outer edges clean
          by design, and a bounded list of collapsed rows needs both of them drawn.

          `lg:mt-0` cancels `HEAD_TO_BODY` once the two blocks go side by side, where the head
          is no longer above the body and the distance between them is horizontal.

          `type="single"` with `collapsible` — one answer at a time, and the open one can be
          closed again. `multiple` would let a reader rebuild the exact wall of text this pass
          exists to avoid. No row is open on load: choosing a default would assert that one of
          the seven objections is the one everybody arrives with.
        */}
        <Accordion.Root
          type="single"
          collapsible
          className={mkcn(
            HEAD_TO_BODY,
            "border-t border-mk-hairline lg:col-span-7 lg:col-start-6 lg:mt-0",
          )}
        >
          {faq.entries.map((entry) => (
            <Accordion.Item
              key={entry.id}
              value={entry.id}
              data-faq-item={entry.id}
              className="border-b border-mk-hairline"
            >
              {/*
                `Accordion.Header` renders an `<h3>`, which sits correctly under this pass's own
                `<h2>` and gives a screen reader seven navigable headings instead of seven
                anonymous buttons. No styling: preflight has already zeroed its margin and
                dropped it to the inherited size.
              */}
              <Accordion.Header>
                <Accordion.Trigger
                  className={mkcn(
                    "group flex w-full items-start justify-between gap-6 text-left",
                    // 20px + ~28px + 20px is a ~68px row, so the pointer target clears the 44px
                    // floor across the full column width rather than only on the words.
                    // `cursor-pointer` is explicit: v4's preflight does not set it on buttons.
                    "cursor-pointer py-5",
                    // No `focus-visible` utilities and no `rounded-*`: `marketing.css` themes
                    // the ring globally — Sapphire outline, white halo, `--mk-radius-chrome` — and
                    // it applies that radius only while focused. Setting a radius here would
                    // put a second one inside the pass at rest, which the deck forbids because
                    // the pass is already the card.
                  )}
                >
                  {/*
                    `<QuestionTitle as="span">` — a sentence somebody would say, one step above
                    body copy. `as="span"` because the Radix trigger is already the `<button>`
                    and the heading is already the `Accordion.Header` above it, so this element
                    carries type and nothing else.
                  */}
                  <QuestionTitle as="span">{entry.question}</QuestionTitle>

                  {/*
                    The drawn indicator. See the block comment above for why every attribute on
                    the rotating line is load-bearing.
                  */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    className={mkcn(
                      // 20px box on a 20-unit viewBox: 1:1, so the 2px stroke lands on the
                      // pixel grid instead of being resampled to a soft 1.6px.
                      "mt-1 size-5 shrink-0 text-mk-pebble",
                      "transition-colors",
                      INDICATOR_MOTION,
                      "group-hover:text-mk-ink group-data-[state=open]:text-mk-ink",
                    )}
                  >
                    <line x1="4" y1="10" x2="16" y2="10" />
                    <line
                      x1="10"
                      y1="4"
                      x2="10"
                      y2="16"
                      className={mkcn(
                        "origin-center [transform-box:view-box]",
                        "transition-[rotate,transform]",
                        INDICATOR_MOTION,
                        "group-data-[state=open]:rotate-90",
                      )}
                    />
                  </svg>
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Content data-faq-answer={entry.id} className="overflow-hidden">
                <Prose className="max-w-mk-measure pb-6">{entry.answer}</Prose>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </Section>
  );
}
