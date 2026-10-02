import { ArrowRight } from "lucide-react";

import { close } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";
import { Section } from "./section";
import { Heading, MkButtonLink, Prose } from "./type";

/**
 * Section 5 — the close.
 *
 * ## 2026-09-28 — the waitlist form is gone, and the close is one button again
 * The client: *"Still showing old version: 'join the waitlist' copy … need removing."* The
 * inline capture that lived here (a name-and-email `<LeadForm>` on its own white surface, plus a
 * "Join the waitlist" link under it) went with that. The product is open, so there is no list to
 * join: the close sends a reader to the same front door as the hero and the nav, phone sign-in
 * (`close.cta`). `lead-form.tsx` and `/waitlist` are untouched and still work; nothing on the
 * homepage points at them.
 *
 * ## The one dark ground, and the one light control on it
 * The section keeps `tone="deep"` and its headline. `white` is the button treatment `type.tsx`
 * defines for a dark ground — white fill, ink label — so the control is the brightest thing in
 * the band without needing a colour of its own. The trailing arrow matches the hero's primary,
 * so the two read as the same action; it is `aria-hidden` because the label already says what a
 * press does.
 */
export function Close() {
  return (
    <Section id="start" tone="deep" labelledBy="close-heading" className="text-center">
      {/* The colour IS passed, and it has to be: `<Heading>`'s base class carries `text-mk-ink`,
          which beats the white the section hands down by inheritance. */}
      <Heading id="close-heading" size="xl" className="text-mk-white">
        {close.headline}
      </Heading>

      {/* `--mk-accent-on-deep` — the softer ink this exact ground was given a token for. See
          `marketing-steps.css` for why that is a class (`.mk-close-soft`) and not an
          arbitrary-value utility stacked next to `<Prose>`'s own `text-mk-stone`. */}
      <Prose size="lead" className={mkcn("mx-auto mt-6 max-w-mk-measure-tight", "mk-close-soft")}>
        {close.body}
      </Prose>

      <div className="mt-10 flex justify-center md:mt-12">
        <MkButtonLink
          href={close.cta.href}
          variant="white"
          size="lg"
          data-close-cta=""
          className="gap-2"
        >
          {close.cta.label}
          <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
        </MkButtonLink>
      </div>
    </Section>
  );
}
