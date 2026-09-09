import { corporate } from "@/fixtures/marketing";

import { Heading, MkButtonLink, Prose } from "./type";
import { Section } from "./section";

/**
 * Section 6 — the corporate teaser. Brief Section 8.
 *
 * ## ⚠ IT IS FOUR SENTENCES, AND THAT IS THE BRIEF
 * The client's voice note: *"a small section on corporate contact book, but there's hardly
 * anything in there at the moment. It's just to say we have a corporate contact book solution.
 * Get in touch to hear more about it."* Everything with substance is on `/corporate`. Resist
 * growing this — a homepage section that explains a second product in full is a homepage that
 * has stopped being about the first one.
 *
 * ## Why it is the second dark surface
 * It addresses a different reader than every section around it, and on a page whose only
 * separator is a change of ground, that is the one way to say so. `belief` sits between this
 * and the close on the wash, so the two dark bands never touch and the alternation holds.
 *
 * `<Section tone="deep">` hands white text down; the control is the `white` variant for the
 * same reason as the close — a green button on a green ground is a button you have to look for.
 */
export function Corporate() {
  return (
    <Section id="corporate" tone="deep" labelledBy="corporate-heading">
      <div className="max-w-mk-measure-wide">
        {/* `accented()` is not used here: `--mk-green-display` is derived against WHITE and the
            wash, and it is not legible on the deep green — the accent has no level on a dark
            ground. The heading is white throughout, which is why this section carries no
            `data-accent` and the accent guard expects none from it. */}
        <Heading id="corporate-heading" size="lg" className="text-mk-white">
          {corporate.heading}
        </Heading>

        <div className="mt-8 space-y-4">
          {corporate.teaser.map((paragraph) => (
            <Prose key={paragraph} className="max-w-mk-measure text-mk-white/90">
              {paragraph}
            </Prose>
          ))}
        </div>

        {/* ⚠ `/80`, NOT `/70`. White at 70% on this ground measures 4.40:1 against a 4.5
            requirement — the page's contrast sweep named this exact line. 80% is 5.20:1. The
            two levels above it are `/80` for the paragraphs and full white for the heading, so
            the hierarchy still has three steps; it just starts one notch brighter. */}
        <Prose size="small" className="mt-6 max-w-mk-measure text-mk-white/80">
          {corporate.teaserTargets}
        </Prose>

        <MkButtonLink
          href={corporate.teaserCta.href}
          variant="white"
          size="lg"
          className="mt-10"
        >
          {corporate.teaserCta.label}
        </MkButtonLink>
      </div>
    </Section>
  );
}
