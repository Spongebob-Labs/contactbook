import { broadcast } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";
import { Section } from "./section";
import { HEAD_TO_BODY, PanelTitle, Prose, RULE, SectionHead } from "./type";

/**
 * The broadcast pass — the page's argument, and the one section whose job is to be believed
 * rather than clicked.
 *
 * Its heading is a statement about iOS and Android, not about Contact Book: neither platform
 * exposes an API that writes to a third party's address-book entry, WhatsApp reads the address
 * book rather than writing to it, and the product was reshaped around that fact when the
 * silent-sync model was abandoned. Every competitor's marketing implies the saved contact
 * refreshes itself; this is the only page that can say why it does not.
 *
 * So there is deliberately **no call to action in this pass.** The hero and `start` own those.
 * A button under this sentence turns a concession into a pitch and spends the credibility the
 * sentence exists to buy — and the fixture, which owns every word on the page, gives this
 * section no link to render, which is the mechanical version of the same decision.
 *
 * ## This is the page's one `size="xl"` head, and it is a hierarchy decision
 * `<Heading>` at `xl` is 36 to 60px against the shared `lg` step's 32 to 48. Two things had to be
 * false for that to be the right lever. The first: it is not the display step (44 to 72px), which
 * belongs to the hero's single `<Display>` — a mid-page band wearing the largest type on the
 * page makes the peak arrive halfway down and flattens everything above and below into one
 * tier. The second: `xl` is spent HERE and nowhere else. A second `xl` anywhere on the page
 * puts two competing headlines on it and returns this band to looking like the seven around
 * it, which is the failure this step exists to fix. `type.tsx` states the same rule at the
 * component; if a third section reaches for `xl`, that is the regression.
 *
 * The head runs the full content column rather than sitting in a grid cell. That is the third
 * means of dominance that costs no hierarchy — the other two being the Pistachio ground, which no
 * neighbouring pass has, and a heading that runs three lines where every other head runs two.
 *
 * ## ⚠ Pistachio is a wash, so every tone in this file is `ink` — measured, not estimated
 * `--mk-stone`, the `<Prose>` default and correct on paper and white, measures **2.30–3.07:1**
 * on the four washes and fails AA at body size. `--mk-pebble` measures **2.30–3.05:1** and fails
 * too, so there is no muted tier available inside this pass at all: the term/detail hierarchy
 * is carried by size and family alone. `--mk-ink` measures **10.79:1** on this Pistachio, and
 * `--mk-stone` measures **3.07:1** on it — the wash swapped from `--mk-peach #f8ebd8` to the
 * `#BFD48C` card ground, so the ink lost headroom it did not need and stone lost the near-miss
 * it used to have. Numbers
 * are in the wash block of `src/styles/marketing.css`.
 *
 * This is the dangerous kind of failure — a default `<Prose>` here looks entirely fine and is
 * 3.07:1 — so the guard is that every `<Prose>` below carries `tone="ink"` explicitly, and
 * `[data-broadcast-fact]` exists so a contrast assertion over the pass is a one-line locator.
 *
 * ## Why the argument is ONE wide column and not a 7/5 split
 * This band used to be 7 columns of argument beside 5 of guarantees. Seven of the page's
 * sections had independently converged on some version of "narrow head in a few columns, air,
 * wider block beside it", and a reader who cannot name the ratio still recognises the shape as
 * a template. More to the point, a three-paragraph statement wants to be an unbroken column: a
 * reader following an argument should not have a definition list in their peripheral vision
 * arguing back. The guarantees then arrive underneath in the slot `problem` uses for its
 * counts — same slot, different object (those are 48px numerals, these are term-and-detail
 * pairs), so the rhythm rhymes without the figure repeating.
 *
 * ## No panels, and no icons
 * The tempting build puts three white cards on the Pistachio. Two reasons it is wrong. The pass is
 * already the card — `<Section>` owns the radius and the shadow, and a second radius inside one
 * makes two objects where one does the work. And a wash is itself the separation device, so the
 * divisions between the guarantees are 1px rules, which also lets the three read as one
 * continuous list rather than as three separate offers. `<Figure>`, the page's sanctioned
 * substitute for iconography, is likewise absent: `broadcast.facts` carries no ordinals, the
 * three guarantees are not a sequence, and numbering them would assert an order the copy does
 * not claim while putting a string literal on the page the fixture does not own.
 */

