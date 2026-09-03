import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface StatTileProps {
  label: string;
  /** `null` renders an em dash — "we could not read this", never a confident zero. */
  value: number | null;
  /** One short line under the value. Says what the number means, not what it is called. */
  hint?: ReactNode;
  /** Draws the value in the warning ink when it is non-zero — for counts that mean "act". */
  actionable?: boolean;
  /**
   * This tile spans a full phone row, so **below `sm` it lays out horizontally** — label and
   * hint on the left, the figure ranged right — and returns to the stacked column from `sm` up.
   *
   * ## ⚠ Why the dashboard needs this at all
   *
   * There are **five** tiles and a phone fits **two** across. Five into two leaves a half-empty
   * third row, and a lone tile with a void beside it reads as content that failed to load
   * rather than as the end of a list. The caller closes that row with `col-span-2`, and a box
   * twice as wide as it is tall cannot keep a stacked column without becoming a mostly-empty
   * panel with a number floating at its top-left corner. The two go together.
   *
   * ## ⚠ It is a CSS switch, not a JavaScript one
   *
   * The prop says *"this tile is the one that spans"* — a fact about the layout, known at
   * render time on both server and client. It does **not** say "we are on a phone". Nothing
   * here measures the viewport: the horizontal arrangement is `max-sm:` variants and the
   * stacked one is the base, so the server and the first client pass emit identical markup.
   * A `useMediaQuery` deciding between two DOM shapes is a hydration mismatch, and this
   * codebase fails that by rule (§11 E-45).
   *
   * The mechanism is `display: contents` on the text wrapper plus `order` on the three parts.
   * At `sm` and up the wrapper dissolves, so heading / figure / hint are direct children of the
   * tile in the stacked order; below `sm` — and only when `row` is set — it becomes a real flex
   * column holding heading and hint, with the figure as the second item beside it. One DOM
   * tree, two layouts, nothing rendered twice and nothing hidden.
   */
  row?: boolean;
}

/**
 * One headline number, in its own panel.
 *
 * ## ⚠ Why a panel and not a full-bleed band
 * These used to sit in a `border-y` strip spanning the page. Directly above it `PageHeader`
 * already closes with `border-b`, so the screen opened with a hairline, forty pixels of nothing,
 * then a second hairline — two rules fencing empty space, which reads as a stray banner rather
 * than as content. Discrete panels carry their own edges, so the row needs no rules of its own
 * and the header's rule is the only one on screen.
 *
 * ## Why a tile and not a one-bar chart
 * A single current value is a stat tile; drawing it as a chart adds axes and a plot to carry one
 * number. `choosing-a-form` is explicit about this and it is the most common way a dashboard
 * misses its point.
 *
 * ## ⚠ `font-variant-numeric: normal` is deliberate and load-bearing
 * `globals.css` sets `tabular-nums` on `html` for the whole app, which is right for table rows
 * and axis ticks where digits must align down a column. On a large standalone figure it is
 * wrong — equal-width digits make a value like `121` read loose and gappy at display sizes. This
 * is the one place that opts back out.
 *
 * ## The figure is smaller on a phone, and that is a measured decision
 * `text-4xl` with `px-5 py-4` made every tile 124px tall, so five of them came to **396px** —
 * over half a 640px Android viewport spent on five numbers before a single chart. `text-3xl`
 * and tighter gutters take the same row to ~274px and the figure is still unmistakably display
 * type beside an 11px overline.
 */
export function StatTile({ label, value, hint, actionable = false, row = false }: StatTileProps) {
  const emphasise = actionable && value !== null && value > 0;

  return (
    <div
      data-stat-tile={label}
      data-stat-row={row ? "" : undefined}
      className={cn(
        "flex h-full flex-col rounded-lg border border-line bg-surface",
        "px-4 py-3 sm:px-5 sm:py-4",
        row && "max-sm:flex-row max-sm:items-center max-sm:justify-between max-sm:gap-4",
      )}
    >
      {/* `contents` at every width when stacked, a real flex column only for a spanning tile on
          a phone. See the `row` prop's note for why this is the whole mechanism. */}
      <div
        className={cn(
          "contents",
          row && "max-sm:order-1 max-sm:flex max-sm:min-w-0 max-sm:flex-col max-sm:gap-1",
        )}
      >
        <p className="order-1 text-overline uppercase text-ink-3">{label}</p>

        {/* `mt-auto` pins the hint to the bottom edge, so a row of tiles keeps one baseline even
            when one of them wraps to two lines. Suppressed inside a spanning tile's own column,
            where there is no spare height to push against. */}
        {hint === undefined ? null : (
          <p
            className={cn(
              "order-3 text-sm text-ink-3",
              row ? "sm:mt-auto sm:pt-3" : "mt-auto pt-2 sm:pt-3",
            )}
          >
            {hint}
          </p>
        )}
      </div>

      <p
        data-stat-value=""
        className={cn(
          "order-2 font-sans text-3xl leading-none sm:text-4xl",
          emphasise ? "text-warning-ink" : "text-ink",
          row ? "shrink-0 sm:mt-2" : "mt-2",
        )}
        style={{ fontVariantNumeric: "normal" }}
      >
        {value === null ? "—" : value.toLocaleString()}
      </p>
    </div>
  );
}
