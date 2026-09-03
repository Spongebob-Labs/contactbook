"use client";

import { Search, X } from "lucide-react";
import type { ChangeEvent } from "react";

import { cn } from "@/lib/cn";
import { Input } from "@/components/primitives/input";

/**
 * The search box above a collection (spec §8D.3 — contacts, and any screen that filters).
 *
 * Controlled and stateless: the screen owns the query, because the screen also owns the
 * decision between `empty` and `empty-filtered` and the two must never disagree.
 *
 * **No debounce and no timer.** A `setTimeout` here would make every downstream state
 * test race the clock for no user-visible gain — there is no request to spare (§3.1).
 *
 * `resultsLabel` is not decoration either: filtering that silently changes a list below
 * the fold is invisible to a screen reader, so the count goes into a polite live region.
 */

export interface SearchFieldProps {
  /** Always supplied, even when hidden — an unlabelled input is a serious axe failure. */
  label: string;
  /** The label is hidden by default; the placeholder is not an accessible name. */
  hideLabel?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Announced politely after filtering, e.g. "2 contacts". */
  resultsLabel?: string;
  clearLabel?: string;
  id?: string;
  name?: string;
  className?: string;
}

export function SearchField({
  label,
  hideLabel = true,
  value,
  onValueChange,
  placeholder = "Search",
  resultsLabel,
  clearLabel = "Clear search",
  id,
  name,
  className,
}: SearchFieldProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onValueChange(event.target.value);
  }

  return (
    <div data-search-field="" className={cn("min-w-0 flex-1 sm:max-w-80", className)}>
      <Input
        id={id}
        name={name}
        type="search"
        label={label}
        hideLabel={hideLabel}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        autoComplete="off"
        leadingAddon={<Search aria-hidden="true" className="size-4" />}
        trailingAddon={
          value ? (
            <button
              type="button"
              aria-label={clearLabel}
              onClick={() => onValueChange("")}
              /* 20px of glyph, 44px of target on touch. `-me-2` pulls the widened box back so
                 the input's trailing gutter does not grow with it and the field keeps its
                 height. */
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-xs text-ink-3 hover:text-ink",
                "max-md:-me-2 max-md:size-11",
              )}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null
        }
      />
      {/* Empty but mounted: a live region only announces changes to a region that was
          already in the accessibility tree when the change happened. */}
      <p role="status" className="sr-only">
        {resultsLabel ?? ""}
      </p>
    </div>
  );
}
