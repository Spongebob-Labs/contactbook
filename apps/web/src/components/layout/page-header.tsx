import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The page-header pattern every `(app)` screen opens with (spec §8D.3): a
 * `--text-h3` title, an optional `--text-sm` `--ink-3` subtitle,
 * right-aligned actions, and a `--hairline` beneath.
 *
 * The title is an `<h1>` by default because the shell renders no other heading — a page
 * whose first heading is an `<h2>` fails the heading-order rule in T29's axe sweep
 * (AC-25). Pass `headingLevel={2}` only where the header sits inside a page that already
 * has an `<h1>`.
 *
 * Actions are right-aligned with `ms-auto` rather than `justify-between` so a header with
 * no actions does not silently change how the title and subtitle stack.
 */

export interface PageHeaderProps {
  title: ReactNode;
  /** One line of orientation. Omitted entirely when absent — never an empty node. */
  subtitle?: ReactNode;
  /** `--text-overline`, above the title. The breadcrumb-ish line, e.g. "CARD". */
  overline?: ReactNode;
  /** Buttons, right-aligned. Wrap below the title on narrow viewports. */
  actions?: ReactNode;
  headingLevel?: 1 | 2;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  overline,
  actions,
  headingLevel = 1,
  className,
}: PageHeaderProps) {
  const Heading = headingLevel === 2 ? "h2" : "h1";

  return (
    <header
      data-page-header=""
      className={cn(
        "flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-6",
        className,
      )}
    >
      {/* ⚠ `flex-[1_1_16rem]`, not `flex-1`. `flex-1` is a basis of 0, so the row never counted
          as full and never wrapped — on a phone the title was crushed to ~20px beside the
          actions and its subtitle ran out underneath them ("Updated / 1 / Janu / 202" with the
          Edit button on top). A real basis means the actions drop to their own row when both
          cannot fit, and sit beside the title exactly as before wherever they can. */}
      <div className="min-w-0 flex-[1_1_16rem]">
        {overline ? (
          <p
            data-page-header-overline=""
            className="mb-2 text-overline uppercase text-ink-3"
          >
            {overline}
          </p>
        ) : null}

        <Heading className="text-h3 text-ink">{title}</Heading>

        {subtitle ? (
          <p data-page-header-subtitle="" data-prose className="mt-2 text-sm text-ink-3">
            {subtitle}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div
          data-page-header-actions=""
          /* Left-aligned once wrapped onto its own row on a phone — a right-aligned row of
             buttons under a left-aligned title reads as a layout that ran out of room. */
          className="flex flex-wrap items-center gap-3 max-sm:ms-0 sm:ms-auto"
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}
