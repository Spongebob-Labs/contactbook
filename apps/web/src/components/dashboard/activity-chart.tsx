"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

import type { WeekBucket } from "@/lib/dashboard/metrics";

/**
 * Links shared per week — the dashboard's one time series.
 *
 * ## ⚠ Why this is "shared", not "opened"
 * `ShareLink` gives a `viewCount` and two bookend timestamps, **not a log of views**. There is no
 * per-open record anywhere in the API, so an opens-over-time chart cannot be computed and must
 * not be drawn — it would be invented data wearing the authority of a chart. When a link was
 * *created* is a real timestamp, so that is what this plots.
 *
 * That same rule kills everything a reviewer asks for next. No trend line, no rolling average,
 * no "vs. the previous twelve weeks": twelve integers, most of them zero, support none of them,
 * and a fitted line through a sparse count series states a rate nobody measured. What the chart
 * is allowed to add is **scale and emphasis** — which is what everything below is.
 *
 * ## ⚠ The defect this exists to fix: *quiet* rendered as *broken*
 * The real shape of this owner's data is nine or ten empty weeks and then activity at the end.
 * Drawn as twelve flat blocks with no baseline, no scale and no labels, that empty run reads as
 * a rendering fault — a reader cannot tell "nothing happened here" from "this did not load".
 * Three decisions answer it, and they are the reason the markup has four stacked layers:
 *
 * · every run of three or more empty weeks becomes one **labelled quiet band** — an area the
 *   chart claims on purpose, rather than a row of stubs it appears to have failed to draw;
 * · the **baseline is drawn over the band**, the only rule that is. An axis that breaks where
 *   the data goes quiet reads as a missing chunk of chart, which is the same bug wearing a hat;
 * · every zero week still gets its 2px stub, in `--accent` and not `--line`, because that stub
 *   sits on `--surface-sunk` inside the band, where `--line` measures **1.08:1** and simply is
 *   not there — the original defect, reproduced by the one token whose name invites it. See the
 *   Colour section for why the stub takes the deep step rather than the plain columns' own
 *   `--line-control`, which does now clear its floor over the band (3.30:1) and still would not
 *   be right here.
 *
 * ## Why the scale prints two numbers and not five
 * The ceiling rule **is** the peak week — labelled with the peak count, with the tallest column
 * touching it — and the baseline is `0`. Both name a value the series actually reaches. A "nice"
 * ceiling (a peak of 3 rounded up to 5, or to 10) prints a number no week ever hit and shrinks
 * every column to pay for it. The midpoint rule is drawn but deliberately **not** labelled, and
 * only when the peak is 2 or more: half of a peak of 1 is half a link, and the honest label for
 * it does not exist. When nothing was shared at all the ceiling is dropped entirely — `max`
 * falls back to a floor of 1 there, and a "1" on an axis above an empty chart is invented.
 *
 * ## Emphasis instead of twelve equal blocks
 * Exactly one column wears `--accent` and carries its value on the cap: the latest week, or the
 * peak when the latest week is empty. Every other column is `--line-control`. That is still
 * "highlight one, mute the rest", and it is the figure's only direct label — a number over all
 * twelve is noise that goes unread, which is why the per-column value lives in the tooltip and
 * the table.
 *
 * ⚠ **The direction of the emphasis has survived two recolours, and it is the half that is easy
 * to invert.** Emphasis is the DEEPER of the two steps, never the more colourful one: **16.67:1**
 * against the plain column's **3.77:1**, a **4.42:1** gap between the two fills. Flipping it —
 * one bright column standing in a row of deep ones — makes the week being highlighted the
 * LIGHTEST mark in the figure, which reads as unfinished or as a hover state someone left on,
 * not as the answer. Note the gap is wider than either palette this chart has worn: the mint
 * pair stood 2.04:1 apart and the original `--ink`/`--ink-2` pair 1.82:1. One column is now
 * unmistakably the subject.
 *
 * Hue is never a function of `count`. The neighbouring `ReachBars` colours by card identity,
 * which is nominal and has a palette to draw on; a week is not an entity, and its one
 * quantitative channel is already the column's height. Shading darker-where-bigger would
 * double-encode it and spend the only free channel on information the bar already carries. One
 * neutral axis, two steps of it, and every value below taken from `tokens.css` rather than
 * mixed here.
 *
 * ## Colour — the app ladder, and the two grounds it is drawn on
 * This figure spent one revision painted from a `--dash-*` mint scoped to `/dashboard`. The
 * client removed that on 2026-09-20 — cream and beige, uniform with every other screen — so
 * every value here now comes from the Surfaces / Ink / Lines / Accent blocks of `tokens.css`,
 * the same ladder the rest of the app is measured on. Nothing below names a colour: this file
 * names TOKENS and measures against tokens, so a re-derivation of that ladder reaches the chart
 * without an edit here, and the only thing that has to stay true is the reasoning. Every ratio
 * below was recomputed against the cream grounds with `src/lib/contrast.ts`; not one is a mint
 * number carried forward under a new token name.
 *
 * ⚠ **The grounds are `--canvas` and, inside a quiet band, `--surface-sunk`.** There is no panel
 * and no gradient under this figure any more — it draws on the page — so the binding ground is
 * simply `--canvas`, and every number below is measured against it unless it says otherwise. The
 * band is a real second ground, 1.14:1 darker, and it is where the tight pairings live. Nor may
 * anything here assume a white page: `--canvas` sits 1.04:1 off `#FFFFFF`, near enough to look
 * identical and far enough that a mark tuned to exactly 3.00:1 on white ships under the floor.
 *
 * ⚠ **The band no longer breaks the ladder, and that is a change in kind, not in degree.** Under
 * mint, the graphical step measured 2.98:1 over the band — 0.02 under 1.4.11 — so the band had
 * to pull every mark crossing it down to the deep step, and the rule existed because the numbers
 * forced it. On cream both steps survive the band: `--line-control` holds **3.30:1** and
 * `--ink-3` holds **4.55:1** there. So the stub and the baseline still take `--accent`, but for
 * a reason that outlives any palette — hierarchy, argued at each of them below — and a future
 * editor who checks only the numbers will find nothing stopping them and should read on.
 *
 * ⚠ **The ladder is split by threshold and its steps are not interchangeable.**
 * `--line-control` (3.77:1) is the app's control-edge step, derived for 1.4.11's 3:1 and used
 * here for GRAPHICAL objects; `--ink-3` (5.20:1) is the label-and-caption step, derived for
 * 1.4.3's 4.5:1 and used here for TEXT. They are two neutrals a shade apart and they are not one
 * colour: `--line-control` as a label ships 3.77:1 body copy, and `--ink-3` as a fill spends the
 * text step on an area that never needed it. So below, every fill and rule is `--line-control`
 * or `--accent`, and every word is `--ink-3` or `--ink`.
 *
 * Element by element, and why each is the token it is:
 *
 * · **emphasised column → `--accent`** (16.67:1). The app's one dark step, and the only value
 *   in the chrome with enough weight to be the figure's subject on a pale ground. See the
 *   section above for why emphasis is the deeper step and not the brighter one.
 * · **every other column → `--line-control`** (3.77:1, and 3.30:1 where a column crosses a
 *   band). The step derived for precisely this job. It is also why nothing lighter appears in
 *   any fill: `--surface-sunk` and `--line` measure 1.14:1 and 1.23:1 here, which is a ground
 *   and a hairline, not a mark.
 * · **quiet band → `--surface-sunk`**, the app's own well ("sidebar, wells, table zebra"), which
 *   is what this band is. Not `--surface`: at 1.07:1 the shallower fill is a hover response, and
 *   this band is territory the chart claims on purpose — under-claiming it reproduces the exact
 *   "did this load?" reading the band exists to rule out. It is edged in `--line` because the
 *   fill alone is 1.14:1 against the page and the hairline lifts the edge to **1.23:1** for no
 *   added weight. Note this is the band's original cream depth restored, not a new value: the
 *   mint `--dash-track` was borrowed to imitate it and managed only 1.06:1 against its own wash.
 * · **baseline → `--accent`** (16.67:1, and 14.57:1 where it crosses a band). `--line-control`
 *   is the obvious pick now that it clears the band, and it is the one this rule must not use:
 *   it is the colour of every plain column, so an axis drawn in it would be the same value as
 *   the marks standing on it and would dissolve into them. An axis has to out-rank what it
 *   measures. That is also the distinction the pre-mint `--line-control` baseline carried when
 *   the columns were `--ink-2`, so the hierarchy between layer 1 and layer 3 is unchanged.
 * · **gridlines → `--line`** (1.23:1 — decorative and 1.4.11 exempt, which is the point: these
 *   recede). This is the token's home ground; the mint substitute existed only because `--line`
 *   dropped to 1.18:1 on the wash and 1.11:1 over the mint track. Over a cream band it measures
 *   **1.08:1**, which is why the band is opaque and covers the gridlines it spans rather than
 *   letting them fade out inside it.
 * · **secondary text → `--ink-3`** (5.20:1, and **4.55:1** on the band — the tightest pairing in
 *   the figure and still over 4.5). That tightness is by construction: `tokens.css` sizes
 *   `--ink-3` against `--surface-sunk` because it is the worst ground in the system, so the
 *   band is the ground the token was cut for rather than one it happens to survive.
 * · **the two printed numbers → `--ink`** (20.03:1). The cap value and the emphasised end date
 *   stay near-black deliberately. With the rest of the chrome on `--ink-3`, near-black is
 *   unique among the words in the figure, and spending that uniqueness on the one number the
 *   chart states outright is the cheapest emphasis available.
 * · **tooltip ground → `--ink`, unchanged through both recolours.** `--accent` is the token for
 *   a ground carrying white text and was the tempting choice; measured, it is the worse of the
 *   two here — 4.42:1 against the `--line-control` bars the box floats across, where `--ink` is
 *   **5.31:1**, and 1.00:1 against the emphasised column, where `--ink` is 1.20:1. ⚠ That 1.20
 *   is the one place in the figure a mark does not separate from what is behind it: over its own
 *   emphasised column the box is carried by `shadow-md` and by 20.86:1 white text, not by a
 *   luminance step. It is the price of putting emphasis on the app's dark axis, it is bounded to
 *   one column in twelve, and `--accent` would make it total rather than merely close.
 *
 * ## Marks
 * Columns cap at 24px thick with a 4px rounded data-end, 2px of surface between neighbours (a
 * gap, never a drawn border), and solid hairline gridlines one shade off the surface — dashed
 * reads as "threshold" when it is only a grid. The fill **darkens toward the cap**, never away
 * from it: a bar's data-end is its value, and fading the end that is being read is exactly how
 * a gradient makes a length ambiguous. `reach-bars.tsx` refuses a gradient toward its card
 * ground for the same reason.
 *
 * ⚠ **Which END of that gradient is anchored is the decision, and it is the foot.** This
 * originally lightened the FOOT, mixing it 28% toward `--canvas`, which was free at `--ink-2`'s
 * 10.98:1 — the lightened foot still measured 5.16:1. `--line-control` is derived at 3.77:1, only
 * 0.77 over 1.4.11's floor, and the same 28% mix measures **2.48:1**: the bottom of every plain
 * column out of contrast. (A 5% mix does survive, at 3.49:1, so unlike the mint step the failure
 * is not instant — which is exactly why the rule is stated as a rule and not left to whoever
 * next reaches for a softer foot.) The foot is pinned at the token and the CAP is deepened
 * instead — 10% `--ink`, putting a plain column's cap at #787066 (**4.68:1**) and the emphasised
 * column's at #0B1821 (**17.28:1**). The lightest pixel of any column is therefore exactly the
 * value its token was derived at. 10% and no more because **a short column is all cap**: at 10%
 * a 4px plain column still sits **3.56:1** away from `--accent` and cannot be misread as the
 * emphasised one — far more headroom than the 1.62:1 the mint pair left, and the failure a
 * deeper cap walks into is the same one.
 *
 * ## Motion
 * The columns rise once, staggered left to right. There is deliberately **no local
 * `prefers-reduced-motion` block**: `globals.css` §3b implements reduced motion once by zeroing
 * the duration tokens and forbids a second block anywhere in this codebase. So the duration is
 * `var(--dur-base)` and the stagger is a multiple of `var(--dur-instant)` — both collapse to
 * `0ms` under the preference, delay included, which a hand-written `240ms` would not.
 * `animation-fill-mode: backwards`, never `forwards`: the landed state is the default, so a
 * chart with animations disabled (the e2e harness, print) paints fully rather than not at all.
 *
 * The container includes the axis band in its height rather than sizing the plot alone, which is
 * what otherwise gives a card its own tiny nested scrollbar.
 */

