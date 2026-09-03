import { hero } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";
import { Arrival } from "./mk-motion";
import { CONTENT_COLUMN, Section } from "./section";
import { Display, MkButtonLink, Prose } from "./type";

/**
 * The hero — a sheet of ruled paper, a margin rule, and the entry written on it.
 *
 * ## ⚠ THE SKY AND THE FILM ARE GONE, AT THE CLIENT'S WORD, AND NEITHER IS COMING BACK QUIETER
 *
 * *"The blue colour and the video being rendered there are both looking the worst of all, so I
 * want you to just remove both of them… It should be text, and behind that, you have to think
 * about what you could add better than this."*
 *
 * Both objects are deleted rather than softened, because the instruction named both. What is
 * worth recording is the pattern the deletion sits in, since it is now three heroes deep:
 *
 *   1. azure → cyan gradient, centred type — *"looking very childish."*
 *   2. Sapphire → Onyx gradient, centred type, a tilted card — *"looking very big."*
 *   3. Sapphire → Onyx gradient, centred type, a film — *"the worst of all."*
 *
 * Every rejection was read as a colour note and answered with a new gradient, which is why the
 * note arrived three times. **The ground was never the defect.** A full-bleed coloured rectangle
 * with centred type is the shape every generated landing page ships; no hue rescues it, and the
 * fourth gradient would have been rejected too. What the reader was actually looking at was
 * seven hundred vertical pixels of surface doing no work, and a 68ch subhead centred under a
 * centred headline, which gives the eye no axis to return to at the start of each line.
 *
 * ## What replaces it, and why this metaphor rather than a nicer gradient
 *
 * The page already argues this two sections down, in `problem`: *"A paper contact book worked
 * because somebody maintained it. You crossed out an address and wrote the new one above it,
 * and the book stayed true because you tended it."*
 *
 * That is the product's thesis, and the hero was illustrating **weather**. It is now the thing
 * the page is about: a sheet of ruled paper, a margin rule down the left, and the headline
 * written on it as the first entry. Four properties earn it over another gradient —
 *
 *   · it is *structure*, not a colour field, which is the actual complaint;
 *   · it sets the argument up instead of contradicting it;
 *   · it costs no bytes — one repeating gradient, no image, no video, no library — so the
 *     page's LCP candidate stops being a 220KB video poster and becomes text;
 *   · it is the product's own object, so the hero is not borrowing an aesthetic from anywhere.
 *
 * ## ⚠ THE RULED GROUND CARRIES ONE INK LEVEL. `--mk-stone` IS ILLEGAL IN THIS SECTION.
 *
 * The same rule the four washes already follow, reached the same way — by measuring. There is
 * no rule density at which the ruling is visible AND stone clears 4.5:1:
 *
 *     rule @ 3%   ground #eeeeef   stone 4.28:1   FAIL
 *     rule @ 4%   ground #ececec   stone 4.20:1   FAIL
 *     rule @ 7%   ground #e6e6e6   stone 3.98:1   FAIL   ← shipped
 *     rule @ 8%   ground #e3e3e4   stone 3.87:1   FAIL
 *
 * So every level of copy here is `--mk-ink` at full strength — 13.95:1 over a rule, 15.97:1
 * between them — and the hierarchy is carried by size and weight alone. That is better
 * typography than a greyed sub anyway; a secondary tone is a habit, not a decision.
 *
 * ## The other contrast consequence: Amber cannot be the CTA on this ground
 *
 * `amber` measures **1.92:1 on paper** and has no findable boundary there, which is a WCAG
 * 1.4.11 failure rather than an ugly one — the control stops being locatable before its label
 * is read. DESIGN.md already states the rule and the substitution: *"a light pass wanting a
 * primary action uses `dark`."* So the primary is Onyx, 15.97:1 against the sheet, and it is
 * the only saturated mass on the hero — which is what makes it the focal point rather than one
 * of two competing pills. The secondary is the new `line` variant, a ring at ink/55 measuring
 * 3.81:1 on bare paper and 3.31:1 where it crosses a rule — the worst case, still clear.
 * `glass` needs a dark backdrop to be a surface at all, and went with the sky.
 *
 * ## Left-aligned, and that is the "channelled" part of the brief
 *
 * Centred type has no reading axis: every line starts somewhere different, so the eye hunts for
 * the next line's beginning. Ranged left against the margin rule there is one vertical edge and
 * the whole block — headline, lead, actions, caveat — hangs off it in reading order. The margin
 * rule is not decoration; it is that axis, drawn.
 *
 * ## One authored moment, and it moved rather than being deleted
 *
 * DESIGN.md allows the page exactly one and forbids scroll reveals outright. It was the film.
 * With the film gone the hero would have had no motion at all, so the moment is now the margin
 * rule drawing down on load, with the copy arriving against it in the existing 70ms sequence —
 * the page gets ruled, then written on. One sentence, one moment, and it is the same sentence
 * the ground is making rather than a second effect bolted beside it. Both halves are CSS
 * keyframes on transform only; see `marketing.css` for why that is the only version that
 * survives the harness, a failed script and `prefers-reduced-motion`.
 */

