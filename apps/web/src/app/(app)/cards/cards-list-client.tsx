"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactElement } from "react";

import { resolveCard } from "@/card/resolve-card";
/* ⚠ TEMPORARY: merges the cover, position and bio the API has no column for. Delete the
   import and the call together the day it does — see `lib/card-local-draft.ts`. */
import { withLocalCardDraft } from "@/lib/card-local-draft";
/* ⚠ TEMPORARY, and owner-facing ONLY — never on a surface a recipient can open. See the
   module note in `lib/card-demo-fill.ts`. */
import { withDemoFill } from "@/lib/card-demo-fill";
import { CARD_TYPE_LABELS, CardThumbTile } from "@/components/app";
import {
  EmptyFilteredState,
  EmptyState,
  ErrorPanel,
  FilterBar,
  LoadingSkeleton,
  ScreenStateRoot,
  SearchField,
  resolveDataScreenState,
  type FilterOption,
} from "@/components/data";
import { PageHeader } from "@/components/layout";
import { buttonClassName } from "@/components/primitives/button";
import { Skeleton } from "@/components/primitives/skeleton";
import { cn } from "@/lib/cn";
import { fetchCardsData } from "@/lib/api/browser-loaders";
import { useApiResource } from "@/lib/use-api";
import type {
  CardType,
  ContactCard,
  FieldGroup,
  FixtureError,
  ProfileField,
  ResolvedCard,
  ScreenState,
  User,
} from "@/types/domain";

/* ── the data this screen renders ─────────────────────────────────────────────────────── */

/**
 * Cards **and** the profile they filter.
 *
 * Both, because a card owns no data (§5.3): `resolveCard` needs the owner's groups and fields to
 * turn a list of field ids into rendered rows. A card list without the profile would render
 * every tile as name-only — which is precisely the bug this screen exists not to repeat.
 */
export interface CardsData {
  user: User;
  groups: FieldGroup[];
  fields: ProfileField[];
  cards: ContactCard[];
}

/**
 * `?state=empty` — no cards at all.
 *
 * The profile is kept: "you have no cards" is a different screen from "you have no fields", and
 * the empty state's action is to *make* a card, which needs a profile to filter.
 */
export function emptyCardsData(real: CardsData): CardsData {
  return { ...real, cards: [] };
}

/**
 * `/cards` — the cards list (spec §8D.3 cards-list row, §6.1 R-10, §4.4 step 2).
 *
 * The client half of plan §0.5's two-file screen pattern: `page.tsx` is a server component
 * whose only job is the `<Suspense>` boundary `useSearchParams()` requires, and everything
 * that reads a URL parameter lives here. The root element carries `data-screen-state`
 * (§13.2) — every state and a11y sweep keys off it.
 *
 * ── ⚠ THE BUG THIS SCREEN EXISTS TO NOT REPEAT ──────────────────────────────────────
 *
 * The old build's `decision-context.md` records card `5a286f9e` shipping with **zero**
 * field mappings and generating a 73-byte `.vcf` — `FN` and `N` and nothing else. Then it
 * got worse: presets were ranked `updatedAt desc`, so the newest card, which is always the
 * freshly-created empty one, was **preselected**, and copying it copied nothing. A user who
 * handed that card out gave people a name and no way to reach anyone (§11.6).
 *
 * This list **keeps the recency ranking on purpose.** `card_empty_demo` maps no fields and
 * is the newest fixture card by `updatedAt`, so it lands in position one — and it arrives
 * wearing `<FieldCountMeter>`'s zero-field warning. Sorting it out of sight would hide the
 * consequence rather than fix it; the fix is that emptiness is legible before the card is
 * ever handed out.
 *
 * `<FieldCountMeter resolved …>` takes a `ResolvedCard`, **not a count**, precisely so a
 * call site cannot re-derive the answer: it reads `canBuildVcf` (T11), the single
 * definition of "this card shares nothing". **Never write an inline `fieldCount > 0` here.**
 * A links-only card is not empty — `fieldCount` counts `fields` *and* `socialFields` — and
 * a local count taken over one of them would warn on a perfectly good card.
 *
 * ── The two empty states are different components, and one of them cannot be misused ──
 *
 * §8D.1 bans conflating "you have not made a card yet" with "your filter matched nothing".
 * `resolveDataScreenState` is handed **this screen's own verdict** on emptiness plus
 * whether a filter is narrowing anything — never `state === 'empty'`, and never a missing
 * `isFiltered`, which would silently downgrade `empty-filtered` to `empty` with no test
 * going red. `EmptyFilteredState` has no create-action prop at the type level, so the
 * banned conflation is uncallable rather than merely discouraged.
 *
 * §11 E-09 goes one step further than the mechanism: when the collection itself is empty,
 * **no filter is responsible for that**, so the first-run empty is the honest verdict even
 * with a query in the box. Hence `isFiltered: isFiltering && cards.length > 0`.
 *
 * ── ⚠ A TILE DRAWS THE CARD, AND NOTHING OF THIS SCREEN'S OWN ────────────────────────
 *
 * Every tile is a live `<CardPage>` at thumbnail scale: the card's cover photograph, its logo,
 * its palette, its rows. **Nothing this list invents may appear inside one.** A "Tap for QR"
 * pill and a flip to a QR face were added on 2026-09-21 and removed the same day — a tile is a
 * picture of the card, and a reader must be able to trust that what they see is what the card
 * is. `<CardThumbTile>` carries the full reasoning.
 *
 * The whole tile is one stretched link to `/cards/{id}`, so a click anywhere on a card opens
 * it. That is also what makes the rule above structural rather than a convention: a control
 * under a full-bleed link is unreachable by pointer, so a tile that navigates cannot also hold
 * a button.
 */