/* ── Geometry ─────────────────────────────────────────────────────────────────────────────
   `CAP_BAND` is the one that is easy to drop and the one that breaks the figure: the
   emphasised column prints its value above its own cap, and a peak column drawn to the full
   plot height puts that number on top of the caption. Bars are scaled against `BAR_MAX`, the
   band is headroom, and the ceiling gridline sits at `BAR_MAX` rather than at the top edge — so
   the rule, the tallest cap and the axis label all land on one line. */
const BAR_MAX = 128;
const CAP_BAND = 20;
const PLOT_H = BAR_MAX + CAP_BAND;
const AXIS_H = 22;
/** 2px of surface between adjacent fills, per the mark spec — a gap, never a drawn border. */
const GAP = 2;

/* React 19 hoists `<style href precedence>` into `<head>` and dedupes by `href`, so this
   renders once however many charts mount — the same mechanism `auth-step-form.tsx` and the
   overlay sheet use. A keyframe cannot be expressed as an inline style, and `globals.css`
   is not this component's file to edit. */
export const ACTIVITY_STYLE_HREF = "contactbook-activity-chart";

export const ACTIVITY_CSS = `
@keyframes cb-activity-rise {
  from { transform: scaleY(0); }
}
[data-activity-bar] {
  transform-origin: bottom;
  animation: cb-activity-rise var(--dur-base) var(--ease-out) backwards;
}
`;

function monthDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * A run of empty weeks long enough to be worth naming.
 *
 * ⚠ **Three, and every run — not just the leading one.** The shape that prompted this is nine
 * quiet weeks followed by activity, so banding only the head would have covered it. But a
 * window that ran hot and then stopped is the *more* actionable version of the same fact, and
 * with only the head banded that owner sees a grey block on the left and four unexplained stubs
 * on the right — one rule applied twice, which reads as a bug rather than as a rule. Three is
 * the floor because one or two empty columns between two real ones is legible as a gap and does
 * not need a box built around it.
 */
const MIN_QUIET_RUN = 3;

interface QuietRun {
  /** Index of the first empty week in the run. */
  start: number;
  /** How many consecutive empty weeks it covers. */
  span: number;
}

function quietRuns(weeks: readonly WeekBucket[]): readonly QuietRun[] {
  const out: QuietRun[] = [];
  let start = -1;
  /* `<=` so the loop's last turn closes a run that reaches the end of the window. */
  for (let i = 0; i <= weeks.length; i += 1) {
    const empty = i < weeks.length && weeks[i]!.count === 0;
    if (empty && start === -1) start = i;
    if (!empty && start !== -1) {
      if (i - start >= MIN_QUIET_RUN) out.push({ start, span: i - start });
      start = -1;
    }
  }
  return out;
}

