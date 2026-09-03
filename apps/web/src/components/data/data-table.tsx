import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The hairline-ruled collection table (spec §8D.3 — contacts list is why this exists;
 * width is what makes that screen desktop-first, per Q16).
 *
 * **Real `<table>` semantics at ≥768px, and a stacked list below 767px** — the spec drops
 * table semantics on mobile rather than shrinking a three-column table into an unreadable
 * one. That is a *semantic* change, and CSS cannot make a `<table>` stop being a table, so
 * both views are rendered and exactly one of them is `display: none`.
 *
 * That is deliberate, and it is the safe half of the trade:
 * · `display: none` removes a subtree from the accessibility tree, so no screen reader
 *   ever meets the same row twice;
 * · the alternative — branching on `window.innerWidth` — causes a hydration mismatch and
 *   leaves an orphaned view when the breakpoint is crossed, which is the failure §11 E-45
 *   records for the app shell.
 *
 * The table renders rows and nothing else. It has **no empty state of its own**: only the
 * screen knows whether zero rows means first-run or filtered-to-nothing, and those are
 * two different components (§8D.1).
 */

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** The identity column. Becomes the title of each stacked list item below 767px. */
  primary?: boolean;
  align?: "start" | "end";
  /** Header stays in the accessibility tree but is not painted (action columns). */
  hideHeader?: boolean;
  /** Drop this column from the stacked list — width is not the constraint there. */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  /** The table's accessible name, and the list view's `aria-label`. */
  caption: string;
  /** Keep the caption in the accessibility tree and out of the layout. */
  hideCaption?: boolean;
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  /** Makes the primary cell a link. Return `undefined` for a row with no destination. */
  getRowHref?: (row: T) => string | undefined;
  className?: string;
}

function alignClass(align: DataTableColumn<unknown>["align"]) {
  return align === "end" ? "text-right" : "text-left";
}

export function DataTable<T>({
  caption,
  hideCaption = false,
  columns,
  rows,
  getRowKey,
  getRowHref,
  className,
}: DataTableProps<T>) {
  const primaryColumn = columns.find((column) => column.primary) ?? columns[0];
  const secondaryColumns = columns.filter(
    (column) => column !== primaryColumn && !column.hideOnMobile,
  );

  return (
    <div data-data-table="" className={cn("w-full", className)}>
      <table data-table-view="table" className="hidden w-full border-collapse md:table">
        <caption className={cn("pb-3 text-left text-xs text-ink-3", hideCaption && "sr-only")}>
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-line-control">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  "px-3 py-3 text-overline uppercase text-ink-3",
                  alignClass(column.align),
                )}
              >
                <span className={cn(column.hideHeader && "sr-only")}>{column.header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = getRowHref?.(row);
            return (
              <tr key={getRowKey(row)} className="border-b border-line">
                {columns.map((column) => {
                  const content = column.cell(row);
                  return (
                    <td
                      key={column.id}
                      className={cn(
                        "px-3 py-4 text-sm text-ink align-middle",
                        alignClass(column.align),
                      )}
                    >
                      {column === primaryColumn && href ? (
                        <Link href={href} className="text-ink underline-offset-4 hover:underline">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul data-table-view="list" aria-label={caption} className="flex flex-col md:hidden">
        {rows.map((row) => {
          const href = getRowHref?.(row);
          const title = primaryColumn ? primaryColumn.cell(row) : null;
          return (
            /* ⚠ `relative`, paired with the stretched link below. Below `md` this row is a
               ~132px stacked card whose only tap target was the inline name link — about 24px
               tall and only as wide as the name itself, so a four-character contact gave a
               28×24 target inside a 132px box. 82% of the row did nothing. */
            <li
              key={getRowKey(row)}
              className="relative flex flex-col gap-2 border-b border-line py-4"
            >
              <p className="text-base text-ink">
                {href ? (
                  /* `after:absolute after:inset-0` makes the whole `<li>` the hit area while
                     the accessible name stays the row's title and the link stays a single
                     tab stop. Same pattern `card-thumb-tile.tsx` and `stat-row.tsx` use. */
                  <Link
                    href={href}
                    className="text-ink underline-offset-4 after:absolute after:inset-0 hover:underline"
                  >
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </p>
              {secondaryColumns.length > 0 ? (
                <dl className="flex flex-col gap-1">
                  {secondaryColumns.map((column) => (
                    <div key={column.id} className="flex items-baseline gap-2">
                      <dt className="text-xs uppercase text-ink-3">{column.header}</dt>
                      <dd className="text-sm text-ink">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
