"use client";

import Link from "next/link";

import { cn } from "@/lib/cn";

import type { TemplatePalette } from "@/card/template-palettes";
import { cardSwatch } from "@/card/card-palette";
import type { CardReach } from "@/lib/dashboard/metrics";

/**
 * Cards ranked by how often their link has been opened.
 *
 * ## The verdict this rebuild answers
 *
 * "The graphs and cards-by-opens could be very well channelized" — organised, structured, easy
 * to read. What was here was five coloured bars floating on the page with a name to their left
 * and a count to their right, and **nothing behind them**. Three things were missing, and each
 * one is a structural fix below rather than a coat of paint:
 *
 * · a **track** behind every bar, so a length is read against a fixed channel instead of against
 *   whichever bar happens to sit above it. Without one, the only comparison a reader can make is
 *   bar-to-bar, which is the comparison that gets harder the further apart two rows are;
 * · a **rank column**, because "most opens first" was the figure's central claim and it was
 *   carried entirely by the order rows happened to be emitted in — a claim a reader has to infer
 *   is a claim the figure never made;
 * · **fixed columns**, so rank, name, track and count land on the same four x-positions on every
 *   row. Rows that each find their own edges read as a stack of independent widgets; rows that
 *   share edges read as a table, and the eye can run down one column at a time.
 *
 * ## ⚠ The ground is cream now, and every ratio below was re-measured against it
 *
 * The app sits on Atelier: `--canvas` `#FCFAF8`, `--surface` `#F7F2ED`, `--surface-sunk`
 * `#F2EAE1`. Numbers a component inherited from the white-canvas era are not merely stale here,
 * they are *optimistic* — every one of them was computed against a lighter ground than the one
 * the figure is now drawn on, so each re-measurement below moves the wrong way and has to be
 * checked rather than assumed. Where a number is quoted it was computed with the same sRGB
 * relative-luminance formula `src/lib/contrast.ts` uses, against the token named beside it.
 *
 * ## Why hue is keyed to the card, and never to the number
 *
 * The categories are card names — **nominal**, not ordered — so the one thing hue must not do
 * here is track length. Shading each bar darker-where-bigger would double-encode the value the
 * bar's own width already carries and fail the categorical checks by construction. That rule
 * stands and is why nothing below reads `row.opens` for a colour.
 *
 * What the rule never justified was **grey**. A card's colour is not derived from its opens; it
 * is the card's identity — the ground its owner picked in the builder and then sees on the
 * thumb tile, the detail screen and the share face. Painting two different cards as two
 * identical dark-grey bars spends nothing and throws away a nominal channel the product has
 * already paid for, leaving the reader to re-read the label to tell which row is which. So the
 * fill is a function of `cardId` alone, and length remains the only quantitative encoding.
 *
 * ## ⚠ Why the fill is the card's `ground`, and why it still carries an edge
 *
 * `ground` is the colour a reader would name if asked what colour a card is, and that is the
 * whole job here — the chart is a legend as much as a ranking, and a bar a reader cannot match
 * to a card has lost half its purpose.
 *
 * It cannot be used bare, though, and the palette file's own arithmetic says why. A ground is
 * either **deep (L ≤ 0.100)** or **light (L ≥ 0.339)**; nothing lives between, because no ink
 * clears 7:1 there. The light tier is the defect, and the cream ground made it worse rather than
 * better: Pistachio's `#BFD48C` measures **1.55:1 on `--canvas`** and **1.36:1 on the track**,
 * and Mint's `#BFF6EC` measures **1.00:1 on the track** — the same relative luminance as
 * `--surface-sunk` to two decimal places. A Mint bar drawn without its edge is not faint on this
 * figure, it is *absent*: a track with nothing in it and a count beside it claiming nine opens.
 *
 * So the fill is `ground` and the **boundary** supplies the 3:1, via `canvasActionBg` — the slot
 * that exists for exactly this position ("the fill and label for a card action drawn on the app
 * canvas rather than on the card") and which `PALETTE_CONTRACT` already proves against
 * `#FFFFFF` on every palette, presets and `derivePalette` output alike. That is not a loophole:
 * 1.4.11 asks the object's boundary be discernible and does not care whether the fill or the
 * border provides it, which is the same reading `buttonAltBorder` runs on in
 * `template-palettes.ts`. On a deep ground the two colours nearly coincide and the edge simply
 * disappears — correct, since a deep ground needs no help being seen.
 *
 * ⚠ **The contract is proved against white, and the bar no longer sits on white — so the edge
 * was re-measured on the track rather than carried over.** A dark edge loses ratio as the ground
 * behind it darkens, and `--surface-sunk` is darker than `#FFFFFF`, so the contract's guarantee
 * is an upper bound here and not a result. Measured across all eleven palettes the worst edge on
 * the track is Mint's `#0C7560` at **4.73:1** (5.41 on `--canvas`, 5.63 on white); every other
 * palette lands between 7.11 and 14.99. The floor holds with better than 1.5× of headroom, which
 * is why the track could be introduced without touching `cardSwatch` — but it holds as a
 * measured fact, not as an inherited one, and a future ground darker than `--surface-sunk` has
 * to re-run this arithmetic.
 *
 * ⚠ **The pair comes from `cardSwatch()` and is not restated here.** The attention list marks
 * the same cards a few rows down, and when the two components each chose for themselves a
 * Marigold card came out ochre in this chart and deep brown in that queue. One card, two
 * colours, one screen. The rule lives in `card-palette.ts` now and both read it.
 *
 * ⚠ **No gradient toward a second colour.** A bar's far end is its value; fading that end into
 * anything makes the length ambiguous precisely where it is being read. One flat fill, one edge.
 *
 * ## The track, and why it is held to "visible" rather than to 3:1
 *
 * The track is `--surface-sunk` inside a `--line` hairline: 1.14:1 and 1.23:1 against
 * `--canvas`. Those are decorative weights, and deliberately so — `tokens.css` names `--line`
 * "DECORATIVE hairlines, dividers, exempt from 1.4.11" and that exemption is the correct one to
 * claim here, because **the track carries no value**. Every quantity in this figure is stated
 * twice already: as the bar's length and as digits in the count column. The track is a reference
 * that makes the first of those easier to compare; a reader who cannot see it loses a
 * convenience, not a number. Painting it at a graphical-object weight would be the real defect —
 * a 3:1 channel is heavier than the card colours inside it, and the figure would read as a row
 * of empty boxes with something drawn in them.
 *
 * The track's full width is the peak row, so the top card's bar fills it edge to edge and every
 * other bar reads as a fraction of the best. That is what the scale line in the caption states
 * in words, and the two must not disagree: both come from `peak` below.
 *
 * ## Rank numerals, and the tie the sort hides
 *
 * `cardReach()` sorts by opens, then recipients, then name. Only the **first** of those three
 * keys is the thing this figure is about, so two cards on nine opens each are a genuine tie that
 * the second and third keys merely put in a stable order. Printing 1, 2, 3 down the column would
 * turn that stable order into a claim that one of them is ahead of the other, which is a claim
 * the data does not support and a reader has no way to check. So ties share a numeral and the
 * next distinct value skips ahead (1, 1, 3) — standard competition ranking.
 *
 * ⚠ **A card with zero opens gets no numeral at all**, and the blank is deliberate rather than
 * missing. It is not in tenth place in a ranking by opens; it is not in the ranking. Numbering
 * it would also produce the absurd case directly: a brand-new owner whose five cards all sit at
 * zero would otherwise read a podium of five, in an order decided entirely by alphabet.
 *
 * The numerals are `aria-hidden` and the list is an `<ol>`. The order is the semantics; the
 * numerals are a visual restatement of it, and a screen reader that announced both would hear
 * the position twice on every row.
 *
 * ## Why `palettes` is optional
 *
 * A caller without palettes to hand — and every test that renders this in isolation — gets the
 * previous flat `--ink-2`. That is a correct chart, merely a monochrome one. A missing map is
 * not worth throwing over on the owner's own dashboard, where the colour is decoration and the
 * ranking is the content.
 *
 * ## Why the label sits outside the bar
 *
 * A card called "Work" and a card with a 40-character name share this list, and a short bar
 * cannot hold its own label without clipping it. Names live in a fixed column to the left, so
 * nothing is ever cropped and the bars all start from one baseline.
 *
 * ## ⚠ Why there is no row hover band
 *
 * The obvious polish — a `--surface-sunk` fill behind the hovered row — is the one thing this
 * layout cannot have, because the track already spends `--surface-sunk`. A band in the same
 * token erases the channel under the pointer: the reader hovers a row to look at it more
 * closely and the reference they were reading it against disappears. The hover response stays
 * on the bar itself (deepen and saturate) and on the name (underline), both of which are
 * legible without taking anything away.
 */

