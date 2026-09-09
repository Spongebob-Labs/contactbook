"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/primitives/button";
import { Chip } from "@/components/primitives/chip";

/**
 * The filter row above a collection (spec §8D.3 — cards list, contacts list).
 *
 * Two things it exists to guarantee:
 *
 * 1. **Filters are real buttons with `aria-pressed`.** A selectable `<div>` with an
 *    `onClick` is the accessibility failure the `Chip` primitive's `interactive` prop was
 *    written to prevent, and it would cost AC-25 and AC-26 together.
 * 2. **`data-active-filter-count`.** A screen has to know whether a filter is narrowing
 *    the collection in order to choose between the two empty states (§8D.1), and T29's
 *    sweep reads the same attribute to drive a screen into `empty-filtered` without
 *    guessing at chip labels.
 *
 * It holds no state. The screen owns `selectedIds` — the bar is the surface, not the
 * source of truth (§10.1: React state only, and only where it belongs).
 */

export interface FilterOption {
  id: string;
  label: string;
  /** Shown after the label, tabular. Omit rather than render a zero you had to invent. */
  count?: number;
}

export interface FilterBarProps {
  /** Accessible name for the group, e.g. "Filter cards". Not painted. */
  label: string;
  filters: readonly FilterOption[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  clearLabel?: string;
  /** A `SearchField`, usually — rendered before the chips. */
  children?: ReactNode;
  className?: string;
}

export function FilterBar({
  label,
  filters,
  selectedIds,
  onToggle,
  onClear,
  clearLabel = "Clear filters",
  children,
  className,
}: FilterBarProps) {
  const selected = new Set(selectedIds);

  return (
    <div
      data-filter-bar=""
      data-active-filter-count={selectedIds.length}
      className={cn(
        "flex w-full flex-wrap items-center gap-x-6 gap-y-3 border-b border-line pb-4",
        className,
      )}
    >
      {children}

      <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <Chip
            key={filter.id}
            interactive
            selected={selected.has(filter.id)}
            onClick={() => onToggle(filter.id)}
          >
            {filter.label}
            {typeof filter.count === "number" ? (
              // No opacity dimming here: axe scores colour-contrast as *serious*, and a
              // faded count inside a chip is the cheapest way to lose AC-25.
              /* ⚠ A REAL SPACE CHARACTER, NOT A MARGIN — and the difference is the accessible
                 name. The chip shipped reading "Added by you4", because `Chip` puts every child
                 inside ONE `<span>` (see its `body`) so the `gap-2` on its flex shell never
                 falls between this count and the label. A margin would have fixed the pixels
                 and left the name jammed: `innerText` stays "Added by you4", and that string is
                 what a screen reader announces and what a test can see. */
              <>
                {" "}
                <span className="tabular-nums">{filter.count}</span>
              </>
            ) : null}
          </Chip>
        ))}
      </div>

      {/* Nothing to clear, nothing to render — an always-present dead control is noise. */}
      {selectedIds.length > 0 ? (
        <Button variant="text-link" onClick={onClear} className="ml-auto">
          {clearLabel}
        </Button>
      ) : null}
    </div>
  );
}
