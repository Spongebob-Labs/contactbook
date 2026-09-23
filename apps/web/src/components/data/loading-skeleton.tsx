import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/primitives/skeleton";

/**
 * The loading family (spec §8D.1): **layout-matched skeletons, never a spinner.**
 *
 * A spinner says "something is happening" and then the page jumps. A skeleton says
 * "content of this shape is coming" and then nothing moves, which is the whole point —
 * AC-17 measures CLS 0 on the two routes that matter and every reflow here is a defect
 * there.
 *
 * So each variant below is not decoration: it is the real box of the real content, taken
 * from the per-screen loading column of §8D.3. The card bone in particular holds the
 * card's exact 400×860 design ratio (§8D.4), because a square placeholder for a tall
 * card is the single largest shift this application could produce.
 *
 * The shimmer belongs to the `Skeleton` primitive and freezes under reduced motion via
 * the one central rule in `globals.css` (AC-27). Nothing here knows about that.
 */

export type LoadingSkeletonVariant =
  | "card"
  | "card-grid"
  | "card-detail"
  | "list"
  | "table"
  | "stats"
  | "fields"
  | "groups"
  | "form";

/** The card's design box (§8D.4). Exported so a screen can hold the same slot. */
/* Matches the gallery tile so bones and cards occupy the same box and nothing shifts on load. */
export const CARD_ASPECT_CLASS = "aspect-[336/500]";

/**
 * The **list tile's** box, which is taller than the card's — and the two are separate constants
 * on purpose.
 *
 * `CARD_ASPECT_CLASS` is the share face's 336×500 and still is: the gallery's template cells and
 * the builder's Design-panel swatches are that shape. A tile on `/cards` is not; it opens its
 * window to `TILE_CROP_HEIGHT` (620) so a reader sees field rows and not just the hero, and then
 * draws its own bottom edge. See `card-thumb-tile.tsx`.
 *
 * ⚠ Restated as a literal rather than imported from `@/components/app`: `cn` needs the class
 * name at build time for Tailwind to emit the rule, and a `data`-driven arbitrary value would be
 * silently dropped. If `TILE_CROP_HEIGHT` moves, this moves with it — AC-17 is the whole point
 * of this file, and bones at the wrong aspect shift the grid the moment the cards arrive.
 */
export const TILE_ASPECT_CLASS = "aspect-[336/620]";

/** Sensible repeat counts, taken from the §8D.3 loading column. */
const DEFAULT_COUNTS: Record<LoadingSkeletonVariant, number> = {
  card: 1,
  "card-grid": 6,
  "card-detail": 5,
  list: 8,
  table: 8,
  stats: 3,
  fields: 5,
  groups: 3,
  form: 4,
};

const GRID_COLUMNS: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
};

export interface LoadingSkeletonProps extends Omit<ComponentPropsWithRef<"div">, "children"> {
  variant?: LoadingSkeletonVariant;
  /** How many bones to repeat. Match the real collection length where you know it. */
  count?: number;
  /** Announced politely while the region is busy. Say what is loading, in words. */
  label?: string;
  /** Columns for `card-grid` at the widest breakpoint (§8D.3: 3-up ≥1280px). */
  columns?: 1 | 2 | 3;
}

/** One card-shaped bone at the real aspect. */
function CardBone({ className, aspect = CARD_ASPECT_CLASS }: { className?: string; aspect?: string }) {
  return (
    <Skeleton
      data-skeleton-card=""
      // `h-auto` matters: the primitive's block variant is `h-full`, which would win over
      // the aspect ratio and collapse the bone inside a grid row.
      className={cn("h-auto w-full rounded-xl", aspect, className)}
    />
  );
}

/** A repeated row: the wrapper carries `data-skeleton-row` so counts are assertable. */
function Rows({ count, children }: { count: number; children: (index: number) => ReactNode }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} data-skeleton-row="">
          {children(index)}
        </div>
      ))}
    </>
  );
}

