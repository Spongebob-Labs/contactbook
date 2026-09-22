import Link from "next/link";

import { close, waitlistPage } from "@/fixtures/marketing";
import { contactDetails } from "@/lib/site";

import { LeadForm } from "./lead-form";
import { mkcn } from "./mk-cn";
import { Section } from "./section";
import { Heading, Prose } from "./type";

/**
 * Section 5 — the close.
 *
 * ## From one button to an inline capture
 * The close used to be a headline and a single link out to `/waitlist`. It is the emptiest
 * surface on the page and, with `belief` cut (2026-09-19), it now also has to carry the ending —
 * so the capture moves onto the page itself rather than staying one click away. `close.cta`
 * survives underneath as the plain-text path to the full page, for anyone who would rather not
 * fill in a field here.
 *
 * ## Reusing `lead-form.tsx`, and the one thing it cannot do unwrapped
 * `<LeadForm>` already owns the real pipeline — `POST /api/leads`, the 422/503 split, the email
 * fallback instead of a fake tick — and none of that is duplicated here. But it is written for a
 * LIGHT ground: its labels are `text-mk-ink` and its submit button is `bg-mk-ink text-mk-white`,
 * both illegal or invisible on `--mk-accent-deep` for the same reason `<Heading>` needed an
 * explicit `text-mk-white` a few lines below — Onyx ink on a dark ground measures under 2:1. The
 * form is not modified; it is set inside its own white surface instead, which is what makes
 * every one of its built-in states (idle, done, the failed/fallback box) correct again with no
 * edit to that file.
 *
 * ## Why the form asks for a name it does not need to show
 * An email-only capture cannot be validated through the existing pipeline: `parseLead`
 * (`src/lib/leads.ts`) requires `name` unconditionally, and that file is not mine to loosen for
 * one call site. Two fields — name, email — is still far lighter than `/waitlist`'s three plus
 * an audience question, and it is the smallest field set that a real submission can pass without
 * duplicating that route's validation here.
 *
 * ## Copy: borrowed, not invented
 * `submitLabel`/`successHeading`/`successBody`/`fallbackBody`/`privacyNote` all come from
 * `waitlistPage` — the same action, said once, rather than a second set of sentences for what is
 * still literally "join the waitlist". The one visible side effect: `close.cta`'s label and the
 * form's own submit button both read "Join the waitlist", because that is the fixture's actual
 * copy for both destinations and this file does not add words that are not there.
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

      <div className="mx-auto mt-10 max-w-sm rounded-mk-block bg-mk-white p-6 text-left md:mt-12 md:p-8">
        <LeadForm
          kind="waitlist"
          fields={[
            { name: "name", label: "Name", autoComplete: "name" },
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
          ]}
          submitLabel={waitlistPage.submitLabel}
          successHeading={waitlistPage.successHeading}
          successBody={waitlistPage.successBody}
          fallbackBody={waitlistPage.fallbackBody}
          fallbackEmail={contactDetails.email}
          privacyNote={waitlistPage.privacyNote}
        />
      </div>

      {/* The brief's second control, kept — `close.cta` unchanged, now secondary to the form
          above rather than the section's only action. Still exactly one link in this section at
          rest: the form's own control is a `<button>`, and its mailto fallback only renders
          after a failed submit. */}
      <p className="mt-8 text-mk-body-sm">
        <Link
          href={close.cta.href}
          className={mkcn(
            "font-mk-sans font-mk-medium underline decoration-1 underline-offset-2",
            "transition-colors duration-[var(--mk-dur-tap)]",
            "mk-close-link",
          )}
        >
          {close.cta.label}
        </Link>
      </p>
    </Section>
  );
}
