import { belief } from "@/fixtures/marketing";

import { Section } from "./section";
import { accented, Heading, Prose } from "./type";

/**
 * Section 7 — the belief. Brief Section 9, and the "little bit of a motivational ending" the
 * client asked for in the voice note.
 *
 * ## ⚠ NO VISUAL, AND THE EMPTINESS IS THE DESIGN
 * Every other section on this page carries an object: a looping card, a before and after, an
 * exhibit, six tiles, five rows. This one is type on the wash with air around it, and it works
 * *because* of what precedes it — after six worked sections, space reads as arrival rather
 * than as something missing.
 *
 * This is the one place on the page where the "the hero is type-only" instinct, which four
 * rejected hero objects earned, is exactly right. It was just the wrong section to apply it to.
 *
 * The ground is `wash` rather than white because `how-it-works` above it is white and the
 * alternation is the page's only separator — and because the near-white green then ramps into
 * the deep green close beneath it, which makes the last two sections read as one ending.
 *
 * Set at `heading-xl` (36→60px), the largest step below the hero's `display`. Not `display`
 * itself: that component renders an `<h1>` and is the hero's, and a page with two `<h1>`
 * elements has no document outline. This is the page's second-largest moment, and the last
 * thing a reader is asked to agree with before the close.
 */
export function Belief() {
  return (
    <Section id="belief" tone="wash" labelledBy="belief-heading">
      <div className="py-6 md:py-10">
        <Heading id="belief-heading" size="xl" className="max-w-mk-measure-head">
          {accented(belief.heading, belief.accent)}
        </Heading>
        <Prose size="lead" className="mt-8 max-w-mk-measure md:mt-10">
          {belief.body}
        </Prose>
      </div>
    </Section>
  );
}
