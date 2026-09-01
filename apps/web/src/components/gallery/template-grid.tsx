"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, type ReactElement } from "react";

import { resolveCard } from "@/card/resolve-card";
import { CARD_TYPE_FOR_CATEGORY } from "@/card/template-seed";
import type { CardTemplate } from "@/card/template-types";
import {
  PALETTE_ORDER,
  TEMPLATE_PALETTES,
  type PaletteId,
} from "@/card/template-palettes";
import { TEMPLATE_LIST } from "@/card/templates";
import {
  EmptyFilteredState,
  EmptyState,
  ErrorPanel,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import {
  ALL_CATEGORIES,
  CategoryRail,
  GALLERY_CATEGORY_PARAM,
  clearCategoryHref,
  filterTemplates,
  normaliseCategory,
} from "@/components/gallery/category-rail";
import { TEMPLATE_FRAME_CLASS, TemplateCell } from "@/components/gallery/template-cell";
import { Skeleton } from "@/components/primitives/skeleton";
import { useFixture, type FixtureDb } from "@/lib/fixture-gateway";
import type { CardType, ContactCard, ResolvedCard } from "@/types/domain";

/**
 * `/templates` — the gallery screen (spec §8B.5, §6.1 R-02, AC-30).
 *
 * This is the client half of plan §0.5's two-file screen pattern: `page.tsx` is a server
 * component whose only job is the `<Suspense>` boundary `useSearchParams()` requires, and
 * everything that reads a URL parameter lives here.
 *
 * ## The grid, and the number 200
 * §8B.5: 3-up ≥1024px, 2-up 768–1023px, 1-up below, `--space-10` (40px) gutters, on the
 * `--canvas` ground. The column tracks are capped at **200px** because §6.5 caps a `thumb`
 * at `scale 0.5` of the 400px design canvas — a wider track would not draw a wider card,
 * only a wider empty box around one. See the note in `template-cell.tsx`.
 *
 * ## Why every preview shows the SAME card
 * A gallery is a comparison. Eight previews carrying eight different field sets would
 * compare content, when the only thing that varies between templates is art direction
 * (§8B.1: "a template varies art direction, not anatomy"). So one showcase card is
 * resolved per template with nothing changed but `templateId`, and the reader sees exactly
 * what a template does to a card they already understand.
 *
 * ## The four state families on a screen whose catalogue is static (R-02)
 * The template registry cannot fail, but the profile a preview is rendered *from* arrives
 * through the fixture gateway, so `?state=` reaches all of them honestly:
 *
 * | URL | screen state | what renders |
 * |---|---|---|
 * | `/templates` | `success` | rail + grid |
 * | `?state=loading` | `loading` | frame-shaped bones at the real aspect |
 * | `?state=empty` | `empty` | the **first-run** empty — no showcase card exists |
 * | `?category=…` with no members | `empty-filtered` | the **filtered** empty + Clear filters |
 * | `?state=error` / `offline` | `error` / `offline` | the §6.10 panel + Try again |
 *
 * The rail renders in **every** one of them. It is navigation, it cannot fail, and §8D.1's
 * "partial failure renders what succeeded" applies: a reader who filtered into an empty
 * category needs the rail to get back out.
 */

/** §8B.5's grid. Column tracks are capped at the thumb's real maximum width. */
const GRID_CLASS =
  "grid grid-cols-[repeat(1,minmax(0,200px))] gap-10 " +
  "md:grid-cols-[repeat(2,minmax(0,200px))] lg:grid-cols-[repeat(3,minmax(0,200px))]";

/** Rail column + grid column. The rail re-flows to a row below `md` (see `CategoryRail`). */
const SHELL_CLASS =
  "mx-auto w-full max-w-[var(--content-max)] px-5 pb-16 md:grid " +
  "md:grid-cols-[200px_minmax(0,1fr)] md:gap-10 md:px-8 " +
  "lg:grid-cols-[240px_minmax(0,1fr)] lg:pb-24";

/**
 * The card a preview is rendered from: the richest real card of the requested type.
 *
 * "Richest" rather than `cards[0]` on purpose — `card_empty_demo` maps zero fields, and a grid of
 * nine name-only cards reads as a broken renderer rather than as a deliberately empty card.
 * Choosing by field count can never select it.
 */
function showcaseCardOf(cards: readonly ContactCard[], type: CardType): ContactCard | null {
  const richestOf = (pool: readonly ContactCard[]): ContactCard | null => {
    let best: ContactCard | null = null;
    for (const card of pool) {
      if (best === null || card.fieldIds.length > best.fieldIds.length) best = card;
    }
    return best !== null && best.fieldIds.length > 0 ? best : null;
  };

  /* Falls back to any type rather than rendering an empty grid: a fixture set with no card of
     this type is a fixture problem, and a blank gallery hides it instead of showing it. */
  return richestOf(cards.filter((card) => card.type === type)) ?? richestOf(cards);
}

/**
 * One `ResolvedCard` per PALETTE: the same card, the same template, nine colours.
 *
 * The grid used to iterate templates, which was right while a template *was* a colour. It is
 * not any more — a template is the field preset and a palette is the look, and the thing a
 * person actually browses is the colour. Iterating templates now would show two cards and
 * describe a far smaller product than the nine designs that exist.
 *
 * The rail chooses the template (which fields the previews carry); the grid shows every colour
 * that template can wear.
 *
 * The showcase card is matched to the template's own category so the caption's promise
 * ("starts with your work number and work email") is not made over a preview of the other kind.
 * Which fields a template actually *seeds* is `src/card/template-seed.ts`, applied by the
 * builder; `CARD_TYPE_FOR_CATEGORY` is imported from there so the two cannot disagree about
 * which category is which kind of card.
 */
function previewCards(
  db: FixtureDb,
  template: CardTemplate,
  paletteIds: readonly PaletteId[],
): ResolvedCard[] | null {
  const showcase = showcaseCardOf(db.cards, CARD_TYPE_FOR_CATEGORY[template.category]);
  if (showcase === null) return null;
  const templateId = template.id;
  return paletteIds.map((paletteId) =>
    resolveCard({ ...showcase, templateId, paletteId }, db.user, db.groups, db.fields),
  );
}

export interface TemplateGridSkeletonProps {
  /** Match the number of cells that are coming, so the grid does not reflow (E-13). */
  count?: number;
}

/** The loading family: the real grid, the real frame box, no content (§8D.1). */
export function TemplateGridSkeleton({
  count = PALETTE_ORDER.length,
}: TemplateGridSkeletonProps) {
  return (
    <div className={GRID_CLASS} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex min-w-0 flex-col gap-4">
          <Skeleton data-template-skeleton="" className={`h-auto ${TEMPLATE_FRAME_CLASS}`} />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-2/3 rounded-xs" />
            <Skeleton className="h-3 w-full rounded-xs" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The whole screen in bones — `page.tsx`'s `<Suspense>` fallback and `loading.tsx`'s body.
 *
 * It reproduces the shell's two columns so the rail does not jump sideways when the real
 * one arrives. The rail is a bone rather than the live `<CategoryRail>` because that
 * component reads `useSearchParams()` and would suspend inside its own fallback.
 */
export function TemplateGallerySkeleton() {
  return (
    <div className={SHELL_CLASS} aria-busy="true">
      <div className="md:self-start">
        <Skeleton className="h-3 w-40 rounded-xs" />
        <div className="mt-4 flex flex-wrap gap-2 md:mt-5 md:flex-col md:gap-1">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-28 rounded-full md:w-full" />
          ))}
        </div>
      </div>
      <div className="mt-10 md:mt-0">
        <TemplateGridSkeleton />
      </div>
    </div>
  );
}

