import type { Metadata } from "next";

import { CONTENT_COLUMN } from "@/components/marketing/section";
import { accented, Display, Heading, MkButtonLink, Prose } from "@/components/marketing/type";
import { corporate } from "@/fixtures/marketing";

export const metadata: Metadata = {
  title: "Corporate Contact Book",
  description:
    "Approved corporate cards, employees onboarded onto them, and the relationship data kept centrally. Revoke access when someone leaves and keep the contacts.",
};

/**
 * `/corporate` — Corporate Contact Book.
 *
 * The only page with real depth, because the 2018 deck actually has corporate material worth
 * using: the market evidence, the benefits and the target list are all its own.
 *
 * ## ⚠ EVERY STATISTIC CARRIES ITS SOURCE AND ITS YEAR, IN THE SENTENCE
 * They are from 2013–2015. A decade-old figure printed bare reads as a current one, which would
 * be misleading rather than persuasive — and the honest framing is actually the stronger one:
 * these show the problem is structural, not seasonal. The lead paragraph says so before the
 * numbers arrive. Ask the client for anything newer; until then they are sound as dated
 * evidence and must not be laundered into undated claims.
 *
 * ## ⚠ NO PRICING, AND THE DECK'S MODEL STAYS OUT
 * The deck describes a per-user fee plus installation and maintenance. That is a commercial
 * decision the client has not published, and every figure on the old homepage was invented,
 * which is why the page has none. "Sold per user and set up with you" is as specific as this
 * page goes, and the next step is a conversation.
 */
export default function CorporatePage() {
  return (
    <div>
      {/* ── the offer ─────────────────────────────────────────────────────────────────── */}
      <section className="bg-mk-wash">
        <div className={`${CONTENT_COLUMN} py-20 md:py-28`}>
          <Display className="max-w-mk-measure-display">
            {accented(corporate.heading, corporate.accent)}
          </Display>
          <Prose size="lead" className="mt-8 max-w-mk-measure">
            {corporate.pageLead}
          </Prose>
        </div>
      </section>

      {/* ── the evidence ──────────────────────────────────────────────────────────────── */}
      <section className="bg-mk-white">
        <div className={`${CONTENT_COLUMN} py-20 md:py-28`}>
          <Heading size="lg" className="max-w-mk-measure-head">
            {corporate.problemHeading}
          </Heading>
          <Prose className="mt-6 max-w-mk-measure">{corporate.problemLead}</Prose>

          <dl className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
            {corporate.stats.map((stat) => (
              <div key={stat.figure} className="border-t-2 border-mk-green-display pt-5">
                <dt className="font-mk-display text-mk-heading-lg font-mk-editorial text-mk-ink tabular-nums">
                  {stat.figure}
                </dt>
                <dd className="mt-2 text-mk-body text-mk-ink">{stat.claim}</dd>
                {/* The source is part of the claim, not a footnote — see the header. */}
                <dd className="mt-3 text-mk-caption text-mk-stone">{stat.source}</dd>
              </div>
            ))}
          </dl>

          <Prose className="mt-12 max-w-mk-measure border-l-2 border-mk-hairline-strong pl-6">
            {corporate.gartner}
          </Prose>
        </div>
      </section>

      {/* ── what a company gets ───────────────────────────────────────────────────────── */}
      <section className="bg-mk-wash">
        <div className={`${CONTENT_COLUMN} py-20 md:py-28`}>
          <Heading size="lg" className="max-w-mk-measure-head">
            {corporate.benefitsHeading}
          </Heading>

          <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
            {corporate.benefits.map((benefit) => (
              <div key={benefit.title} className="border-t border-mk-hairline-strong pt-5">
                <h3 className="font-mk-display text-mk-heading-sm font-mk-editorial text-mk-ink">
                  {benefit.title}
                </h3>
                <Prose className="mt-3">{benefit.body}</Prose>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── who it is for ─────────────────────────────────────────────────────────────── */}
      <section className="bg-mk-white">
        <div className={`${CONTENT_COLUMN} py-20 md:py-28`}>
          <Heading size="lg" className="max-w-mk-measure-head">
            {corporate.marketsHeading}
          </Heading>
          <ul className="mt-10 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
            {corporate.markets.map((market) => (
              <li
                key={market}
                className="border-t border-mk-hairline py-3 text-mk-body text-mk-ink"
              >
                {market}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── the close ─────────────────────────────────────────────────────────────────── */}
      <section className="bg-mk-green-deep text-mk-white">
        <div className={`${CONTENT_COLUMN} py-20 text-center md:py-28`}>
          <Heading size="xl" className="text-mk-white">
            {corporate.closeHeading}
          </Heading>
          <Prose size="lead" className="mx-auto mt-6 max-w-mk-measure-tight text-mk-white/75">
            {corporate.closeBody}
          </Prose>
          <MkButtonLink
            href={corporate.closeCta.href}
            variant="white"
            size="lg"
            className="mt-10 md:mt-12"
          >
            {corporate.closeCta.label}
          </MkButtonLink>
        </div>
      </section>
    </div>
  );
}
