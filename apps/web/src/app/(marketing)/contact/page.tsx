import type { Metadata } from "next";

import { LeadForm } from "@/components/marketing/lead-form";
import { CONTENT_COLUMN } from "@/components/marketing/section";
import { accented, Display, Prose } from "@/components/marketing/type";
import { contactPage } from "@/fixtures/marketing";
import { contactDetails } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Questions about Contact Book, or about Corporate Contact Book for your organisation.",
};

/**
 * `/contact` — the form, and the real address beside it.
 *
 * ⚠ THE ADDRESS IS SEVEN YEARS OLD AND MUST BE CONFIRMED BEFORE LAUNCH. It comes from the last
 * page of the 2018 deck and lives in `contactDetails` in the fixture, referenced here and in
 * both forms' fallbacks — so confirming it is one edit rather than four.
 *
 * The address is shown as well as the form on purpose: somebody who does not trust a form, or
 * who wants to attach something, should not have to guess. It is also the fallback the form
 * itself offers when there is no destination configured, so printing it here costs nothing.
 */
export default function ContactPage() {
  return (
    <div className="bg-mk-wash">
      <div className={`${CONTENT_COLUMN} py-20 md:py-28`}>
        <Display className="max-w-mk-measure-head">
          {accented(contactPage.heading, contactPage.accent)}
        </Display>
        <Prose size="lead" className="mt-6 max-w-mk-measure">
          {contactPage.lead}
        </Prose>

        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10 md:mt-14">
          <div className="lg:col-span-7">
            <LeadForm
              kind="enquiry"
              fields={[
                { name: "name", label: "Your name", autoComplete: "name" },
                { name: "email", label: "Email", type: "email", autoComplete: "email" },
                {
                  name: "company",
                  label: "Company",
                  optional: true,
                  autoComplete: "organization",
                },
                { name: "message", label: "Message", type: "textarea" },
              ]}
              submitLabel={contactPage.submitLabel}
              successHeading={contactPage.successHeading}
              successBody={contactPage.successBody}
              fallbackBody={contactPage.fallbackBody}
              fallbackEmail={contactDetails.email}
              privacyNote={contactPage.privacyNote}
            />
          </div>

          <aside className="lg:col-span-5">
            <p className="text-mk-caption font-mk-medium text-mk-pebble uppercase tracking-[0.1em]">
              Or reach us directly
            </p>
            <dl className="mt-4">
              <div className="border-t border-mk-hairline py-3">
                <dt className="text-mk-caption text-mk-pebble">Email</dt>
                <dd className="mt-0.5">
                  <a
                    href={`mailto:${contactDetails.email}`}
                    className="text-mk-body font-mk-medium text-mk-green-ink underline decoration-1 underline-offset-2"
                  >
                    {contactDetails.email}
                  </a>
                </dd>
              </div>
              <div className="border-t border-mk-hairline py-3">
                <dt className="text-mk-caption text-mk-pebble">Web</dt>
                <dd className="mt-0.5 text-mk-body text-mk-ink">{contactDetails.site}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </div>
  );
}