function TemplateGridBody({
  paletteIds,
  previews,
  purpose,
}: {
  paletteIds: readonly PaletteId[];
  previews: readonly ResolvedCard[];
  /** What the selected template is for — said once, not once per cell. */
  purpose: string;
}): ReactElement {
  return (
    <>
      <p data-template-purpose="" className="mb-6 text-sm text-ink-3">
        {purpose}
      </p>
      <ul data-template-grid="" className={GRID_CLASS}>
      {paletteIds.map((paletteId, index) => (
        <TemplateCell
          key={paletteId}
          palette={TEMPLATE_PALETTES[paletteId]}
          resolved={previews[index]}
        />
        ))}
      </ul>
    </>
  );
}

export function TemplateGallery(): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, data, error } = useFixture((db) => db);

  const rawCategory = searchParams.get(GALLERY_CATEGORY_PARAM);

  /**
   * The rail selects the TEMPLATE — which fields the previews carry.
   *
   * `null` when a category was given and matched nothing, which is different from no category at
   * all: the first renders the filtered-empty state ("no templates in that category", with a way
   * back out) and the second renders the default template. Collapsing the two — falling back to
   * the first template whenever the filter missed — silently showed the full grid for
   * `?category=nonsense`, so a mistyped filter looked like it had worked.
   */
  const selectedTemplate = useMemo(() => {
    const matches = filterTemplates(rawCategory);
    if (matches.length > 0) return matches[0];
    return normaliseCategory(rawCategory) === ALL_CATEGORIES ? TEMPLATE_LIST[0] : null;
  }, [rawCategory]);

  /* The grid shows every palette, always. Colour is what a person browses here. */
  const visible = PALETTE_ORDER;

  const previews = useMemo(
    () =>
      data === null || selectedTemplate === null
        ? null
        : previewCards(data, selectedTemplate, visible),
    [data, selectedTemplate, visible],
  );

  const screenState = resolveDataScreenState({
    state,
    isEmpty: previews === null || previews.length === 0,
    isFiltered: normaliseCategory(rawCategory) !== ALL_CATEGORIES,
  });

  const clearHref = clearCategoryHref(new URLSearchParams(searchParams.toString()));

  let body: ReactElement;
  if (screenState === "loading") {
    body = <TemplateGridSkeleton count={visible.length} />;
  } else if (screenState === "error" || screenState === "offline") {
    body = (
      <ErrorPanel
        error={error}
        // A boundary would hand us `reset()`; here the screen itself is healthy and only
        // its data failed, so the retry re-renders the route rather than the tree.
        onRetry={() => router.refresh()}
        homeHref="/"
        homeLabel="Go home"
      />
    );
  } else if (screenState === "empty-filtered") {
    body = (
      <EmptyFilteredState
        title="No templates in that category"
        description="Nothing in the catalogue is filed under that. Clear the filter to see all eight."
        onClearFilters={() => router.push(clearHref)}
      />
    );
  } else if (screenState === "empty" || previews === null) {
    body = (
      <EmptyState
        overline="Nothing to preview"
        title="No templates to show"
        description="The catalogue is empty right now. Try again in a moment."
        action={{ label: "Go home", href: "/" }}
      />
    );
  } else {
    body = <TemplateGridBody
        paletteIds={visible}
        previews={previews}
        purpose={selectedTemplate?.blurb ?? ""}
      />;
  }

  return (
    <ScreenStateRoot
      state={screenState}
      as="section"
      aria-label="Card templates"
      className={SHELL_CLASS}
    >
      <CategoryRail />
      <div className="mt-10 md:mt-0">{body}</div>
    </ScreenStateRoot>
  );
}
