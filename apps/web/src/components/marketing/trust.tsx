import type { ReactNode } from "react";

import { trust } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";
import { Section } from "./section";
import { HEAD_TO_BODY, PanelTitle, Prose, SectionHead } from "./type";

/**
 * Trust — the four claims about what actually leaves your phone.
 *
 * ## The pass is the card, so nothing in here is a card
 * This band used to render four wash-filled panels sitting on paper. In the deck that reading
 * is now impossible, because the SECTION is a Clay object with a 28-36px radius and a
 * two-layer shadow. Four tinted blocks with their own radius inside it would be four cards on
 * a card — the stacked-surfaces failure — and the reader would have to work out which of the
 * two edges is the meaningful one. There is one fill in this band and it is the pass. The four
 * claims sit directly on the Clay, and every division between them is a 1px rule in the
 * ground's own hue.
 *
 * A rule is also the more honest device for what these are. A filled block says "feature";
 * a ruled cell says "entry", and these are four checkable statements about a mechanism, closer
 * to a specification than to a pitch. `trust.body` is explicit that the decisions are made in
 * the product rather than at the moment of sharing, and the copy is deliberately free of the
 * sentence every product ships ("we take your privacy seriously"), so the treatment should not
 * put that sentence back visually.
 *
 * ## Every piece of copy in here is ink, and that is measured
 * `--mk-clay` is `#E3A28A`, the card ground that replaced `--mk-mint #cbfbf1`. `--mk-ink`
 * measures **8.12:1** on it — down from 14.53, and still four steps of headroom past AA —
 * while `--mk-stone`, the default `<Prose>` tone and correct on paper and white, drops from
 * 4.21 to **2.32:1**. `--mk-pebble` measures 2.30:1. The washes got more saturated and the
 * substitution rule got harder, not softer: there is no muted tier available on this ground at
 * any strength, so the step from a claim's title to its body is carried by size, weight and
 * family alone.
 *
 * The failure mode is the dangerous kind — a default `<Prose>` here looks completely fine and
 * is under the bar — so `tone="ink"` is passed at every site, including through
 * `<SectionHead tone="ink">`, whose `tone` prop reaches the lead paragraph. A regression would
 * be caught by reading the computed colour of `[data-trust-panel] p` and asserting it against
 * `--mk-ink` rather than by looking at the band.
 *
 * ## Why a 2x2 with aligned rules, and not the pinwheel
 * A row of four inside the 1200px page gives ~250px cells, which is ~28ch of measure, and this
 * copy (147-166 characters per claim) breaks into six ragged lines in it. That shape is a
 * feature grid, recognisable as one before a word is read, so four-up is out on measure alone.
 *
 * The earlier build answered that with a 7/5 then 5/7 pinwheel, assigning the wide spans to
 * the two long claims. That worked while each cell had a fill: a reader can see two blocks of
 * different widths and read the difference as deliberate. It does not survive the move to
 * rules. With no fill the only vertical mark is the interior rule itself, and a pinwheel puts
 * it at 7/12 of the column in the first row and 5/12 in the second — a jog of 2/12, about
 * 200px on a 1200px page, with nothing left on screen to explain it. An offset hairline does
 * not read as an asymmetric composition; it reads as a mistake. So the grid is an even 2x2 and
 * the two rules cross at the centre, which is a figure the eye resolves instantly and which no
 * other band on the page uses: `problem`, `broadcast` and `how-it-works` are all single ruled
 * ROWS, and this is the only two-row set.
 *
 * At 2-up the cells are ~560px less their 40-56px inner padding, which lands the body between
 * 44 and 46ch. `--mk-measure-tight` is 46ch, so the cap is doing almost nothing at desktop and
 * everything at the tablet step, which is what a measure token is for.
 *
 * ## The rules, and who draws each edge
 * Interior edges are drawn by the cell that FOLLOWS them, one edge each, never twice: cells 3
 * and 4 own the horizontal, cells 2 and 4 own the vertical from `md` up. The set's own top
 * edge belongs to the set and not to any cell in it, so it lives on the `<ul>` — the same
 * split `broadcast` makes, and the reason a shared `RULE.*` constant cannot draw it. That top
 * rule is what gives the four claims a defined start on a wash that has no other edge inside
 * it; without it the set floats halfway down a Clay rectangle.
 *
 * The colour is `--mk-ink` at 15%, which is `RULE.ON_WASH`'s value rather than a new one.
 * `RULE.ON_WASH` itself cannot be used here because it is an `[&>*+*]` stack rule: it draws a
 * top border on every cell after the first, which is right for one column and wrong for the
 * second row of a grid, where cell 2 must LOSE its top border at `md` and gain a left one.
 * Positional rules need positional classes. The flat `--mk-hairline` token is not an option
 * either — it measures 1.11:1 on a wash and reads as a cold grey line laid over a warm ground,
 * against 1.35:1 for ink at 15% in the ground's own hue. Both are decorative dividers, so
 * neither owes the 3:1 of WCAG 1.4.11.
 *
 * There is no column gap, deliberately. A grid gap sits OUTSIDE the border, so `gap-x-10` plus
 * a left border on cell 2 puts the rule hard against cell 2's text with 40px of nothing on the
 * other side. The air is padding on both sides of each rule instead, so every rule is centred
 * in its own gutter.
 *
 * ## This is the one band on the page that earns an icon set
 * The page's substitute for iconography is `<Figure>`, a numeral at the section-heading step,
 * and it is wrong here twice over: these are four independent claims rather than a sequence,
 * so numbering them asserts an order the product does not have, and the fixture carries no
 * ordinals to render. But four claims with no mark at all are four identical text blocks in a
 * ruled grid, and the fourth is indistinguishable from the first at a glance.
 *
 * So each claim gets one drawn mark, and the marks are the content rather than decoration: a
 * tick for what you choose per card, a padlock for the fields that cannot be shared at all, a
 * QR symbol for what the code contains, and a circular arrow for taking a card back. They are
 * `aria-hidden` because each one restates the title directly underneath it, and a screen
 * reader announcing "image" four times before four headings is noise, not information.
 */