/* React 19 hoists `<style href precedence>` into `<head>` and dedupes by `href`, so this renders
   once however many figures mount — the same mechanism `activity-chart.tsx` uses. A keyframe
   cannot be expressed as an inline style, and `globals.css` is not this component's file to
   edit.

   ## Motion
   Bars grow from the baseline once, staggered top to bottom, so the eye arrives at the longest
   bar first — the same reading order the ranking asserts. There is deliberately **no local
   `prefers-reduced-motion` block**: `globals.css` §3b implements reduced motion once by zeroing
   every `--dur-*` token and forbids a second block anywhere in this codebase. The duration is
   `var(--dur-base)` and the stagger is a multiple of `var(--dur-instant)`, so both collapse to
   `0ms` under the preference — delay included, which a hand-written `220ms` would not.

   `animation-fill-mode: backwards`, never `forwards`: the landed state is the element's own
   width, so a figure whose animations never run (print, a harness with animations disabled)
   paints fully rather than not at all. The keyframe declares only `from` for the same reason —
   the implicit `to` is whatever width the row computed, which is the one place the value lives. */
const REACH_STYLE_HREF = "contactbook-reach-bars";

const REACH_CSS = `
@keyframes cb-reach-grow {
  from { width: 0; }
}
[data-reach-bar] {
  animation: cb-reach-grow var(--dur-base) var(--ease-out) backwards;
}
`;

