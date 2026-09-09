import { resolveCard } from "@/card/resolve-card";
import { ShareFace } from "@/card/share-face";
import { FIXTURE_DB } from "@/fixtures";
import { hero, heroCard, liveCard, marketingUser } from "@/fixtures/marketing";

import { HeroCard } from "./hero-card";
import { mkcn } from "./mk-cn";
import { Arrival } from "./mk-motion";
import { CONTENT_COLUMN, Section } from "./section";
import { Display, MkButtonLink, Prose } from "./type";

/**
 * The first viewport.
 *
 * ## ⚠ THE RULED SHEET IS GONE, AND SO IS "THE HERO IS TYPE-ONLY"
 *
 * This hero was, in order: a coloured gradient with centred type, a gradient with a big tilted
 * card, a gradient with a silent film, a sheet of ruled contact-book paper with a fan of three
 * real cards, and then that same sheet with nothing on it at all. Four objects were rejected
 * and the rule written afterwards was "the hero is type-only; do not put an object on that
 * sheet."
 *
 * It now carries an animated card, on the client's own brief — *"the opening page I'm
 * picturing is very clean and clear, with a little bit of text (large text) explaining what
 * this is, and then a visual of contact cards being updated"* — and with sign-off. The reason
 * this is a different proposition rather than a fifth attempt at the same mistake: the four
 * rejected objects were **pictures of a card**, placed in the empty half of the screen to fill
 * it. `<LiveCard>` is the product's single claim, performed. A stranger who reads nothing has
 * still watched a contact card go out of date and repair itself, which is the sentence beside
 * it.
 *
 * The ruling went with it. Two reasons, and the second is the real one: the brief asks for
 * white space, calm and minimal in three separate places — and a texture underneath a moving
 * object is two things competing for the same attention. `--mk-ledger-*` is retained in
 * `marketing.css` and nothing renders it; `--mk-ledger-lead` is still this file's top padding,
 * which is why the token could not simply be deleted.
 *
 * ## The composition
 * Type ranged left against the column, card to the right, and the headline is DELIBERATELY
 * narrow — the two clauses stack, which is what gives the eye an axis to return to. Below
 * `lg` the card drops under the copy rather than shrinking beside it: a 360px card next to a
 * headline in a 400px column is two things fighting, and the card is the one that loses
 * legibility.
 *
 * ## Motion here is all LOAD, never scroll
 * Nobody scrolls to the first thing they see, and DESIGN.md forbids arming above-the-fold
 * content — a reader would watch the hero jump on every load, and a stuck observer would
 * present as "the top of the page is broken". So: `line` wipes the two clauses on, `copy`
 * raises the block under them, and the card is simply present from the first frame and starts
 * its own loop after mount. Nothing in this section waits for an IntersectionObserver.
 */

/**
 * ⚠ THE CLAUSES ARE EXPLICIT, NOT SPLIT ON PUNCTUATION.
 *
 * This was `hero.headline.split(/(?<=\.)\s+/)`, which worked only because the old headline was
 * two sentences ("Hand over one card. Keep it true for years."). The client's locked line is
 * one — "Never lose contact." — so the same expression yields a single clause, the staged wipe
 * collapses into one block fade, and the headline loses the axis that the whole composition is
 * built on. The break is a typographic decision about this line and belongs in the file that
 * sets it.
 */
const HEADLINE_LINES = [
  { text: "Never lose", accent: false },
  /**
   * ⚠ THE ACCENT IS THE BRAND, AND IT IS LEGAL AT THIS SIZE ONLY.
   *
   * Every headline on the client's deck sets one word in the brand green — "How it *Works*",
   * "This Week's Example: *Charlie Moretti*" — and it is the single thing that makes a white
   * page read as ContactBook instead of as any white page.
   *
   * The green used is `--mk-green-display` (#43A491), which measures 3.01:1 on white. That
   * clears the large-text bar of 3:1 and NOTHING ELSE: this word is 88px at the top of the
   * clamp and 44px at the bottom, both comfortably "large". The brand value itself (#5ABCA9)
   * is 2.28:1 and may never be a word at any size. Do not copy this pattern down to a
   * paragraph or a label — `--mk-green-ink` is the level for those.
   */
  { text: "contact.", accent: true },
] as const;

