"use client";

import Link from "next/link";

import { cn } from "@/lib/cn";

import type { CardReach } from "@/lib/dashboard/metrics";

/**
 * Cards ranked by how often their link has been opened.
 *
 * ## Why every bar is the same colour
 * The categories are card names — **nominal**, not ordered. Shading each bar darker-where-bigger
 * would double-encode length as hue, spend the only free channel on information the bar already
 * carries, and fail the categorical checks by construction. One series, one hue.
 *
 * ## Why the label sits outside the bar
 * A card called "Work" and a card with a 40-character name share this list, and a short bar
 * cannot hold its own label without clipping it. Names live in a fixed column to the left, so
 * nothing is ever cropped and the bars all start from one baseline.
 */

export interface ReachBarsProps {
  rows: readonly CardReach[];
}

export function ReachBars({ rows }: ReachBarsProps) {
  const max = Math.max(1, ...rows.map((r) => r.opens));

  return (
    <figure data-reach-bars="" className="m-0 flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-overline uppercase text-ink-3">Cards by opens</h3>
        <p className="text-sm text-ink-3">How often each link has been opened</p>
      </figcaption>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          /* ⚠ **Stacked on a phone: name above, bar and count below.**
             As one row this was a 112px name column + a 96px count column + two 12px gaps =
             232px of fixed width, leaving the bar itself **64px** at a 320px viewport and 104px
             at 360px. A bar chart whose bars have less room than their own labels has stopped
             encoding anything — every card renders as a stub and the ranking, which is the
             whole point of the figure, becomes unreadable. Stacking gives the bar the full
             width minus the count, so the comparison survives.

             `sm:` restores the single row, where 232px of fixed columns is a fifth of the
             track rather than three quarters of it. */
          <li
            key={row.cardId}
            data-reach-row={row.cardId}
            className="group flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
          >
            <Link
              href={`/cards/${row.cardId}`}
              /* Full measure on a phone, where it owns its own line and a 40-character card
                 name has room to read; the fixed column returns at `sm`. `min-w-0` keeps
                 `truncate` working in both. */
              className={cn(
                "min-w-0 truncate text-sm text-ink underline-offset-4 hover:underline",
                "sm:w-28 sm:shrink-0",
              )}
              title={row.cardName}
            >
              {row.cardName}
            </Link>

            <span className="flex items-center gap-3 sm:contents">
            <span className="relative flex h-5 min-w-0 flex-1 items-center">
              <span
                data-reach-bar=""
                className="h-2 rounded-[4px] transition-colors duration-[var(--dur-fast)] group-hover:bg-ink"
                style={{
                  /* A zero-open card keeps a visible stub: "never opened" is the row worth
                     seeing, and a bar of literally zero width reads as a rendering fault. */
                  width: row.opens === 0 ? "2px" : `${Math.max(2, (row.opens / max) * 100)}%`,
                  backgroundColor: row.opens === 0 ? "var(--line-control)" : "var(--ink-2)",
                }}
              />
            </span>

            <span className="w-24 shrink-0 text-right text-sm text-ink-3 tabular-nums">
              {row.opens === 0
                ? row.recipients === 0
                  ? "Not shared"
                  : "Not opened"
                : `${row.opens} ${row.opens === 1 ? "open" : "opens"}`}
            </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