/**
 * The `?q=` deep link. The search box is owned by local state; the URL only **seeds** it,
 * so typing costs no navigation and no re-fetch (§10.1: React state, and only where it
 * belongs). It exists because `empty-filtered` is otherwise reachable only by interaction,
 * and AC-24 / AC-25 sweep that state on this route at three viewports.
 */
const CARDS_QUERY_PARAM = "q";

const NEW_CARD_HREF = "/cards/new";

/** §8D.3: 3-up ≥1280px, 2-up 768–1279px, 1-up ≤767px. */
const GRID_CLASS = "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3";

/**
 * §6.5 caps a `thumb` at `scale 0.5` of the design canvas, so a track wider than 200px draws no
 * more card — only a wider empty box around one.
 *
 * The three widths are `n × 200 + (n − 1) × 24` for the three column counts, which is
 * exactly what `LoadingSkeleton variant="card-grid"` lays out at the same breakpoints.
 * The bones and the tiles therefore occupy the same boxes and nothing shifts when the
 * cards arrive (§8D.1, AC-17).
 *
 * It is also half of §11 E-13: a track that cannot exceed 200px cannot be widened by a
 * 40+ character caption, so one long name can never reflow the grid.
 */
/**
 * ⚠ **The mobile cap and the thumbnail scale step together, and they must stay in step.**
 *
 * The flat `max-w-[200px]` below `md` was stale against `FACE_WIDTH = 336`: it left a 200px card
 * in a 296px content box at 320px and in a 336px box at 360px — **40% of a phone's width empty
 * beside the only object on the screen** — and it squeezed the caption row (type chip + template
 * name + field meter, ~250px of max-content) so hard that the meter always wrapped to a second
 * line. The doc note this replaces still reasoned from a 400px canvas that no longer exists.
 *
 * Three mobile steps, each one the largest card that fits its band with the shell's `px-3`
 * gutter still intact:
 *
 * | viewport | content box | scale | card  | slack |
 * |----------|-------------|-------|-------|-------|
 * | 320      | 296         | 0.82  | 276   | 20    |
 * | 360      | 336         | 0.92  | 309   | 27    |
 * | 414      | 390         | 1.00  | 336   | 54    |
 * | `md` +   | two-up      | 0.595 | 200   | —     |
 *
 * `--card-thumb-scale` is read by `<CardThumbTile>` and by `<CardPageThumb>` inside it; see the
 * note in `share-face.tsx` for why the size is a CSS variable rather than a prop.
 *
 * ⚠ These are **widths**. The tile's height is `TILE_CROP_HEIGHT` in `card-thumb-tile.tsx`;
 * nothing in this table needed re-deriving when the crop grew, which is exactly why the tile
 * kept `FACE_WIDTH` as its width. **The cap and the scale are the same
 * number twice** — the `<ul>`'s `max-w` reserves the column and the scale paints inside it — so
 * changing one without the other gives a card floating in an over-wide track, or a clipped one.
 *
 * §11 E-13 still holds and is what the caps are really for: a track that cannot exceed its
 * band's width cannot be widened by a 40-character caption, so one long name never reflows the
 * grid. That guarantee is about the *cap existing*, not about its being 200px.
 */