/**
 * The geometry of the four marks, keyed by `panel.id` and nothing else.
 *
 * Keyed rather than positional, unlike the wash rotation this replaced: a rotation is a
 * property of a sequence and may safely wrap, but a padlock against the QR claim is simply
 * wrong. An id with no entry renders no mark, which is the correct failure — a missing mark is
 * a gap a reviewer notices, while a wrong mark is a lie a reviewer reads straight past.
 *
 * Only the geometry lives here. The box, the stroke, its width, its cap and its join are set
 * once on the `<svg>` in `TrustMark` and inherit down, so the four marks cannot drift in
 * weight relative to each other: there is one `strokeWidth` in this file and changing it
 * changes all four. A per-icon `<svg>` was how the last icon set in this repo ended up with
 * three weights in one row.
 */
const MARK_GEOMETRY: Record<string, ReactNode> = {
  // The tick. A bare check, not a check inside a circle: the ring would be a second closed
  // shape competing with the QR mark's squares two cells away, and at 24px it costs the
  // check most of its length.
  "per-card": <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,

  // The padlock: a shackle drawn as a true semicircle over a body with the product's own
  // small radius. No keyhole — at 24px with a 2px stroke the hole and the two body edges sit
  // within 3px of each other and the whole mark fills in.
  private: (
    <>
      <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
      <path d="M8.25 10V7a3.75 3.75 0 0 1 7.5 0v3" />
    </>
  ),

  // The QR symbol: three finder squares and a smaller fourth square inset from the remaining
  // corner. That fourth square is not filler — it is the alignment pattern, which is where a
  // real QR of any version above the smallest puts one, and it is what keeps the mark from
  // reading as a generic four-square grid.
  qr: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="14.5" y="14.5" width="5" height="5" rx="1" />
    </>
  ),

  // The circular arrow. 270 degrees of a 7.5px circle centred in the box, opening at the top
  // right, with the head at three o'clock pointing back up into the gap. The direction is
  // counter-clockwise on purpose: clockwise is the refresh idiom and this claim is a
  // withdrawal, not a reload. The head's barbs stop at x=22.5, which with a 2px stroke is the
  // last position that clears the 24px box.
  revoke: (
    <>
      <path d="M12 4.5a7.5 7.5 0 1 0 7.5 7.5" />
      <path d="M16.5 15 19.5 12 22.5 15" />
    </>
  ),
};