/**
 * The visible rank of each row, `null` where the row is not in the ranking at all.
 *
 * Positions are read off the order the caller already handed us rather than re-derived from a
 * second sort. That is not laziness: a rank computed independently could disagree with the order
 * the rows are drawn in, and a column of numerals that does not descend is a far worse bug than
 * no numerals. The numeral restates the list; it never overrules it.
 */
function ranksOf(rows: readonly CardReach[]): readonly (number | null)[] {
  let tiedAt = -1;
  let rank = 0;

  return rows.map((row, i) => {
    /* Zero opens is not last place — it is outside a ranking by opens. See the doc above. */
    if (row.opens === 0) return null;

    if (row.opens !== tiedAt) {
      tiedAt = row.opens;
      /* `i + 1`, not `rank + 1`: after a tie the next distinct value takes the position it
         actually occupies (1, 1, 3), which is what makes the skipped numeral readable as the
         tie it is rather than as a dropped row. */
      rank = i + 1;
    }
    return rank;
  });
}

export interface ReachBarsProps {
  rows: readonly CardReach[];
  /**
   * `cardId` → the card's palette, from `cardPalettes()`. Optional: see the note above on why
   * an absent entry falls back to grey rather than failing.
   */
  palettes?: ReadonlyMap<string, TemplatePalette>;
}