const GRID_WIDTH_CLASS = cn(
  "w-full max-w-[276px] [--card-thumb-scale:0.82]",
  "min-[360px]:max-w-[309px] min-[360px]:[--card-thumb-scale:0.92]",
  "min-[414px]:max-w-[336px] min-[414px]:[--card-thumb-scale:1]",
  "md:max-w-[424px] md:[--card-thumb-scale:0.595]",
  "xl:max-w-[648px]",
);

/** §5.1 order, so the chips do not re-order themselves as the fixture set changes. */
const CARD_TYPE_ORDER: readonly CardType[] = ["BUSINESS", "PERSONAL", "PAYMENT", "CUSTOM"];

/**
 * Every card, newest first, resolved once each.
 *
 * `updatedAt` is an ISO-8601 string in every fixture, so a lexicographic compare *is* a
 * chronological one — no `Date` parsing, and no timezone in the middle of a sort.
 */
function resolveAll(data: CardsData): ResolvedCard[] {
  return [...data.cards]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((card) => resolveCard(withDemoFill(withLocalCardDraft(card)), data.user, data.groups, data.fields));
}

/**
 * Search over what the tile actually shows — name, type and template — so a reader can
 * always find a card by something they can see. `needle` arrives already trimmed and
 * lower-cased so the comparison is done once per keystroke rather than once per card.
 */
function matchesQuery(resolved: ResolvedCard, needle: string): boolean {
  if (needle === "") return true;
  return (
    resolved.cardName.toLowerCase().includes(needle) ||
    resolved.template.name.toLowerCase().includes(needle) ||
    CARD_TYPE_LABELS[resolved.cardType].toLowerCase().includes(needle)
  );
}

/** "1 card" / "4 cards" — announced politely after filtering, never only shown. */
function resultsLabel(count: number): string {
  return count === 1 ? "1 card" : `${count} cards`;
}

/**
 * The whole screen in bones — `page.tsx`'s `<Suspense>` fallback and `loading.tsx`'s body.
 *
 * Deliberately generic: `loading.tsx` at this segment also covers `/cards/new` and
 * `/cards/[cardId]` whenever those segments have no nearer `loading.tsx` of their own, so
 * this must not claim to be the cards list in words. It is layout-matched instead — a
 * header block at the header's rhythm, then six bones at `TILE_ASPECT_CLASS`, the tile's own
 * 336×620 (§8D.3's loading column), never a spinner.
 */
export function CardsListSkeleton(): ReactElement {
  return (
    <div className="flex flex-col gap-8 pb-16">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Skeleton className="h-9 w-40 rounded-sm" />
          <Skeleton className="h-4 w-64 max-w-full rounded-xs" />
        </div>
        <Skeleton className="h-11 w-28 rounded-md" />
      </div>
      <LoadingSkeleton
        variant="card-grid"
        count={6}
        label="Loading cards"
        className={GRID_WIDTH_CLASS}
      />
    </div>
  );
}

export function CardsListClient(): ReactElement {
  // `GET /cards` + the profile reads a card is resolved against — all visible in the Network tab.
  const result = useApiResource(fetchCardsData, emptyCardsData);
  return (
    <CardsListScreen
      // Re-mounts when the `?state=` override changes which collection is in play.
      key={result.state}
      state={result.state}
      data={result.data}
      error={result.error}
      reload={result.reload}
    />
  );
}