/**
 * One mark. The single `<svg>` that every claim's geometry is poured into.
 *
 * `text-mk-ink` is set explicitly rather than inherited: `currentColor` would otherwise resolve
 * to whatever the nearest coloured ancestor happens to be, and this component sits inside a
 * `<li>` that sets no colour at all. Ink is 8.12:1 on Clay, and the marks restate their
 * titles, so they carry no contrast obligation of their own beyond being visible.
 */
function TrustMark({ id }: { id: string }) {
  const geometry = MARK_GEOMETRY[id];
  if (!geometry) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-6 w-6 shrink-0 text-mk-ink"
    >
      {geometry}
    </svg>
  );
}

/**
 * The interior edges and the air around them, per cell, in fixture order.
 *
 * Written out rather than derived from the index, because the four cells genuinely differ and
 * an expression that computed them would be a puzzle over four lines of plain fact. The shape
 * to hold in mind: one column below `md`, where every cell after the first draws a rule above
 * it; two columns from `md`, where the top row loses those rules and the right column gains a
 * left one.
 *
 * The colour lives on the `<li>` itself so it is stated once per cell rather than once per
 * edge. A border with no width is invisible, so a cell that draws no rule pays nothing for it.
 */
const CELL_EDGES: readonly string[] = [
  // Top left. No interior edge above or beside it; it only owes the air below.
  "pb-10 md:pb-12 md:pr-10 lg:pr-14",
  // Top right. Stacked below `md` it follows cell one and draws the rule between them; at
  // `md` it moves up beside cell one and that rule becomes the vertical.
  "border-t pt-10 pb-10 md:border-t-0 md:border-l md:pt-0 md:pb-12 md:pl-10 lg:pl-14",
  // Bottom left. Owns the horizontal rule at every width.
  "border-t pt-10 md:pt-12 md:pr-10 lg:pr-14",
  // Bottom right. Owns both interior edges that meet at the centre of the figure.
  "border-t pt-10 md:pt-12 md:border-l md:pl-10 lg:pl-14",
];

export function Trust() {
  return (
    <Section id="trust" tone="clay" labelledBy="trust-heading">
      {/*
        Left aligned, which is the page default: design.md centres the hero and nothing else,
        and centring every band is the layout half of looking generated. `tone="ink"` is the
        contrast substitution the Clay forces on the lead — see the note at the top of the file.
      */}
      <SectionHead
        heading={trust.heading}
        headingId="trust-heading"
        lead={trust.body}
        tone="ink"
      />

      {/*
        A list, not four divs. Four is a count worth announcing, and a reader on a screen
        reader should be told "list of 4 items" rather than having to infer the size of the set
        from four headings. `list-none` is explicit rather than leaning on preflight, since
        this markup should not depend on which reset the app happens to ship.

        The `border-t` here is the set's outer top edge, which no cell can own. `HEAD_TO_BODY`
        is the page's one head-to-body gap; the `pt` beneath the rule matches the air the cells
        put on the other side of the horizontal rule, so both rules sit in even gutters.
      */}
      <ul
        className={mkcn(
          HEAD_TO_BODY,
          "grid list-none grid-cols-1 border-t border-mk-ink/15 pt-10 md:grid-cols-2 md:pt-12",
        )}
      >
        {trust.panels.map((panel, index) => (
          <li
            key={panel.id}
            data-trust-panel={panel.id}
            className={mkcn("flex flex-col border-mk-ink/15", CELL_EDGES[index])}
          >
            <TrustMark id={panel.id} />

            {/*
              Title and body are both held to `--mk-measure-tight`. On the ~560px cell the body
              already sets at about 45ch so the cap barely bites; on the title it does real
              work, because a 24px line allowed to run the cell's full width reads as a
              sentence rather than as a label and the four claims stop scanning as a set.

              `<PanelTitle>` at its default `h3` is the same element and level that every other
              repeated set on the page gives the title of one item.
            */}
            <PanelTitle className="mt-5 max-w-mk-measure-tight">{panel.title}</PanelTitle>
            <Prose tone="ink" className="mt-3 max-w-mk-measure-tight">
              {panel.body}
            </Prose>
          </li>
        ))}
      </ul>
    </Section>
  );
}
