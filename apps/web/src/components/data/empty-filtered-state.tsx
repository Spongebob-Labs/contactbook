"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/primitives/button";

/**
 * The **filtered-to-nothing** empty state (spec §8D.1) — deliberately a different
 * component from `EmptyState`, with different copy and a different action.
 *
 * Why it is worth a whole file: the reader here has not failed to create anything. They
 * typed a query. Offering them "Create your first card" is both wrong and slightly
 * insulting, and §8D.1 bans it by name. So this component has **no create action at all**
 * — there is no prop for one, which is the cheapest way to make the mistake unavailable.
 * The only affordance is the one that undoes what they did.
 *
 * Same restraint as its sibling: type, not illustration (§8C).
 */

export interface EmptyFilteredStateProps {
  /** `--text-overline` kicker. */
  overline?: string;
  /** Defaults from `noun`, e.g. "No cards match that filter". */
  title?: string;
  description?: ReactNode;
  /** Plural noun for the collection — "cards", "contacts". Used in the default copy. */
  noun?: string;
  /** The current search text, echoed back so the copy is about what the reader did. */
  query?: string;
  /** Resets every filter and the search box. The one action on this screen. */
  onClearFilters: () => void;
  clearLabel?: string;
  headingLevel?: 2 | 3;
  align?: "start" | "center";
  className?: string;
}

export function EmptyFilteredState({
  overline = "No matches",
  title,
  description,
  noun,
  query,
  onClearFilters,
  clearLabel = "Clear filters",
  headingLevel = 2,
  align = "start",
  className,
}: EmptyFilteredStateProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const resolvedTitle = title ?? (noun ? `No ${noun} match that filter` : "Nothing matches that filter");
  const resolvedDescription =
    description ??
    (query
      ? `Nothing came back for “${query}”. Try a shorter search, or clear the filters to see everything.`
      : "Try a different filter, or clear them all to see everything.");

  return (
    <div
      data-empty-state="filtered"
      className={cn(
        "w-full rounded-lg border border-line bg-surface px-5 py-10 sm:px-8 sm:py-12",
        align === "center" && "text-center",
        className,
      )}
    >
      <div
        data-prose
        className={cn("flex flex-col gap-3", align === "center" && "mx-auto items-center")}
      >
        <p className="text-overline uppercase text-ink-3">{overline}</p>
        <Heading className="text-h3 text-ink">{resolvedTitle}</Heading>
        <p className="text-base text-ink-3">{resolvedDescription}</p>
        <div className={cn("mt-3 flex", align === "center" && "justify-center")}>
          {/* Secondary, not primary: undoing a filter is a correction, not the thing the
              screen wants the reader to do next. */}
          <Button variant="secondary" onClick={onClearFilters}>
            {clearLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
