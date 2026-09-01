"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import type { CardTemplate } from "@/card/template-types";
import { TEMPLATE_LIST } from "@/card/templates";
import { cn } from "@/lib/cn";

/**
 * The gallery's left category rail — spec §8B.5, measured from the supplied Linktree
 * references rather than inferred.
 *
 * The shape the reference teaches, and the three parts of it that matter:
 *
 *  - an **`--text-overline` label above** the list, wide-tracked and muted, reading
 *    "BROWSE BY CATEGORY". It is written sentence-case and uppercased in CSS: an all-caps
 *    string in the DOM is announced letter by letter by some screen readers, and the
 *    tracking is a type decision, not a content one;
 *  - **full-width pills**, one per category. The active one is a **filled `--ink` pill
 *    with `--canvas` text**; the rest are ghosts at `--ink-3` with no fill at all;
 *  - **links, not buttons.** A category is a URL (`?category=business`), so it is
 *    shareable, back-navigable and reachable with no JavaScript beyond hydration. That
 *    also makes `aria-current="page"` the honest way to mark the active one.
 *
 * Below `md` the rail lays out as a wrapping row above the grid: a 240px vertical rail
 * beside a card column does not fit 360px, and a horizontally scrolling strip would hide
 * categories behind a gesture. It is the same list, re-flowed.
 *
 * ## ⚠ An unrecognised `?category=` filters to nothing — deliberately
 * `?state=` falls back to `success` on an unknown value (§11 E-34) because a blank page is
 * the alternative. A category is different: the honest answer to "show me templates in a
 * category that has none" is the **filtered-to-nothing** empty state with a Clear filters
 * action (§8D.1) — a screen the reader can act on, and the only way that state is
 * reachable at all while every real category has members. It never throws and never blanks.
 */

/** The query parameter the rail reads and writes. */
export const GALLERY_CATEGORY_PARAM = "category";

/** The unfiltered selection. Represented by the *absence* of the parameter in a URL. */
export const ALL_CATEGORIES = "all";

export interface GalleryCategory {
  id: string;
  label: string;
}

/**
 * The rail, in render order.
 *
 * These must be exactly the members of `TemplateCategory`, plus the "all" pseudo-entry.
 *
 * The rail has been wrong twice this way. `Event` sat here and no template ever carried it;
 * `Payment` and `Creative` replaced it and went the same way when the set collapsed to two
 * templates. A filter that always resolves to an empty grid is worse than no filter.
 * `gallery.spec.ts` asserts every rail entry matches at least one template, which is the check
 * that catches it.
 */
export const GALLERY_CATEGORIES: readonly GalleryCategory[] = [
  { id: ALL_CATEGORIES, label: "All templates" },
  { id: "business", label: "Business" },
  { id: "personal", label: "Personal" },
];

/** Trimmed and lower-cased so `?category=Business` behaves; absent or blank means all. */
export function normaliseCategory(raw: string | null | undefined): string {
  if (typeof raw !== "string") return ALL_CATEGORIES;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length === 0 ? ALL_CATEGORIES : trimmed;
}

/**
 * The templates a given category selects, in §8B.3 registry order.
 *
 * Reads `TEMPLATE_LIST` rather than `TEMPLATES_BY_CATEGORY` so the rendering order of the
 * gallery is the registry's declaration order under every filter, including "all".
 */
export function filterTemplates(raw: string | null | undefined): readonly CardTemplate[] {
  const category = normaliseCategory(raw);
  if (category === ALL_CATEGORIES) return TEMPLATE_LIST;
  return TEMPLATE_LIST.filter((template) => template.category === category);
}

/** Keep every other parameter — `?state=` in particular — when the category changes. */
function categoryHref(id: string, params: URLSearchParams): string {
  const next = new URLSearchParams(params.toString());
  if (id === ALL_CATEGORIES) next.delete(GALLERY_CATEGORY_PARAM);
  else next.set(GALLERY_CATEGORY_PARAM, id);
  const query = next.toString();
  return query.length === 0 ? "/templates" : `/templates?${query}`;
}

/** Where "Clear filters" goes: the same screen, unfiltered, review switch intact. */
export function clearCategoryHref(params: URLSearchParams): string {
  return categoryHref(ALL_CATEGORIES, params);
}

const PILL =
  "block w-auto rounded-full px-4 py-2 text-left text-sm transition-colors " +
  "duration-[var(--dur-fast)] ease-out md:w-full";

export function CategoryRail() {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  const selected = normaliseCategory(searchParams.get(GALLERY_CATEGORY_PARAM));

  return (
    <nav
      data-category-rail=""
      aria-label="Template categories"
      className="md:sticky md:top-24 md:self-start"
    >
      <p data-rail-label="" className="text-overline uppercase text-ink-3">
        Browse by category
      </p>

      <ul className="mt-4 flex flex-wrap gap-2 md:mt-5 md:flex-col md:gap-1">
        {GALLERY_CATEGORIES.map((category) => {
          const active = category.id === selected;
          return (
            <li key={category.id} className="w-auto md:w-full">
              <Link
                href={categoryHref(category.id, params)}
                data-rail-item={category.id}
                data-active={active ? "true" : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  PILL,
                  active
                    ? "bg-ink text-canvas"
                    : "text-ink-3 hover:bg-surface-sunk hover:text-ink",
                )}
              >
                {category.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
