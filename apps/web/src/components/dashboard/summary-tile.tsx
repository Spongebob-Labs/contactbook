import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * The frame the three dashboard summary tiles share: Profile, Cards, Contacts.
 *
 * ## One frame, three tenants, same weight
 *
 * The client asked for "a summary tile" per section in onboarding order. They are drawn from one
 * component so the three cannot drift apart in padding, heading style or link placement. Equal
 * weight is the brief, so no tile gets its own border, fill or type scale.
 *
 * These are the lifted objects on the page (border, `--surface` fill, radius). Everything under
 * them, the sharing analytics, sits flat on the canvas. When both levels were lifted the page
 * had no hierarchy.
 *
 * ## Anatomy
 *
 * - An overline `h2` naming the section, and one quiet link to that section's screen on the
 *   right ("Edit", "View all").
 * - The body, which each tile supplies.
 * - An optional footer, pushed to the bottom with `mt-auto` so the three footers line up across
 *   a row even when the bodies differ in height.
 *
 * `data-dashboard-region` is on the `<section>` itself. The e2e suite measures the tiles by
 * that handle, and a wrapper carrying the same attribute would put two matches on the page.
 */

export interface SummaryTileProps {
  /** `profile` | `cards` | `contacts` — the handle the e2e suite measures by. */
  region: string;
  title: string;
  link?: { label: string; href: string; ariaLabel?: string };
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function SummaryTile({
  region,
  title,
  link,
  children,
  footer,
  className,
}: SummaryTileProps): ReactElement {
  const headingId = `dashboard-${region}-heading`;

  return (
    <section
      data-dashboard-region={region}
      data-summary-tile={region}
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-5 rounded-xl border border-line bg-surface p-5",
        className,
      )}
    >
      {/* A fixed row height, so a tile without a link (an empty one) puts its heading on the
          same line as its neighbours. */}
      <div className="flex h-5 items-center justify-between gap-4">
        <h2 id={headingId} className="text-overline uppercase text-ink-3">
          {title}
        </h2>
        {link ? (
          <Link
            href={link.href}
            aria-label={link.ariaLabel}
            data-summary-tile-link=""
            /* The negative margin buys a 44px touch target without moving the text. */
            className="-my-3 py-3 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            {link.label}
          </Link>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-5">{children}</div>

      {footer ? <div className="mt-auto flex min-w-0 flex-col gap-3">{footer}</div> : null}
    </section>
  );
}

/** The large figure a tile leads with. `null` is a count the API did not send: a dash, never 0. */
export function TileCount({ value, label }: { value: number | null; label: string }): ReactElement {
  return (
    <p data-summary-tile-count="" className="text-h2 tabular-nums text-ink">
      {value === null ? (
        <>
          <span aria-hidden="true">—</span>
          <span className="sr-only">{`${label}: not available`}</span>
        </>
      ) : (
        <>
          {value}
          <span className="sr-only">{` ${label}`}</span>
        </>
      )}
    </p>
  );
}

/**
 * An empty tile's body: the section's icon in the same 64px disc the Profile tile's avatar
 * occupies, and a two- or three-word label. The action is the tile's footer, not a sentence.
 */
export function TileEmpty({
  icon: Icon,
  label,
  handle,
}: {
  icon: LucideIcon;
  label: string;
  /** e.g. `data-cards-tile-empty`: the hook tests address the empty body by. */
  handle: string;
}): ReactElement {
  return (
    <div {...{ [handle]: "" }} className="flex min-w-0 items-center gap-4">
      <span
        aria-hidden="true"
        className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-ink-3"
      >
        <Icon size={22} strokeWidth={1.5} />
      </span>
      <p className="text-base text-ink-2">{label}</p>
    </div>
  );
}