export function ReachBars({ rows, palettes }: ReachBarsProps) {
  /* The real peak, with no floor — the caption prints it, and "Full bar = 1 open" above a figure
     where nothing was ever opened is invented data. `scale` is the same number with the divide-
     by-zero guard, and is the only one of the two the geometry may use. */
  const peak = rows.reduce((hi, row) => Math.max(hi, row.opens), 0);
  const scale = Math.max(1, peak);
  const ranks = ranksOf(rows);

  return (
    <figure data-reach-bars="" className="m-0 flex flex-col gap-3">
      <style href={REACH_STYLE_HREF} precedence="default">
        {REACH_CSS}
      </style>

      {/* The caption states the scale rather than describing the figure, because the track makes
          "how long is a full bar" a question a reader can now ask. It falls back to the
          description when the peak is zero: a scale line is only true while something has been
          opened, and the figure still has to say what it is in that state. */}
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-overline uppercase text-ink-3">Cards by opens</h3>
        <p className="text-sm tabular-nums text-ink-3">
          {peak === 0
            ? "How often each link has been opened"
            : `Full bar = ${peak} ${peak === 1 ? "open" : "opens"}`}
        </p>
      </figcaption>

      {rows.length === 0 ? (
        /* An owner with no cards gets a stated blank, not an empty `<ol>`. The figure keeps its
           heading and its frame, so "nothing here yet" is legible as the chart's own answer
           rather than as a region that failed to render — which is the same defect the zero-open
           stub exists to rule out, one level up. */
        <p className="rounded-md border border-line bg-surface px-4 py-6 text-center text-sm text-ink-3">
          No cards yet. This ranking fills in once you build a card and share it.
        </p>
      ) : peak === 0 ? (
        /* ⚠ **Cards exist and none has ever been opened — which is NOT the same as no cards,
           and drawing it as a ranking is what made this figure look broken.**

           Every row resolves to the same 2px stub against a full-width empty track with the
           same "Not shared" beside it. At nine cards that is nine identical rows stating one
           fact, ranked by an order that carries no information because every value is zero.
           Caught by screenshotting the real screen rather than a two-card fixture: it filled
           half the charts row with noise and read as a rendering fault.

           A ranking with nothing to rank is not a ranking, so it says so once and names the
           quantity that IS true — how many cards are waiting. */
        /* ⚠ **States no count, and that is a correction rather than a style choice.**
           The first version read "None of your {rows.length} cards has been opened yet" and
           rendered "None of your 5 cards…" on a profile holding NINE — because `cardReach()`
           takes a `limit` (5 by default) and `rows` is the truncated top slice, not the card
           list. A figure that miscounts the owner's own cards discredits every other number
           beside it, and the screenshot is the only reason it was caught. The true total lives
           in `totals.cards`, which this component is deliberately not given; so it says the one
           thing it can prove from its own props. */
        <p className="rounded-md border border-line bg-surface px-4 py-6 text-center text-sm text-ink-3">
          No card has been opened yet. Share one and this ranking fills in.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row, i) => {
            const palette = palettes?.get(row.cardId);
            const swatch = palette === undefined ? undefined : cardSwatch(palette);
            const rank = ranks[i] ?? null;

            return (
              /* ⚠ **Stacked on a phone: rank and name above, bar and count below.**
                 As one row this is a 20px rank + a 96px count + three 12px gaps = 152px before
                 the name column has taken anything, and the name takes 28% more — leaving the
                 bar itself **78px** at a 320px viewport. A bar chart whose bars have less room
                 than their own labels has stopped encoding anything: every card renders as a
                 stub and the ranking, which is the whole point of the figure, becomes
                 unreadable. Stacking moves the rank up beside the name it belongs to and gives
                 the track the full width minus the count, so the comparison survives on the
                 narrowest supported screen.

                 `sm:contents` on the two wrappers, not `sm:hidden`/duplicate markup: the
                 wrappers dissolve at the breakpoint and their children become direct flex items
                 of the row, so there is exactly one copy of every node and the four columns are
                 four siblings. Duplicating the row for two layouts is how a name ends up fixed
                 in one of them and not the other.

                 Every column is sized by a rule that does not read its own content, and that —
                 not the rule chosen — is what makes the list a table. Each row is its own flex
                 container, so an `auto` or `fit-content` column agrees within a row and drifts
                 between rows: one name two characters longer and that row's bar starts somewhere
                 nobody asked it to. Fixed widths and one shared percentage both survive that;
                 content-derived widths are the loose stack this rebuild exists to replace. */
              <li
                key={row.cardId}
                data-reach-row={row.cardId}
                className="group flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="flex min-w-0 items-baseline gap-2 sm:contents">
                  {/* `aria-hidden` — the `<ol>` already carries the order, and a screen reader
                      that read both would announce every row's position twice. `tabular-nums`
                      so 9 and 10 align on the units digit down the column. */}
                  <span
                    aria-hidden="true"
                    className="w-5 shrink-0 text-right text-xs tabular-nums text-ink-3"
                  >
                    {rank ?? ""}
                  </span>

                  <Link
                    href={`/cards/${row.cardId}`}
                    /* Full measure on a phone, where it shares a line only with the rank and a
                       40-character card name has room to read; the column returns at `sm`.
                       `min-w-0` keeps `truncate` working in both.

                       ⚠ **A share of the figure, not 112 fixed pixels, and capped.** The name is
                       the one variable-length thing in the row, so it is the one column that
                       should get the benefit when the dashboard is wide — at a fixed 7rem this
                       list truncated "Speaking engagements" in a 640px column that had 180px of
                       empty track to spare. A percentage keeps every row aligned for the same
                       reason a fixed width does: all six rows resolve it against the same
                       container. The cap is where a name stops needing more room — past ~11rem
                       the extra width buys a few characters on a name that is truncated anyway,
                       and it is taken straight out of the bar, which is the thing being read.

                       ⚠ The name stays `--ink`. Only the bar is decorative — body text tinted
                       with a card palette is text whose contrast nobody proved against this
                       canvas, and the palette has no slot that promises one. */
                    className={cn(
                      "min-w-0 truncate text-sm text-ink underline-offset-4 hover:underline",
                      "sm:w-[28%] sm:max-w-44 sm:shrink-0",
                    )}
                    title={row.cardName}
                  >
                    {row.cardName}
                  </Link>
                </span>

                <span className="flex items-center gap-3 sm:contents">
                  {/* THE TRACK. `overflow-hidden` so the fill is clipped to the channel's own
                      radius and a bar can never overhang the reference it is measured against —
                      including mid-animation, where the width is interpolating. */}
                  <span className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-xs border border-line bg-surface-sunk">
                    <span
                      data-reach-bar=""
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-xs",
                        /* ⚠ The hover response is a FILTER, and that is a repair as much as a
                           redesign. The fill is an inline `style`, and an inline declaration
                           outranks any class — so the `group-hover:bg-ink` that used to sit here
                           could never have applied to anything. It was also the wrong intent
                           once the bars carry colour: collapsing every row to one near-black on
                           hover would erase the per-card hue this component now exists to show.
                           Deepening and saturating keeps the card's own colour and still reads
                           as a response, and it works on the grey fallback and the zero stub
                           too. */
                        "transition-[filter] duration-[var(--dur-fast)]",
                        "group-hover:saturate-150 group-hover:brightness-90",
                      )}
                      style={{
                        /* A zero-open card keeps a visible stub: "never opened" is the row worth
                           seeing, and a bar of literally zero width inside a drawn track reads
                           as a rendering fault. 3px rather than the old 2 because it now sits
                           against the track's own 1px hairline and has to be distinguishable
                           from it.

                           The stub stays neutral rather than taking the card's colour: it
                           encodes no value, and a 3px chip of Sapphire would read as a very
                           small measurement instead of as the placeholder it is. `2` is a floor
                           in PERCENT, so a card with one open out of a peak of two hundred is
                           still a mark rather than a hairline.

                           ⚠ `--line-control` was measured on `--canvas` (3.77:1) and now sits on
                           the track instead: **3.30:1 on `--surface-sunk`**. Still over
                           1.4.11's 3:1, and unlike the track itself this mark does carry a
                           value — it is the row's only graphical statement that the count is
                           zero — so it is held to the floor rather than exempt from it. */
                        width:
                          row.opens === 0 ? "3px" : `${Math.max(2, (row.opens / scale) * 100)}%`,

                        /* ⚠ **The card's OWN ground, with `canvasActionBg` as the edge — not the
                           edge colour as the fill.**

                           `canvasActionBg` alone is legible but it is not what the card looks
                           like. For the four light palettes it is the hue-matched DEEP button: a
                           Marigold card the owner sees as ochre `#E1AA40` drew a bar in
                           `#3A2408`, a deep brown. Correct by the contract, and wrong as a
                           legend — the chart is here so a reader can match a bar to a card at a
                           glance.

                           Filling with `ground` and outlining with `canvasActionBg` gets both.
                           The bar is the colour of the card, and the 3:1 boundary 1.4.11 asks
                           for is carried by the border instead of the fill. On the cream track
                           the fill needs that boundary more than it ever did on white: Mint's
                           ground measures 1.00:1 against `--surface-sunk`, the same luminance to
                           two decimals, so the edge is the entire reason that bar exists on the
                           screen. The worst edge on this ground is 4.73:1 — see the note above
                           for the sweep. */
                        backgroundColor:
                          row.opens === 0
                            ? "var(--line-control)"
                            : (swatch?.fill ?? "var(--ink-2)"),
                        border:
                          row.opens === 0 || swatch === undefined
                            ? undefined
                            : `1px solid ${swatch.edge}`,

                        /* Top to bottom, in ranking order. `--dur-instant` rather than a number
                           so §3b's central override zeroes the delay along with the duration —
                           a hand-written `45ms` would survive the preference and leave a
                           reduced-motion reader watching bars appear one at a time.

                           `/ 2` is 45ms a row, and `cardReach()` caps the list at five: the last
                           bar starts at 180ms and the figure has landed by 400ms. Any longer and
                           the stagger stops reading as one gesture and starts reading as a queue
                           the reader is waiting on. */
                        animationDelay: `calc(var(--dur-instant) * ${i} / 2)`,
                      }}
                    />
                  </span>

                  {/* THE COUNT COLUMN — two lines, and the second one is why `recipients` is on
                      `CardReach` at all. "9 opens" alone cannot be judged: nine opens across
                      twelve recipients is a card most people ignored, and nine across one is a
                      card someone keeps coming back to. The ratio is deliberately NOT computed —
                      opens per recipient off a counter with no per-view log is a statistic
                      dressed up as a measurement — but the two numbers sitting one above the
                      other let the reader make that judgement themselves.

                      Suppressed at zero recipients, where "0 recipients" would restate the line
                      above it: "Not shared" already says exactly that, in words. */}
                  <span className="w-24 shrink-0 text-right">
                    <span
                      className={cn(
                        "block text-sm tabular-nums",
                        /* Digits get `--ink` (20.03:1) and absence gets `--ink-3` (5.20:1). The
                           count is the one number this figure states outright, and near-black is
                           the only weight on the row that nothing else uses; spending it on the
                           value is the cheapest emphasis available. The two zero-state phrases
                           are labels rather than measurements and must not compete with the
                           rows that have something to report. */
                        row.opens === 0 ? "text-ink-3" : "font-medium text-ink",
                      )}
                    >
                      {row.opens === 0
                        ? row.recipients === 0
                          ? "Not shared"
                          : "Not opened"
                        : `${row.opens} ${row.opens === 1 ? "open" : "opens"}`}
                    </span>

                    {row.recipients === 0 ? null : (
                      <span className="block text-xs tabular-nums text-ink-3">
                        {row.recipients} {row.recipients === 1 ? "recipient" : "recipients"}
                      </span>
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}
