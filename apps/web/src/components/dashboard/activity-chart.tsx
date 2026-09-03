"use client";

import { useState } from "react";

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
 * ## Form and marks
 * Trend over time, one series → columns, one hue, no legend (the title names the series).
 * Nominal-to-ordinal ticks stay `tabular-nums` so the axis aligns; the tooltip carries the
 * value so no column needs a printed number. The grid is a solid hairline one shade off the
 * surface — dashed reads as "threshold" when it is only a grid.
 *
 * The container includes the axis band in its height rather than sizing the plot alone, which is
 * what otherwise gives a card its own tiny nested scrollbar.
 */

const PLOT_H = 132;
const AXIS_H = 22;
/** 2px of surface between adjacent fills, per the mark spec — a gap, never a drawn border. */
const GAP = 2;

function monthDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export interface ActivityChartProps {
  weeks: readonly WeekBucket[];
}

export function ActivityChart({ weeks }: ActivityChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const total = weeks.reduce((sum, w) => sum + w.count, 0);

  if (weeks.length === 0) return null;

  return (
    <figure data-activity-chart="" className="m-0 flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-overline uppercase text-ink-3">Sharing activity</h3>
        <p className="text-sm text-ink-3">
          {total === 0 ? "Nothing shared in this period" : `${total} sent over 12 weeks`}
        </p>
      </figcaption>

      <div
        className="relative flex"
        style={{ height: PLOT_H + AXIS_H }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Recessive grid: solid hairlines, one shade off the surface, behind the marks. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0" style={{ top: 0, height: PLOT_H }}>
          {[0, 0.5, 1].map((t) => (
            <span
              key={t}
              className="absolute inset-x-0 border-t border-line"
              style={{ top: `${t * 100}%` }}
            />
          ))}
        </div>

        <ul className="relative flex flex-1 items-end" style={{ gap: GAP, height: PLOT_H }}>
          {weeks.map((week, i) => {
            const ratio = week.count / max;
            const isHover = hover === i;
            return (
              <li
                key={week.weekStart}
                data-activity-week={week.weekStart}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
              >
                {/* ⚠ **A `<button>`, not an `aria-hidden` span — because on a phone there is no
                    hover and this was the ONLY way to read a value.**

                    The chart prints no number per column by design (the mark spec is right
                    about that), so the count lived exclusively in a tooltip opened by
                    `onMouseEnter`. Touch never fires it. That made twelve weeks of data
                    completely unreadable on the device most of this product's readers use —
                    not degraded, absent.

                    A real button fixes three things at once and adds no visible chrome:
                      · `onPointerDown` opens the tooltip on a tap, so the value is reachable;
                      · `onFocus`/`onBlur` open it from the keyboard, which hover never did;
                      · `aria-label` carries the week and the count, so a screen reader gets the
                        value from the mark itself rather than only from the `sr-only` table.

                    The hit target is still the whole column rather than the bar — a 2px-tall
                    stub is otherwise untappable, which is the usual reason these feel broken. */}
                <button
                  type="button"
                  className="absolute inset-0 cursor-default rounded-[4px]"
                  aria-label={`${week.count} shared, week of ${monthDay(week.weekStart)}`}
                  /* ⚠ A **toggle**, not a set. On touch there is no "leave", so a tapped
                     column has to be dismissable by tapping it again — and tapping a different
                     column moves the tooltip rather than stacking a second one. Clearing on
                     `pointerup` instead would make the tooltip flash and vanish within the
                     same tap, since a tap is a down followed immediately by an up. */
                  onPointerDown={() => setHover((current) => (current === i ? null : i))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
                <span
                  data-activity-bar=""
                  /* ⚠ Capped, and centred in its column. Left to fill the column, twelve bars
                     across a full-width card render ~55px wide and read as a wall of blocks
                     rather than as data — the "thick saturated blocks" the mark spec rules out.
                     The column keeps its full width as the hover target. */
                  className="mx-auto w-full max-w-7 rounded-t-[4px] transition-colors duration-[var(--dur-fast)]"
                  style={{
                    /* A zero week still draws a 2px stub so the axis reads as continuous time
                       rather than as a run of missing columns. */
                    height: week.count === 0 ? 2 : `${Math.max(4, ratio * PLOT_H)}px`,
                    backgroundColor:
                      week.count === 0
                        ? "var(--line)"
                        : isHover
                          ? "var(--ink)"
                          : "var(--ink-2)",
                  }}
                />
                {isHover ? (
                  <span
                    role="status"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-ink-inverse shadow-md"
                  >
                    {`${week.count} shared · week of ${monthDay(week.weekStart)}`}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Selective labels only: the two ends of the range, never a number per column. */}
      <div
        aria-hidden="true"
        className="-mt-[22px] flex justify-between text-xs text-ink-3 tabular-nums"
      >
        <span>{monthDay(weeks[0]!.weekStart)}</span>
        <span>{monthDay(weeks.at(-1)!.weekStart)}</span>
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