export function Broadcast() {
  return (
    <Section id="broadcast" tone="pistachio" labelledBy="broadcast-heading">
      {/*
        The Pistachio IS the boundary. No rule above the head, no eyebrow above the heading: a
        kicker over a headline is the page apologising for it, and this is the one headline on
        the page that needs no help. The fixture no longer carries an `overline` field for it.

        `className="text-mk-ink"` on the head wrapper is load-bearing and NOT belt-and-braces.
        `mkcn` resolves `text-*` conflicts by class group, and `mk-cn.ts` registers
        `mk-heading-lg` as a font size but not `mk-heading-xl`; twMerge therefore files
        `text-mk-heading-xl` as a text COLOUR, sees it conflict with `<Heading>`'s own
        `text-mk-ink`, keeps the later one and drops the ink. Verified against the installed
        tailwind-merge with this section's exact class list:

          xl : font-mk-display font-mk-editorial text-balance text-mk-heading-xl
          lg : font-mk-display font-mk-editorial text-mk-ink text-balance text-mk-heading-lg

        The size survives; the colour does not, and the heading falls back to whatever it
        inherits. Setting the colour on the parent puts it back through inheritance, which is
        the only fix available from this file — `<SectionHead>` passes `className` to its
        wrapper, not to the heading. The real repair is one entry in `mk-cn.ts`'s `font-size`
        list, after which this class is harmless rather than necessary.

        `align` stays at its `start` default. `tests/e2e/marketing.spec.ts` names `broadcast`
        as the section a future hand would centre while keeping the centred-section count
        legal, and asserts the centred set is exactly `hero` and `start`.
      */}
      <SectionHead
        heading={broadcast.heading}
        headingId="broadcast-heading"
        size="xl"
        className="text-mk-ink"
      />

      <div className={mkcn("flex flex-col", HEAD_TO_BODY)}>
        {/*
          One measure on the column, not a cap per paragraph: the first paragraph is 18px and
          the other two are 16px, and `ch` resolves against each element's OWN font size, so
          per-paragraph caps would ladder the right edge of a block that is meant to read as
          one column. `--mk-measure-wide` (75ch) is the top of the 65–75ch band and the widest
          of the three shared measures, which is right for the one column carrying the page's
          argument; the guarantee details below take the default 68ch and end short of it.

          `gap-5` (20px) rather than an indent: at a 1.6 line height that is the smallest gap
          still legible as a paragraph break in a stack this short.

          The first paragraph takes the lead step. Not decoration — "Not on iPhone, not on
          Android" is a fragment that finishes the heading's sentence, and the drop to 16px
          afterwards is the step a reader takes as a change of subject.
        */}
        <div className="flex max-w-mk-measure-wide flex-col gap-5">
          {broadcast.paragraphs.map((paragraph, index) => (
            <Prose key={paragraph} size={index === 0 ? "lead" : "body"} tone="ink">
              {paragraph}
            </Prose>
          ))}
        </div>

        {/*
          The guarantees: three abreast from `md`, stacked below it.

          `RULE.ON_WASH_ROW_MD` draws the INTERIOR edges only, from the cell that follows each
          shared edge, so no interior rule is drawn twice (a `border` on every item meets at
          2px where two 1px rules do) and the outer edges of the set stay clean. Its ink at 15%
          is the wash variant and not a preference: `--mk-hairline` is a flat neutral that
          measures 1.24:1 on Pistachio and reads as a cold grey line laid over a warm ground,
          while ink at 15% composites at 1.33:1 in the ground's own hue — more separation, right
          hue.
          Both are decorative dividers, so neither owes the 3:1 of WCAG 1.4.11.

          ⚠ The rules rotate from horizontal to vertical at `md:`, so the grid must flip at
          exactly `md:` too or the rules turn while the layout is still stacked.

          The `border-t` on the `<dl>` is NOT an interior rule and is therefore hand-written
          here: it is the set's top edge, the boundary between the argument and the guarantees,
          and `RULE` deliberately leaves it undrawn. It matches the interior weight on purpose
          — a top rule a step darker than the three it introduces is visible as a mismatch.

          The spacing either side of a rule is deliberately UNEVEN: 28px above (`gap-y-7`,
          outside the border) against 20px below (`pt-5`, inside it). Even spacing makes a rule
          float between two items; the shorter gap beneath attaches it to the term it
          introduces. The lower gap has to be padding — a margin on the term would land on the
          wrong side of the line. Horizontally the same logic runs the other way and comes out
          symmetric: `md:gap-x-10` puts 40px between the previous column and the rule, and
          `ON_WASH_ROW_MD`'s own `md:pl-10` puts 40px between the rule and the text it
          introduces, so the rule sits centred in its channel instead of flush against the
          column before it.
        */}
        <dl
          className={mkcn(
            "mt-16 grid grid-cols-1 gap-y-7 border-t border-mk-ink/15 pt-8",
            "md:mt-20 md:grid-cols-3 md:gap-x-10",
            RULE.ON_WASH_ROW_MD,
          )}
        >
          {broadcast.facts.map((fact) => (
            // `dl > div > (dt, dd)` is valid HTML5 grouping, and it is what lets the rule and
            // the spacing belong to the PAIR rather than to one of its two halves.
            <div key={fact.term} data-broadcast-fact="" className="pt-5">
              <PanelTitle as="dt">{fact.term}</PanelTitle>
              {/*
                `<Prose as="dd">` is what puts body copy inside a `<dl>` group without a
                wrapper element between the group and its own definition. `tone="ink"` is the
                wash rule at the top of this file, not a style choice.
              */}
              <Prose as="dd" size="small" tone="ink" className="mt-2 max-w-mk-measure">
                {fact.detail}
              </Prose>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
