import { close } from "@/fixtures/marketing";

import { Section } from "./section";
import { Heading, MkButtonLink, Prose } from "./type";

/**
 * Section 8 — the close. Brief Section 11's final CTA.
 *
 * ## The only dark surface on the page, and it wears the brand
 * `tone="deep"` is `--mk-green-deep #286257` — the brand green at 7.03:1, carrying white text
 * at 12.4:1. The previous close inverted to Onyx with an Amber button, which was correct when
 * the page had four coloured washes and Amber was its action colour. On a white page whose one
 * accent is a green, ending on Onyx ends on a colour the page does not otherwise use.
 *
 * ⚠ THE BUTTON IS WHITE, NOT AMBER, AND NOT GREEN. Amber was legal only on a dark ground and
 * is no longer part of this page's palette. A green button on a green ground is a button you
 * have to look for. White on the deep green is 7.03:1 for the fill and carries Onyx type at
 * full strength — the strongest control the page can make, in the one place it wants a reader
 * to act.
 *
 * ## ⚠ THIS IS NOT THE BRIEF'S PAIR OF CONTROLS YET
 * The brief closes on "Join the waitlist" and "Contact us". Neither route exists, and a hero
 * or a close whose button 404s is a defect rather than a design decision — so this carries the
 * one control that works today. Both labels and both targets change in the same step that
 * builds `/waitlist` and `/contact`, which is blocked on one decision about where a form
 * submission goes. Flagged in `plan.md`; do not "fix" this by pointing a button at a page that
 * is not there.
 *
 * ## Centred, and it is the only centred thing on the page
 * Everything above is ranged left against the column. A close is a single object with no
 * reading axis to maintain, and centring it is what makes it read as an end rather than as an
 * eighth section. `marketing.spec.ts` asserts that nothing else on the page is centred.
 */
export function Close() {
  // `className`, not `innerClassName`: the centring belongs to the SECTION so that
  // `marketing.spec.ts` can assert "exactly one section on this page is centred" by reading
  // `textAlign` off `[data-section]`. On an inner div it is invisible to that rule, which is
  // how the close silently stopped being the page's one centred composition.
  return (
    <Section id="start" tone="deep" labelledBy="close-heading" className="text-center">
      {/* The colour IS passed, and it has to be. `<Heading>`'s base class carries
          `text-mk-ink`, which beats the white the section hands down by inheritance — so
          without this the headline renders near-black on the deep green at about 1.6:1.

          It is also safe to pass now, which it was not an hour ago: `text-mk-heading-xl` was
          missing from `mk-cn.ts`'s font-size group, so twMerge filed it as a colour, saw it
          conflict with this one and dropped the SIZE — the headline came out at the inherited
          18px, smaller than the paragraph under it. That registry gap is fixed, so size and
          colour now survive together. `final-cta.tsx` used to route around it by omitting the
          colour here and relying on inheritance, which is what kept the real cause alive. */}
      <Heading id="close-heading" size="xl" className="text-mk-white">
        {close.headline}
      </Heading>

      {/* `text-mk-white/75` rather than a tone: `<Prose>` has no white level, and both of its
          ink tones are illegal on a ground this dark. 75% of white on the deep green measures
          8.9:1. */}
      <Prose size="lead" className="mx-auto mt-6 max-w-mk-measure-tight text-mk-white/75">
        {close.body}
      </Prose>

      <MkButtonLink href={close.cta.href} variant="white" size="lg" className="mt-10 md:mt-12">
        {close.cta.label}
      </MkButtonLink>
    </Section>
  );
}