/**
 * The headline set as its two clauses, one per line.
 *
 * ⚠ This is a TYPOGRAPHIC decision on existing copy, not a copy change: the fixture still holds
 * one string, the accessible name is still that whole string, and `hero.headline` is what SEO
 * and the tests read. Splitting on the sentence boundary at render time is what turns a
 * four-line rag into two deliberate lines that each occupy exactly one rule of the ledger.
 *
 * The lookbehind keeps the full stop on the line it belongs to. A `split(". ")` would eat it.
 */
const HEADLINE_LINES = hero.headline.split(/(?<=\.)\s+/);

export function Hero() {
  return (
    <Section
      id="hero"
      bare
      tone="paper"
      labelledBy="hero-headline"
      className="overflow-hidden bg-mk-paper"
    >
      {/* The ruling, and only the ruling. The paper is on the section above it so the mask can
          fade the rules out at both ends without taking the ground with them — masked together,
          the sheet would dissolve into whatever is behind the page. `aria-hidden` because a
          screen reader announcing the stationery before the headline is noise. */}
      {/* `inset-y-0 right-0` and a LEFT that `.mk-ledger` computes for itself — the ruling
          begins at the margin rule, not at the viewport edge. See `--mk-ledger-gutter`. */}
      <div aria-hidden="true" data-hero-ledger="" className="mk-ledger absolute inset-y-0 right-0" />

      <div className={mkcn(CONTENT_COLUMN, "relative pt-[var(--mk-ledger-lead)] pb-20 md:pb-28")}>
        {/*
          The copy block, and the margin rule is positioned against THIS box rather than the
          viewport — so the rule keeps a real margin from the text at 360 instead of sliding
          under the phone's edge, and it ends where the entry ends instead of running the full
          height of a section whose height it knows nothing about.
        */}
        <div className="relative">
          <span
            aria-hidden="true"
            data-hero-margin-rule=""
            className="mk-ledger-margin absolute top-0 h-full w-px"
            style={{ left: "calc(-1 * var(--mk-ledger-gutter))" }}
          />


          {/*
            ⚠ EVERY MEASURE STAYS ON THE TYPE ELEMENT, NEVER ON THE `<Arrival>` AROUND IT.

            The measures are in `ch`, and `ch` resolves against the font-size of the element the
            rule lands on. Moved up one level onto a wrapper, `max-w-mk-measure-display` stops
            being 24 characters of a 72px headline and becomes 24 characters of inherited 16px
            body copy — which renders the hero headline one word per line, with the correct class
            in the markup and the correct value in the stylesheet. It is the same failure mode
            `mk-cn.ts` exists to prevent, arriving by a different road, and it cost a build.

            So `<Arrival>` carries spacing and layout only. Nothing typographic.
          */}
          {/*
            ⚠ THE CLIP LIVES ON EACH CLAUSE, NOT ON A WRAPPER AROUND THE HEADING.

            The headline is staged per line, which is the whole reason to use a wipe rather than
            a block fade — two clauses appearing one after the other reads as writing, and one
            clipped `<h1>` reads as a curtain. `<Arrival as="span">` exists for this: a `<div>`
            inside an `<h1>` is invalid HTML, and hand-rolling the data attribute here would put
            a motion decision in a section file instead of in the vocabulary.
          */}
          <Display id="hero-headline" data-hero-headline="" className="max-w-mk-measure-display">
            {HEADLINE_LINES.map((line, i) => (
              <Arrival key={line} as="span" variant="line" index={i} className="block">
                {line}
              </Arrival>
            ))}
          </Display>

          {/*
            One offset for the whole block below the headline, inherited. `display: contents`
            so the wrapper generates no box and every margin below still resolves against the
            copy column exactly as it did.

            420ms is measured, not picked: clause two starts at 140ms and its 1100ms wipe is
            visibly complete well before it ends, so the lead begins while the headline is still
            settling rather than after it has stopped. A sequence that waits for each step to
            finish reads as a slideshow.
          */}
          <div style={{ display: "contents", ["--mk-arrive-offset" as string]: "420ms" }}>
            <Arrival index={0} className="mt-6 md:mt-8">
              {/* `tone="ink"` is not a default here, it is the constraint from the module header:
                  stone fails on every ruled ground. Full strength, sized down instead. */}
              <Prose size="lead" tone="ink" className="max-w-mk-measure">
                {hero.subhead}
              </Prose>
            </Arrival>

            <Arrival index={1} className="mt-9 flex flex-wrap items-center gap-3 md:mt-12 md:gap-4">
              <MkButtonLink href={hero.primary.href} variant="dark" size="lg" data-hero-cta="">
                {hero.primary.label}
              </MkButtonLink>
              <MkButtonLink href={hero.secondary.href} variant="line" size="lg">
                {hero.secondary.label}
              </MkButtonLink>
            </Arrival>

            {/* Tighter to the controls than the controls are to the lead — it is a footnote ON
                the buttons ("no app for the person you hand it to"), not a fourth statement. The
                gap sizes the grouping: 48px above the controls, 20px below them. */}
            <Arrival index={2} className="mt-5 md:mt-5">
              <Prose size="small" tone="ink" className="max-w-mk-measure-tight">
                {hero.aside}
              </Prose>
            </Arrival>
          </div>
        </div>
      </div>
    </Section>
  );
}
