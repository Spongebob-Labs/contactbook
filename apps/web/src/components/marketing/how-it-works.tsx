import { howItWorks } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";
import { MkReveal } from "./mk-reveal";
import { Section } from "./section";
import { accented, HEAD_TO_BODY, Prose, SectionHead } from "./type";

/**
 * Section 4 — how it works. Brief Section 4.
 *
 * ## ⚠ THIS IS THE PAGE'S ONE DELIBERATELY QUIET SECTION
 * It replaces a four-cell bento that held two live card renders, a control that recoloured
 * both, a real scannable QR code and a set of profile rows. That bento was good work and it is
 * deleted, because by the time a reader reaches this point the hero has animated, the problem
 * has struck three fields out, the solution has an exhibit they can press and the cards
 * section is six coloured objects. A fifth dense section does not add interest — it removes
 * the contrast that made the other four feel like something.
 *
 * So: five numbered rows, a hairline between them, a green ordinal, and nothing else. **Resist
 * illustrating it.** If it feels bare in isolation, that is the section working; judge it by
 * scrolling into it from the cards above.
 *
 * ## Five steps, not four
 * The fifth is **control** — expand, restrict or revoke what one person can see. The previous
 * page had four steps and no home for that anywhere, which left the product's whole trust
 * argument to a single prose panel further down.
 */
export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="white" labelledBy="how-it-works-heading">
      <SectionHead
        heading={accented(howItWorks.heading, howItWorks.accent)}
        headingId="how-it-works-heading"
      />

      <ol className={mkcn(HEAD_TO_BODY, "max-w-mk-measure-wide")}>
        {howItWorks.steps.map((step, i) => (
          <MkReveal key={step.ordinal} index={i} move="rise">
            <li className="grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-1 border-t border-mk-hairline-strong py-6 md:gap-x-8 md:py-7">
              {/* The ordinal is the only green on this section, and it is legal here for a
                  reason worth stating: `--mk-green-display` needs 3:1, which is the LARGE-text
                  bar, and `text-mk-heading` is 24–30px. Set this one step smaller and it would
                  have to drop to `--mk-green-ink`. */}
              <span
                aria-hidden="true"
                className="font-mk-display text-mk-heading font-mk-editorial text-mk-green-display tabular-nums"
              >
                {step.ordinal}
              </span>
              <h3 className="font-mk-display text-mk-heading-sm font-mk-editorial text-mk-ink">
                {step.title}
              </h3>
              {/* Empty cell under the ordinal, so the body aligns with the title rather than
                  wrapping beneath the number. */}
              <span aria-hidden="true" />
              <Prose className="max-w-mk-measure">{step.body}</Prose>
            </li>
          </MkReveal>
        ))}
      </ol>
    </Section>
  );
}