function CardsListScreen({
  state,
  data,
  error,
  reload,
}: {
  state: ScreenState;
  data: CardsData | null;
  error: FixtureError | null;
  reload: () => void;
}): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * The search box: seeded from `?q=`, owned locally afterwards.
   *
   * The compare-with-previous shape below is React's documented way to adjust state when
   * an input changes — a fresh `?q=` arriving by navigation re-seeds the box and discards
   * what was typed against the *previous* one. It runs during render rather than in an
   * effect, so there is no flash of the stale value.
   *
   * `null` means "nothing typed yet, follow the URL"; `""` means "the reader cleared it",
   * which is why Clear filters sets the empty string and not `null`.
   */
  const urlQuery = searchParams.get(CARDS_QUERY_PARAM) ?? "";
  const [typedQuery, setTypedQuery] = useState<string | null>(null);
  const [seededFrom, setSeededFrom] = useState(urlQuery);
  if (seededFrom !== urlQuery) {
    setSeededFrom(urlQuery);
    setTypedQuery(null);
  }
  const query = typedQuery ?? urlQuery;

  const [selectedTypes, setSelectedTypes] = useState<readonly CardType[]>([]);

  const cards = useMemo(() => (data === null ? [] : resolveAll(data)), [data]);

  /**
   * One chip per `CardType` that actually exists in the collection, counted over the whole
   * collection rather than over the current results — a count that moved while the reader
   * typed would make the chips a moving target, and a chip for a type nobody has is a dead
   * control (§8D.1's rule against inventing a zero).
   */
  const filters = useMemo<readonly FilterOption[]>(() => {
    const counts = new Map<CardType, number>();
    for (const card of cards) {
      counts.set(card.cardType, (counts.get(card.cardType) ?? 0) + 1);
    }
    return CARD_TYPE_ORDER.filter((type) => counts.has(type)).map((type) => ({
      id: type,
      label: CARD_TYPE_LABELS[type],
      count: counts.get(type),
    }));
  }, [cards]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      cards.filter(
        (card) =>
          (selectedTypes.length === 0 || selectedTypes.includes(card.cardType)) &&
          matchesQuery(card, needle),
      ),
    [cards, needle, selectedTypes],
  );

  const isFiltering = needle.length > 0 || selectedTypes.length > 0;

  const screenState = resolveDataScreenState({
    state,
    // This screen's own verdict, never `state === 'empty'`.
    isEmpty: visible.length === 0,
    // §11 E-09: an empty collection is not something a filter did.
    isFiltered: isFiltering && cards.length > 0,
  });

  function toggleType(id: string): void {
    // Narrowed against the enum rather than cast: an id that is not a `CardType` is a bug
    // in the caller, and silently trusting it would put a phantom filter in the state.
    const type = CARD_TYPE_ORDER.find((candidate) => candidate === id);
    if (type === undefined) return;
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((candidate) => candidate !== type)
        : [...current, type],
    );
  }

  function clearFilters(): void {
    setTypedQuery("");
    setSelectedTypes([]);
  }

  /**
   * The filter surface renders where there is something to filter and somewhere to get
   * back to — success, and filtered-to-nothing (§8D.1: the reader who filtered into an
   * empty result needs the way out). It is absent from the first-run empty, which is what
   * makes the wrong empty state unreachable there rather than merely unused.
   */
  const showFilters = screenState === "success" || screenState === "empty-filtered";

  let body: ReactElement;
  if (screenState === "loading") {
    body = (
      <LoadingSkeleton
        variant="card-grid"
        count={6}
        label="Loading cards"
        className={GRID_WIDTH_CLASS}
      />
    );
  } else if (screenState === "error" || screenState === "offline") {
    body = (
      // A boundary would hand us `reset()`; here the screen itself is healthy and only its
      // data failed, so the retry re-renders the route rather than the tree.
      <ErrorPanel
        error={error}
        onRetry={reload}
        homeHref="/dashboard"
        homeLabel="Go to dashboard"
      />
    );
  } else if (screenState === "empty-filtered") {
    body = <EmptyFilteredState noun="cards" query={query} onClearFilters={clearFilters} />;
  } else if (screenState === "empty") {
    body = (
      <EmptyState
        title="You haven't made a card yet"
        description="A card is a filter over your profile: pick the fields you want to share, and the QR code carries those and nothing else."
        action={{ label: "Create your first card", href: NEW_CARD_HREF }}
      />
    );
  } else {
    body = (
      <ul data-cards-grid="" className={cn(GRID_CLASS, GRID_WIDTH_CLASS)}>
        {visible.map((resolved) => (
          <li key={resolved.cardId} className="min-w-0">
            <CardThumbTile
              resolved={resolved}
              href={`/cards/${resolved.cardId}`}
              // The page header is the `<h1>`; a tile heading at `h3` would skip a level.
              headingLevel={2}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    // `section`, never `main`: `AppShell` owns the only `<main id="main">`, and a second
    // `main` landmark fails axe's `landmark-unique` (AC-25).
    <ScreenStateRoot
      state={screenState}
      as="section"
      aria-label="Cards"
      className="flex flex-col gap-8 pb-16"
    >
      <PageHeader
        title="Cards"
        subtitle="Each card shares only the fields you mapped to it."
        actions={
          <Link href={NEW_CARD_HREF} className={buttonClassName()}>
            New card
          </Link>
        }
      />

      {showFilters ? (
        <FilterBar
          label="Filter cards by type"
          filters={filters}
          selectedIds={selectedTypes}
          onToggle={toggleType}
          onClear={clearFilters}
        >
          <SearchField
            label="Search cards"
            value={query}
            onValueChange={(value) => setTypedQuery(value)}
            placeholder="Search cards"
            resultsLabel={resultsLabel(visible.length)}
          />
        </FilterBar>
      ) : null}

      {body}
    </ScreenStateRoot>
  );
}