/**
 * Where a run of columns starts and how wide it is, in the same track the columns are laid out
 * in — as CSS, so the band re-measures with the card instead of being told a pixel width.
 *
 * A band has to line up with its columns exactly or it reads as a misplaced rectangle rather
 * than as those weeks. The columns are `flex-1` siblings with a `GAP` between them, so one
 * column is `(100% - (count - 1) * GAP) / count`; column `i` starts after `i` of those and `i`
 * gaps, and a run of `span` of them is `span` columns plus the `span - 1` gaps it swallows. It
 * therefore stops flush with its last quiet column, leaving the real 2px gap before the week
 * that has data.
 */
function trackSpan(run: QuietRun, count: number): { left: string; width: string } {
  const column = `((100% - ${(count - 1) * GAP}px) / ${count})`;
  return {
    left: `calc(${column} * ${run.start} + ${run.start * GAP}px)`,
    width: `calc(${column} * ${run.span} + ${(run.span - 1) * GAP}px)`,
  };
}

/**
 * ⚠ Measured, not clipped. A band is `span / 12` of the track, which in a 320px card is **58px
 * for three columns** against 47px for "Quiet" and its padding — it fits, and a sentence would
 * not. So each label is only offered at a width that can hold it, and `MIN_QUIET_RUN` is the
 * floor it is partly for this reason: the narrowest band that can exist still clears its own
 * shortest label at the narrowest card. Truncating instead would crop the one word explaining
 * the empty area, which is worse than no word at all.
 */
