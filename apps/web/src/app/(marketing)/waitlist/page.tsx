import type { Metadata } from "next";

import { LeadForm } from "@/components/marketing/lead-form";
import { CONTENT_COLUMN } from "@/components/marketing/section";
import { accented, Display, Prose } from "@/components/marketing/type";
import { waitlistPage } from "@/fixtures/marketing";
import { contactDetails } from "@/lib/site";

export const metadata: Metadata = {
  title: "Join the waitlist",
  description:
    "Contact Book is opening to a first group of users. Leave your details and we will be in touch when it is your turn.",
};

/**
 * `/waitlist` — the only page on the site that captures anything, which makes it the most
 * important of the three.
 *
 * ## Not a `<Section>`
 * `<Section>` exists to be one band in an alternating scroll; this page is a single screen with
 * one job. It borrows the content column and the type, and owns its own spacing.
 *
 * ## Where a submission goes
 * `LEAD_WEBHOOK_URL`. See `src/lib/leads.ts` — the destination is configuration, and with none
 * set the form shows an email fallback rather than a tick it has not earned.
 */
export default function WaitlistPage() {
  return (
    <div className="bg-mk-wash">
      <div className={`${CONTENT_COLUMN} py-20 md:py-28`}>
        <Display className="max-w-mk-measure-head">
          {accented(waitlistPage.heading, waitlistPage.accent)}
        </Display>
        <Prose size="lead" className="mt-6 max-w-mk-measure">
          {waitlistPage.lead}
        </Prose>

        <div className="mt-12 md:mt-14">
          <LeadForm
            kind="waitlist"
            fields={[
              { name: "name", label: "Your name", autoComplete: "name" },
              { name: "email", label: "Email", type: "email", autoComplete: "email" },
              { name: "phone", label: "Phone", type: "tel", optional: true, autoComplete: "tel" },
            ]}
            audienceQuestion={{
              legend: "Is this for you, or for an organisation?",
              individual: "For me",
              company: "For my company",
            }}
            submitLabel={waitlistPage.submitLabel}
            successHeading={waitlistPage.successHeading}
            successBody={waitlistPage.successBody}
            fallbackBody={waitlistPage.fallbackBody}
            fallbackEmail={contactDetails.email}
            privacyNote={waitlistPage.privacyNote}
          />
        </div>
      </div>
    </div>
  );
}