function Bones({ variant, count, columns }: Required<Pick<LoadingSkeletonProps, "variant" | "count" | "columns">>) {
  switch (variant) {
    case "card":
      return <CardBone className="mx-auto max-w-[400px]" />;

    case "card-grid":
      return (
        <div className={cn("grid gap-6", GRID_COLUMNS[columns])}>
          {/* The list tile's aspect, not the face's — see {@link TILE_ASPECT_CLASS}. */}
          <Rows count={count}>{() => <CardBone aspect={TILE_ASPECT_CLASS} />}</Rows>
        </div>
      );

    case "card-detail":
      // Card pinned left, metadata and field rows right (§8D.3 card detail).
      return (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <CardBone />
          <div className="flex flex-col gap-6">
            <Skeleton className="h-8 w-1/2 rounded-sm" />
            <div className="flex flex-col">
              <Rows count={count}>
                {() => (
                  <div className="flex flex-col gap-2 border-b border-line py-4">
                    <Skeleton className="h-3 w-24 rounded-xs" />
                    <Skeleton className="h-4 w-2/3 rounded-xs" />
                  </div>
                )}
              </Rows>
            </div>
          </div>
        </div>
      );

    case "list":
      return (
        <div className="flex flex-col">
          <Rows count={count}>
            {() => (
              <div className="flex items-center gap-4 border-b border-line py-4">
                <Skeleton variant="circle" className="size-10 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/3 rounded-xs" />
                  <Skeleton className="h-3 w-1/4 rounded-xs" />
                </div>
              </div>
            )}
          </Rows>
        </div>
      );

    case "table":
      /**
       * ⚠ **The bones stack below `md`, because `<DataTable>` does.**
       *
       * `data-table.tsx` renders a real `<table>` from `md` up and a stacked `<ul>` of cards
       * below it (`hidden md:table` against `flex flex-col md:hidden`). This variant drew the
       * three-column row at every width, so on a phone it reserved a **48px** row against the
       * ~132px stacked card that replaced it — nine rows of that is **~650px of layout shift**
       * on `/contacts` the moment the data lands, on a column whose entire purpose (§8D.1,
       * AC-17) is that nothing moves.
       *
       * The header bones go with it: there is no header row in the stacked view, so drawing one
       * reserves a 3px band that nothing ever fills.
       */
      return (
        <div className="flex flex-col">
          <div className="hidden gap-6 border-b border-line pb-3 md:flex">
            <Skeleton className="h-3 w-32 rounded-xs" />
            <Skeleton className="h-3 w-28 rounded-xs" />
            <Skeleton className="h-3 w-20 rounded-xs" />
          </div>
          <Rows count={count}>
            {() => (
              <div className="flex flex-col gap-2 border-b border-line py-4 md:flex-row md:gap-6">
                <Skeleton className="h-4 w-40 rounded-xs" />
                {/* The stacked card's `<dl>`: three label/value pairs at `gap-1`, which is the
                    height the phone row actually is. From `md` up these are the second and
                    third table columns and sit on the same line as the first. */}
                <div className="flex flex-col gap-1 md:flex-row md:gap-6">
                  <Skeleton className="h-4 w-32 rounded-xs" />
                  <Skeleton className="h-4 w-24 rounded-xs" />
                  <Skeleton className="h-4 w-28 rounded-xs md:hidden" />
                </div>
              </div>
            )}
          </Rows>
        </div>
      );

    case "stats":
      // Three hairline-ruled stat blocks in a row (§8D.3 dashboard).
      return (
        <div className="grid grid-cols-1 border-t border-line sm:grid-cols-3">
          <Rows count={count}>
            {() => (
              <div className="flex flex-col gap-3 border-b border-line px-6 py-6 sm:border-r">
                <Skeleton className="h-3 w-20 rounded-xs" />
                <Skeleton className="h-9 w-16 rounded-sm" />
              </div>
            )}
          </Rows>
        </div>
      );

    case "fields":
      /**
       * ⚠ **The action cluster is boned below `lg`, because that is where it wraps to its own
       * row.** `ProfileFieldRow` stacks below `lg`: label, value, then a wrapped cluster of up
       * to six 44px controls. Without a bone for that cluster this variant reserved 68px
       * against a ~168px row, so `/profile/groups/[groupId]` jumped ~500px on load.
       */
      return (
        <div className="flex flex-col">
          <Rows count={count}>
            {() => (
              <div className="flex flex-col gap-2 border-b border-line py-4">
                <Skeleton className="h-3 w-24 rounded-xs" />
                <Skeleton className="h-4 w-2/3 rounded-xs" />
                <div className="flex flex-wrap items-center gap-2 lg:hidden">
                  <Skeleton className="h-11 w-24 rounded-full" />
                  <Skeleton className="size-11 rounded-full" />
                  <Skeleton className="size-11 rounded-full" />
                  <Skeleton className="size-11 rounded-full" />
                </div>
              </div>
            )}
          </Rows>
        </div>
      );

    case "groups":
      // Identity block, then one collapsed section per FieldGroup (§8D.3 profile).
      return (
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <Skeleton variant="circle" className="size-16 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-48 rounded-sm" />
              <Skeleton className="h-3 w-32 rounded-xs" />
            </div>
          </div>
          <div className="flex flex-col">
            <Rows count={count}>
              {() => (
                <div className="flex items-center justify-between border-b border-line py-5">
                  <Skeleton className="h-4 w-40 rounded-xs" />
                  <Skeleton className="h-4 w-12 rounded-xs" />
                </div>
              )}
            </Rows>
          </div>
        </div>
      );

    case "form":
      return (
        <div className="flex flex-col gap-6">
          <Rows count={count}>
            {() => (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24 rounded-xs" />
                <Skeleton className="h-10 w-full rounded-sm" />
              </div>
            )}
          </Rows>
        </div>
      );
  }
}

export function LoadingSkeleton({
  variant = "list",
  count,
  label = "Loading",
  columns = 3,
  className,
  ...rest
}: LoadingSkeletonProps) {
  return (
    <div
      {...rest}
      role="status"
      aria-busy="true"
      data-loading-skeleton={variant}
      className={cn("w-full", className)}
    >
      {/* The words are the announcement. */}
      <span className="sr-only">{label}</span>
      {/* The bones are decoration for the eye only — a screen reader that walked them
          would hear an inventory of empty boxes. */}
      <div aria-hidden="true" data-skeleton-bones="">
        <Bones variant={variant} count={count ?? DEFAULT_COUNTS[variant]} columns={columns} />
      </div>
    </div>
  );
}