function quietLabelFor(run: QuietRun): string {
  /* A run spanning every week cannot reach here: a chart with nothing in it is drawn as one
     stated blank instead of a plot (see `ActivityChart`). */
  if (run.span >= 5) return `${run.span} quiet weeks`;
  return "Quiet";
}

/**
 * Not "Sharing activity": the chart sits under the dashboard's "Sharing" heading, and it counts
 * links created per week, which is what the heading now says.
 */
const ACTIVITY_HEADING = "Links shared per week";

export interface ActivityChartProps {
  weeks: readonly WeekBucket[];
}

export function ActivityChart({ weeks }: ActivityChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  if (weeks.length === 0) return null;

  const total = weeks.reduce((sum, w) => sum + w.count, 0);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  /* `max` floors at 1 so the ratio maths never divides by zero — which makes it a number the
     data may never have reached, and therefore never printable. This flag is what gates it. */
  const hasData = total > 0;

  const lastIndex = weeks.length - 1;
  const peakIndex = weeks.reduce((best, week, i) => (week.count > weeks[best]!.count ? i : best), 0);
  /* The endpoint is the story when there is one; when the latest week is empty, the peak is. */
  const emphasis = !hasData ? null : weeks[lastIndex]!.count > 0 ? lastIndex : peakIndex;

  const quiet = quietRuns(weeks);

  /* ⚠ **Nothing shared in the whole range is one stated blank, not an empty plot.** Twelve
     zero-height columns under a full-width quiet band drew a 190px object that said one thing,
     beside a "Cards by opens" figure that already says the same thing in one line. The two
     now share one treatment, so the row reads as two answers of equal weight. */
  if (!hasData) {
    return (
      <figure data-activity-chart="" data-activity-chart-empty="" className="m-0 flex flex-col gap-3">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h3 className="text-overline uppercase text-ink-3">{ACTIVITY_HEADING}</h3>
        </figcaption>
        <p className="rounded-md border border-line bg-surface px-4 py-6 text-center text-sm text-ink-3">
          {`Nothing shared in the last ${weeks.length} weeks`}
        </p>
      </figure>
    );
  }

  return (
    <figure data-activity-chart="" className="m-0 flex flex-col gap-3">
      <style href={ACTIVITY_STYLE_HREF} precedence="default">
        {ACTIVITY_CSS}
      </style>

      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-overline uppercase text-ink-3">{ACTIVITY_HEADING}</h3>
        <p className="text-sm text-ink-3 tabular-nums">
          {`${total} shared · ${max} in the busiest week`}
        </p>
      </figcaption>

      <div
        className="flex gap-2"
        style={{ height: PLOT_H + AXIS_H }}
        onMouseLeave={() => setHover(null)}
      >
        {/* ⚠ **The scale, in its own gutter rather than floating over the plot.**
            Ticks drawn inside the plot sit on top of the leftmost column, and at twelve columns
            in a half-width card that column is ~24px wide — the label covers the mark it is
            meant to explain. Both numbers are `translate-y-1/2` so the digits centre on their
            rule instead of hanging above it. `aria-hidden`: the table below carries every value,
            and a screen reader reading "3, 0" out of context explains nothing. */}
        <div aria-hidden="true" className="relative w-7 shrink-0" style={{ height: PLOT_H }}>
          {hasData ? (
            <span
              className="absolute right-0 translate-y-1/2 text-xs text-ink-3 tabular-nums"
              style={{ bottom: BAR_MAX }}
            >
              {max}
            </span>
          ) : null}
          <span
            className="absolute right-0 bottom-0 translate-y-1/2 text-xs text-ink-3 tabular-nums"
          >
            0
          </span>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height: PLOT_H }}>
            {/* Layer 1 — the recessive grid. Solid hairlines, one shade off the surface. The
                ceiling is the peak, so the tallest column's cap lands exactly on it.
                `--line`, on the ground it was sized against: **1.23:1** on `--canvas`, the
                ~1.2:1 weight this grid has always had. It is the mint substitute that was the
                deviation, needed only because `--line` fell to 1.18:1 on that wash. Over a quiet
                band it drops to 1.08:1, which is why the band is opaque rather than translucent
                — see layer 2 and the Colour section. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {hasData ? (
                <span
                  className="absolute inset-x-0 border-t border-line"
                  style={{ bottom: BAR_MAX }}
                />
              ) : null}
              {hasData && max >= 2 ? (
                <span
                  className="absolute inset-x-0 border-t border-line"
                  style={{ bottom: BAR_MAX / 2 }}
                />
              ) : null}
            </div>

            {/* Layer 2 — the quiet runs, claimed. Opaque, so each covers the gridlines it
                spans: a scale is a promise that there is something to measure, and across these
                weeks there is not. See `MIN_QUIET_RUN` for why three, and why every run.

                `--surface-sunk` is the band and `--line` is its edge. The fill is **1.14:1**
                against `--canvas` and the hairline lifts the edge to **1.23:1** for no added
                weight — see the Colour section for why the shallower `--surface` (1.07:1) is a
                hover response and not a claim on territory. The border is inside the box:
                Tailwind v4's preflight puts everything in `border-box`, so the 1px does not move
                the band off its columns. */}
            {quiet.map((run) => {
              const { left, width } = trackSpan(run, weeks.length);
              return (
                <div
                  key={run.start}
                  aria-hidden="true"
                  data-activity-quiet={run.span}
                  className="pointer-events-none absolute bottom-0 flex items-center justify-center rounded-[6px] border border-line bg-surface-sunk"
                  style={{ height: BAR_MAX, left, width }}
                >
                  <span className="px-2 text-center text-xs text-ink-3 tabular-nums">
                    {quietLabelFor(run)}
                  </span>
                </div>
              );
            })}

            {/* Layer 3 — the baseline, and the one rule painted OVER the band. `--accent`
                rather than `--line`: this is the axis every column is measured from, not a
                gridline, and at **1.08:1** the decorative hairline vanishes against the band it
                has to cross. `--line-control` is the step that normally carries a graphical rule
                and it does clear the band (3.30:1), but it is the fill of every plain column —
                an axis drawn in the colour of the marks standing on it dissolves into them. The
                deep step keeps the axis above what it measures: **16.67:1**, and **14.57:1**
                where it crosses a band. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-accent"
            />

            {/* Layer 4 — the marks. */}
            <ul className="absolute inset-x-0 bottom-0 flex items-end" style={{ gap: GAP, height: BAR_MAX }}>
              {weeks.map((week, i) => {
                const barH = week.count === 0 ? 2 : Math.max(4, (week.count / max) * BAR_MAX);
                const isHover = hover === i;
                const isLead = i === emphasis;
                const base = isLead ? "var(--accent)" : "var(--line-control)";
                return (
                  <li
                    key={week.weekStart}
                    data-activity-week={week.weekStart}
                    className="relative flex h-full flex-1 items-end"
                    onMouseEnter={() => setHover(i)}
                  >
                    {/* ⚠ **A `<button>`, not an `aria-hidden` span — because on a phone there is
                        no hover and this was the ONLY way to read a value.**

                        The chart prints one number per figure by design, so eleven of the twelve
                        counts lived exclusively in a tooltip opened by `onMouseEnter`. Touch
                        never fires it. That made twelve weeks of data completely unreadable on
                        the device most of this product's readers use — not degraded, absent.

                        A real button fixes three things at once and adds no visible chrome:
                          · `onPointerDown` opens the tooltip on a tap, so the value is reachable;
                          · `onFocus`/`onBlur` open it from the keyboard, which hover never did;
                          · `aria-label` carries the week and the count, so a screen reader gets
                            the value from the mark itself rather than only from the `sr-only`
                            table.

                        The hit target is the whole column rather than the bar — a 2px-tall stub
                        is otherwise untappable, which is the usual reason these feel broken —
                        and everything drawn over it is `pointer-events-none`, so a tap that
                        lands on the bar or its label still reaches the button underneath. */}
                    <button
                      type="button"
                      className="absolute inset-0 cursor-default rounded-[4px]"
                      aria-label={`${week.count} shared, week of ${monthDay(week.weekStart)}`}
                      /* ⚠ A **toggle**, not a set. On touch there is no "leave", so a tapped
                         column has to be dismissable by tapping it again — and tapping a
                         different column moves the tooltip rather than stacking a second one.
                         Clearing on `pointerup` instead would make the tooltip flash and vanish
                         within the same tap, since a tap is a down followed immediately by an
                         up. */
                      onPointerDown={() => setHover((current) => (current === i ? null : i))}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                    />
                    <span
                      data-activity-bar=""
                      /* ⚠ Capped at 24px and centred in its column. Left to fill the column,
                         twelve bars across a full-width card render ~55px wide and read as a
                         wall of blocks rather than as data. The column keeps its full width as
                         the hover and tap target.

                         The hover response is a **filter**, not a second fill. The fill is a
                         gradient, and `background-image` does not interpolate — swapping it on
                         hover snaps, and on the zero stub (which has no gradient at all) it
                         would have to be a third code path. One `filter` transition darkens the
                         wash, the emphasised column and the stub alike.

                         ⚠ `brightness(0.78)` is kept, and it is the plain columns it is tuned
                         for: `--line-control` is mid-lightness, so 0.78 lands it on #6B635A —
                         within **1.09** of `--ink-3`, i.e. one rung down the app's own ladder
                         rather than in a colour the design system does not contain — and still
                         **2.94:1** clear of `--accent`, so a hovered plain column is never read
                         as the emphasised one. (The original `0.55` here was cut for near-black
                         fills; it takes `--line-control` to #4B463F, 8.98:1, deeper than any
                         step in the ladder.)

                         ⚠ On the EMPHASISED column the same filter is close to a no-op — 1.06
                         against `--accent`, because near-black cannot usefully darken. That is
                         accepted rather than overlooked: the hover response there is the
                         tooltip, which replaces the value printed on that column's cap, and no
                         multiplier would give a near-black fill a visible hover state. */
                      className={cn(
                        "pointer-events-none mx-auto w-full max-w-6",
                        "transition-[filter] duration-[var(--dur-fast)]",
                        week.count === 0 ? "rounded-[1px]" : "rounded-t-[4px]",
                      )}
                      style={{
                        height: barH,
                        /* Token-derived, so reduced motion zeroes the stagger too — see the
                           Motion note above. ~22ms apart; the last of twelve starts at ~250ms. */
                        animationDelay: `calc(var(--dur-instant) * ${i} / 4)`,
                        /* A zero week still draws a 2px stub so the axis reads as continuous
                           time rather than as a run of missing columns. `--accent`, and the
                           reason is no longer a failing number: `--line-control` clears the band
                           at 3.30:1, but it is the colour of a column that HAS data, so a stub
                           drawn in it reads as a very short bar rather than as nothing. The deep
                           step (14.57:1 over the band) makes the stub a tick on the axis it
                           stands on, which is what a zero week is. `--line` — the token the name
                           invites — measures 1.08:1 there and is the original defect. */
                        backgroundColor: week.count === 0 ? "var(--accent)" : undefined,
                        /* Foot pinned at the token, cap deepened — never the reverse. See
                           "Marks" above: a lightened foot puts `--line-control` under 1.4.11
                           (2.48:1 at the 28% this used to mix). */
                        backgroundImage:
                          week.count === 0
                            ? undefined
                            : `linear-gradient(to top, ${base}, color-mix(in oklab, ${base} 90%, var(--ink)))`,
                        filter: isHover ? "brightness(0.78)" : "none",
                      }}
                    />

                    {/* The figure's one direct label, on the cap of the emphasised column. It
                        steps aside while that column is hovered rather than sitting under its
                        own tooltip, which would print the same number twice, 6px apart. */}
                    {isLead && !isHover ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-xs font-medium text-ink tabular-nums"
                        style={{ bottom: barH + 4 }}
                      >
                        {week.count}
                      </span>
                    ) : null}

                    {isHover ? (
                      <span
                        role="status"
                        /* Anchored to the cap, not to the top of the column: at `bottom-full` a
                           tooltip for a 4px bar floated 130px above it, nowhere near the mark it
                           describes. The floor keeps it clear of the baseline.

                           ⚠ It opens **away from the nearer end of the track**, and is never
                           centred on its column. "3 shared · week of Sep 14" measures ~150px
                           against a 12-column track that is ~240px wide on a phone, so a
                           centred tooltip needs 75px of clearance either side and columns 0–3
                           and 8–11 do not have it: the first ones hang over the scale gutter
                           and the last ones over the card's edge, where the card clips them.
                           Left-anchored on the first half and right-anchored on the second, the
                           box always grows inward and cannot leave the plot at any width this
                           chart is drawn at.

                           ⚠ The ground stays `--ink` rather than `--accent`, and that is a
                           decision rather than a leftover: this box is wider than a column and
                           floats across its neighbours, where `--accent` would measure 4.42:1
                           against the `--line-control` bars behind it and `--ink` measures
                           **5.31:1**. It also matches the cap value, so the two places this
                           chart prints a number look like one voice. ⚠ Over its own emphasised
                           column `--ink` measures only 1.20 — the one pairing in the figure with
                           no luminance step — and the box is held together there by `shadow-md`
                           and by white text at 20.86:1. `--accent` would make that pairing
                           1.00 and lose the box entirely, which is why the worse-looking token
                           is the right one. */
                        className={cn(
                          "pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-ink-inverse shadow-md tabular-nums",
                          i * 2 < lastIndex ? "left-0" : "right-0",
                        )}
                        style={{ bottom: Math.max(barH + 6, 24) }}
                      >
                        {`${week.count} shared · week of ${monthDay(week.weekStart)}`}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Selective labels only: the two ends of the range, never a date per column. The last
              one takes `--ink` when it is the week the emphasised column marks, so the emphasis
              and its date are read as one thing — and with the rest of the chrome on `--ink-3`,
              near-black is what singles it out rather than just weight. */}
          <div
            aria-hidden="true"
            className="flex items-center justify-between text-xs text-ink-3 tabular-nums"
            style={{ height: AXIS_H }}
          >
            <span>{monthDay(weeks[0]!.weekStart)}</span>
            <span className={cn(emphasis === lastIndex && "font-medium text-ink")}>
              {monthDay(weeks[lastIndex]!.weekStart)}
            </span>
          </div>
        </div>
      </div>

      {/* The table view — identity and value never live in the mark alone (a11y pass). */}
      <table className="sr-only">
        <caption>Links shared per week</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart}>
              <th scope="row">{`Week of ${monthDay(w.weekStart)}`}</th>
              <td>{w.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
