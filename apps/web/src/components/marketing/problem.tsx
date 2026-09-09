import { liveCard, problem } from "@/fixtures/marketing";

import { ContactCard } from "./contact-card";
import { mkcn } from "./mk-cn";
import { MkReveal } from "./mk-reveal";
import { Section } from "./section";
import { accented, HEAD_TO_BODY, Prose, SectionHead } from "./type";

/**
 * Section 2 — the problem. Brief Section 2.
 *
 * ## The visual is the client's own best asset
 * Deck page 13: a native phone contact with three fields flagged wrong, beside the same
 * person's live card. It is the most persuasive thing in either document the client sent,
 * because it is not a claim — it is a picture of the reader's own phone.
 *
 * ## ⚠ THE LEFT PANEL DELIBERATELY DOES NOT USE OUR CARD COMPONENTS
 * It is a plain white sheet with a hairline, built here, and that is the entire point: it has
 * to read as *not ours*. Rendering it with `<ContactCard>` in a different palette would say
 * "here are two Contact Book cards, one of which is wrong", which is the opposite of the
 * argument. So the two panels share no code, and the visual difference between them is
 * carrying half the meaning.
 *
 * ## ⚠ AND THE RIGHT PANEL'S ROWS ARE READ FROM THE HERO'S LAST BEAT
 * `liveCard.beats.at(-1)` — not a second copy of the same four values. The hero loop ends on
 * the repaired card, so this section is literally the before and after of the story a reader
 * just watched, and the two can never drift apart. Retyping the corrected email here would be
 * two sources of truth for one fact, one edit apart from disagreeing.
 */

/** The corrected card, straight off the end of the hero's loop. */
const SETTLED = liveCard.beats.at(-1)!;

/**
 * ⚠ THE NAME AND INITIALS ARE READ FROM `liveCard`, NOT TYPED HERE.
 * Both panels and the hero's two faces are one person, and the hero's front face takes its
 * identity from a resolved `ContactCard`. A literal here was a fourth place the name lived, and
 * it had already drifted once — the page shipped a section headed "the same person" showing two
 * different people.
 */
const INITIALS = liveCard.name
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part[0]!)
  .slice(0, 2)
  .join("")
  .toUpperCase();

export function Problem() {
  return (
    <Section id="problem" tone="wash" labelledBy="problem-heading">
      <SectionHead
        heading={accented(problem.heading, problem.accent)}
        headingId="problem-heading"
        lead={problem.paragraphs[0]}
      />

      <Prose className="mt-5 max-w-mk-measure">{problem.paragraphs[1]}</Prose>

      <div className={mkcn(HEAD_TO_BODY, "grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10")}>
        {/* ── before ─────────────────────────────────────────────────────────────────── */}
        <MkReveal index={0} move="rise">
          <figure className="m-0">
            <figcaption className="text-mk-caption font-mk-medium text-mk-pebble uppercase tracking-[0.1em]">
              {problem.beforeLabel}
            </figcaption>

            <div className="mt-3 rounded-mk-block bg-mk-white p-6 ring-1 ring-mk-hairline-strong">
              <div className="flex items-center gap-3">
                {/* A grey monogram, not our mint one — this panel is somebody else's software.

                    ⚠ THE INITIALS ARE INK, NOT STONE. `--mk-stone` on `--mk-hairline` measures
                    3.80:1 at 14px, against a 4.5 requirement, and the page's contrast sweep
                    named it. `aria-hidden` does not exempt it: hidden from a screen reader is
                    still visible to an eye, so the bar applies exactly as it would to copy. */}
                <span
                  aria-hidden="true"
                  className="flex size-12 items-center justify-center rounded-mk-pill bg-mk-hairline font-mk-display text-mk-body-sm font-mk-editorial text-mk-ink"
                >
                  {INITIALS}
                </span>
                <span className="font-mk-display text-mk-heading-sm font-mk-editorial text-mk-ink">
                  {liveCard.name}
                </span>
              </div>

              <dl className="mt-5">
                {problem.beforeRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-baseline justify-between gap-4 border-t border-mk-hairline py-3"
                  >
                    <div className="min-w-0">
                      <dt className="text-mk-caption text-mk-pebble">{row.label}</dt>
                      <dd
                        className={mkcn(
                          "mt-0.5 truncate text-mk-body-sm",
                          // Struck and dimmed, never hidden: recognising your own out-of-date
                          // entry is the whole job of this panel, so it has to stay readable.
                          row.stale ? "text-mk-stone line-through" : "text-mk-ink",
                        )}
                      >
                        {row.value}
                      </dd>
                    </div>
                    {row.stale ? (
                      <span className="shrink-0 rounded-mk-chrome bg-mk-oxblood/10 px-2 py-1 text-mk-caption font-mk-medium text-mk-oxblood">
                        {problem.staleTag}
                      </span>
                    ) : null}
                  </div>
                ))}
              </dl>
            </div>
          </figure>
        </MkReveal>

        {/* ── after ──────────────────────────────────────────────────────────────────── */}
        <MkReveal index={1} move="rise">
          <figure className="m-0">
            <figcaption className="text-mk-caption font-mk-medium text-mk-green-ink uppercase tracking-[0.1em]">
              {problem.afterLabel}
            </figcaption>
            <div className="mt-3 flex justify-center lg:justify-start">
              <ContactCard
                aria-hidden="true"
                name={liveCard.name}
                role={liveCard.role}
                mark={liveCard.mark}
                rows={SETTLED.rows}
              />
            </div>
          </figure>
        </MkReveal>
      </div>

      <Prose size="small" className="mt-8 max-w-mk-measure-tight">
        {problem.caption}
      </Prose>
    </Section>
  );
}
