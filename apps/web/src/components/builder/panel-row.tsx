import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * One decision, as a row: **name on the left, control ranged right, a hairline between rows.**
 *
 * ## ⚠ Why the Design panel stopped being a single column of stacked blocks
 *
 * It was a heading, a caption, a grid; a heading, a caption, a grid; a heading, a caption, a
 * grid. Every control announced itself at the same volume as every other, each one owned a
 * full-width band of the panel, and the eye had no left edge to run down — so five ordinary
 * choices read as a wall. It was reported as looking childish, and that diagnosis was right
 * about the symptom and generous about the cause: it was not the colours, it was the rhythm.
 *
 * A row layout fixes it with no new colour and no new component:
 *
 * · **A single scan line.** Every label starts at the same x, so the panel can be read as a
 *   list of what is adjustable before any control is looked at. Stacked headings cannot do this
 *   — each one starts a new visual paragraph.
 * · **The control is the exception, not the field.** Ranged right against a common edge, the
 *   swatches and tiles read as answers to the names on the left rather than as five unrelated
 *   galleries.
 * · **Prose stops competing.** A row affords one short hint under its label and no more, which
 *   is the constraint that was missing: the old panel carried four sentences of explanation
 *   above the first swatch and none of them was load-bearing.
 *
 * ## The one rule for a caller
 *
 * **A row holds one axis.** If a control needs a second decision to make sense, that is a second
 * row — never a nested heading inside this one. The hairline is what makes the list a list, and
 * a row with two things in it puts a boundary where the eye does not expect one.
 *
 * Below `sm` the two columns stack, because a 140px label column against a wrapping swatch grid
 * on a phone leaves the control about eight characters of room.
 */

export interface PanelRowProps {
  /** The axis, in the owner's language. Two words where possible. */
  label: string;
  /** One short clause. Omit it rather than restate the label — most rows do not need one. */
  hint?: string;
  /**
   * The current value, rendered small and quiet at the end of the label column.
   *
   * Linktree's Design list does this and it is the detail that makes such a list readable
   * closed: the row says what it controls *and* where it currently stands, so the panel can be
   * scanned for "what have I set" without interpreting five different kinds of swatch.
   */
  value?: string;
  /**
   * `true` on the last row of a group, to suppress its rule.
   *
   * The separator belongs to the row above the gap, not below it, so a group can end without a
   * dangling line above the panel's own padding.
   */
  last?: boolean;
  /** Set when the control is itself a labelled group (a radiogroup); suppresses the `<label>`. */
  id?: string;
  children: ReactNode;
}

export function PanelRow({
  label,
  hint,
  value,
  last = false,
  id,
  children,
}: PanelRowProps): ReactElement {
  return (
    <div
      data-panel-row={id ?? label.toLowerCase()}
      className={cn(
        "grid grid-cols-1 items-start gap-x-6 gap-y-3 py-5",
        "sm:grid-cols-[minmax(7.5rem,10rem)_1fr]",
        last ? null : "border-b border-line",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1 pt-1">
        <span className="text-sm font-medium text-ink">{label}</span>
        {hint === undefined ? null : (
          <span data-prose className="text-xs leading-relaxed text-ink-4">
            {hint}
          </span>
        )}
        {value === undefined ? null : (
          <span data-panel-row-value="" className="text-xs text-ink-3">
            {value}
          </span>
        )}
      </div>

      {/* Ranged right on a common edge — see the module note. `flex-wrap` rather than a grid:
          the clusters have different natural item counts (ten swatches, three tiles, five
          thumbs) and a shared column count would leave gaps in whichever is shortest. */}
      <div className="flex min-w-0 flex-wrap items-start gap-2 sm:justify-end">{children}</div>
    </div>
  );
}

/**
 * A titled run of {@link PanelRow}s.
 *
 * The panel has one `<h2>` (the section head) and these are its `<h3>`s — but set small and
 * quiet, because a group title here is a *divider with a name*, not a headline. Two groups is
 * currently the whole panel; the shape exists so a third does not have to reopen the layout.
 */
export function PanelGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section data-panel-group={title.toLowerCase()} className="flex flex-col">
      <h3 className="pb-1 text-overline uppercase text-ink-4">{title}</h3>
      {children}
    </section>
  );
}