export function Hero() {
  /* One resolve per render, on the server. The pass and the card behind it cannot disagree
     about whose card this is, because there is one `ResolvedCard`. */
  const resolvedHeroCard = resolveCard(
    heroCard,
    marketingUser,
    FIXTURE_DB.groups,
    FIXTURE_DB.fields,
  );

  return (
    <Section id="hero" bare tone="white" labelledBy="hero-headline" className="bg-mk-white">
      <div
        className={mkcn(
          CONTENT_COLUMN,
          "relative pt-[var(--mk-ledger-lead)] pb-20 md:pb-28",
          // The card's column is only created at `lg`. `items-center` rather than `start`:
          // the card is a tall object and the type block is short, and aligning their tops
          // leaves the card hanging into the section below it.
          "grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-10",
        )}
      >
        <div className="lg:col-span-7">
          {/*
            ⚠ EVERY MEASURE STAYS ON THE TYPE ELEMENT, NEVER ON THE `<Arrival>` AROUND IT.

            The measures are in `ch`, and `ch` resolves against the font-size of the element the
            rule lands on. Moved up one level onto a wrapper, `max-w-mk-measure-display` stops
            being 24 characters of an 88px headline and becomes 24 characters of inherited 16px
            body copy — which renders the headline one word per line, with the correct class in
            the markup and the correct value in the stylesheet. It cost a build once.
          */}
          {/*
            ⚠ THE CLIP LIVES ON EACH CLAUSE, NOT ON A WRAPPER AROUND THE HEADING.

            Two clauses appearing one after the other reads as writing; one clipped `<h1>` reads
            as a curtain. `<Arrival as="span">` exists for this — a `<div>` inside an `<h1>` is
            invalid HTML, and hand-rolling the attribute here would put a motion decision in a
            section file instead of in the vocabulary.
          */}
          <Display id="hero-headline" data-hero-headline="" className="max-w-mk-measure-display">
            {HEADLINE_LINES.map((line, i) => (
              <Arrival
                key={line.text}
                as="span"
                variant="line"
                index={i}
                className={mkcn("block", line.accent && "text-mk-green-display")}
              >
                {line.text}
              </Arrival>
            ))}
          </Display>

          {/*
            One offset for the whole block below the headline, inherited. `display: contents` so
            the wrapper generates no box and every margin below still resolves against the copy
            column exactly as it did.

            420ms is measured, not picked: clause two starts at 140ms and its 1100ms wipe is
            visibly complete well before it ends, so the lead begins while the headline is still
            settling rather than after it has stopped. A sequence that waits for each step to
            finish reads as a slideshow.
          */}
          <div style={{ display: "contents", ["--mk-arrive-offset" as string]: "420ms" }}>
            {/* The brand's own functional explainer, one step down from the headline and set at
                the lead size. It is the line that appears under the wordmark on the deck's
                cover, so it is the one piece of copy on this page that is load-bearing as
                identity rather than as argument. */}
            <Arrival index={0} className="mt-6 md:mt-8">
              <Prose size="lead" tone="ink" className="max-w-mk-measure">
                {hero.subhead}
              </Prose>
            </Arrival>

            <Arrival index={1} className="mt-4">
              <Prose tone="stone" className="max-w-mk-measure">
                {hero.lead}
              </Prose>
            </Arrival>

            <Arrival index={2} className="mt-9 flex flex-wrap items-center gap-3 md:mt-11 md:gap-4">
              <MkButtonLink href={hero.primary.href} variant="dark" size="lg" data-hero-cta="">
                {hero.primary.label}
              </MkButtonLink>
              <MkButtonLink href={hero.secondary.href} variant="line" size="lg">
                {hero.secondary.label}
              </MkButtonLink>
            </Arrival>

            {/* Tighter to the controls than the controls are to the copy — it is a footnote ON
                the buttons, not a fourth statement. */}
            <Arrival index={3} className="mt-5">
              <Prose size="small" tone="stone" className="max-w-mk-measure-tight">
                {hero.aside}
              </Prose>
            </Arrival>
          </div>
        </div>

        {/*
          The card carries no arrival move of its own.

          It is present and complete from the first frame — it has to be, because the front face
          is server rendered and it is what a reader with reduced motion keeps — so there is
          nothing to animate on. Wrapping it in an `<Arrival>` would fade in the one element on
          the page whose whole argument is that it is already there and already true.

          ⚠ THE FACE IS RESOLVED HERE, ON THE SERVER, AND HANDED DOWN AS AN ELEMENT.
          `resolveCard` reads the fixture database and `<QrZone>` computes the symbol at render
          time; both belong on the server, and `<HeroCard>` is a client island because it owns a
          timer and a press. Passing the rendered face across that boundary is what keeps the QR
          out of the browser's main thread entirely.
        */}
        {/*
          ⚠ `-mx-3` ON A PHONE, AND IT IS THE FACE'S OWN BUDGET RATHER THAN A NUDGE.

          `FACE_WIDTH` is 336 because the face is rigid and had to fit a 360px viewport with the
          card screen's 12px padding each side: 336 + 12 + 12 = 360 exactly. This column pads
          itself by 24 (`px-6`), which leaves 312 — so at 360 the card was being squeezed to 312
          and its QR shrank with it, under the 140px scannable floor. The test caught it at
          vp-360 and passed at 768 and 1440, which is exactly the kind of thing only a test
          catches.

          Giving back 12px each side reproduces the budget the face was derived against. The
          page still does not scroll sideways at 360 — asserted by "never scrolls sideways".
        */}
        <div className="-mx-3 md:mx-0 lg:col-span-5">
          <HeroCard
            face={<ShareFace resolved={resolvedHeroCard} mode="full" />}
            frontLabel={hero.cardFrontLabel}
            backLabel={hero.cardBackLabel}
            caption={liveCard.caption}
          />
          {/* `aria-hidden` because the control's own label already says what a press does; read
              out as well it would be the same instruction twice. This is for eyes only. */}
          <p
            aria-hidden="true"
            className="mt-5 text-center text-mk-caption text-mk-pebble"
          >
            {hero.cardHint}
          </p>
        </div>
      </div>
    </Section>
  );
}
