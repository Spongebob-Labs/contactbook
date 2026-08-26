import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * `StatRow` — the three hairline-ruled stat blocks at the head of `/dashboard`
 * (spec §8D.3: Cards · Contacts · Fields).
 *
 * Flat surfaces separated by hairline rules, never three stacked panels (§8C.2, §8.7): the
 * row carries one rule above and below, the blocks are divided by a vertical hairline on a
 * wide viewport and a horizontal one when they stack. No panel, no frame, no elevation.
 *
 * Marked up as a description list because that is what it is — three terms and their
 * values. A screen reader hears "Cards, 8" rather than two unrelated strings.
 *
 * ⚠ **Type-step note (deviation from the T17 plan row, recorded deliberately).** The plan
 * assigns the value `--text-sm`. §8.4 defines that step as *table* numerics at 13px,
 * one pixel above the block's own 11px overline label — which would leave a stat block with
 * no hierarchy at all, and §8C.2 is explicit that hierarchy comes from size, since weight
 * above 500 is forbidden outside `src/card/templates/**`. The value is therefore set at
 * `--text-h2`, and the half of the plan's instruction that carries the actual
 * requirement — `tabular-nums`, so three blocks align on their digits — is kept.
 */

export interface StatSpec {
  /** Stable, and the value of `data-stat` — the handle the dashboard suite addresses. */
  id: string;
  label: string;
  value: number | string;
  /** Makes the block navigate. Omit for a stat with nowhere to go. */
  href?: string;
}

export interface StatRowProps {
  stats: readonly StatSpec[];
  className?: string;
}

export function StatRow({ stats, className }: StatRowProps) {
  return (
    <dl
      data-stat-row=""
      className={cn(
        "grid grid-cols-1 divide-y divide-line border-y border-line",
        "sm:grid-cols-3 sm:divide-x sm:divide-y-0",
        className,
      )}
    >
      {stats.map((stat) => (
        <div
          key={stat.id}
          data-stat={stat.id}
          className="relative flex flex-col gap-1 px-4 py-5 sm:first:pl-0"
        >
          <dt className="text-overline uppercase text-ink-3">
            {stat.href ? (
              // A stretched link: one tab stop, the whole block clickable, and the accessible
              // name is the label rather than the number.
              <Link
                href={stat.href}
                className="underline-offset-4 hover:text-ink hover:underline after:absolute after:inset-0"
              >
                {stat.label}
              </Link>
            ) : (
              stat.label
            )}
          </dt>
          <dd data-stat-value="" className="text-h2 tabular-nums text-ink">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
