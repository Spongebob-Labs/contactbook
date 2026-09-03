import type { ReactElement } from "react";

import { Skeleton } from "@/components/primitives";

/**
 * The builder in bones — the `<Suspense>` fallback and the body of both `loading.tsx` files.
 *
 * §8D.1: **the bones are the real box of the real content.** Three things follow, and none of
 * them is decoration:
 *
 * · The preview bone is the **stage and the phone frame inside it**, at the real geometry —
 *   `--builder-preview-h` below `lg` (the same token the real pane reads — never a second
 *   copy of that number), a phone-width column capped at 336px, the caption beneath. It used
 *   to be a single `CARD_ASPECT_CLASS` (`aspect-[336/500]`) tile, because the pane used to
 *   preview the *share face* and that is the face's rigid ratio. The pane previews the **card
 *   page** now, which has no ratio at all — it is as tall as the owner's field list — so a
 *   500px-tall bone would reserve the wrong box, which is the one thing §8D.1 says bones must
 *   not do. The palette cells below are 44px squares, because that is what the Design panel
 *   actually renders — they used to read `CARD_ASPECT_CLASS`, from a version of that panel
 *   that showed nine live wallet passes and no longer exists. See the block itself for the
 *   119px of layout shift that left behind.
 * · The bone above the frame is gone with the control it boned. It was the preview's two-button
 *   variant switch; drawing a pill where nothing will arrive is a 40px layout shift on mount.
 * · The two columns are the real split, at the real ratio, with the preview first — so the
 *   pinned pane does not slide across the page when the real one mounts.
 *
 * It renders no `<main>`: `AppShell` owns the one `<main id="main">` in the `(app)` group, and a
 * second landmark fails axe's `landmark-unique` (AC-25). `data-builder-skeleton` is the hook
 * the state and a11y sweeps key off (§13.2), and the whole thing is `aria-hidden` because a
 * screen reader has nothing to gain from a description of bones — the `aria-busy` on the
 * `<ScreenStateRoot>` above it is what announces the wait.
 */
export function BuilderSkeleton(): ReactElement {
  return (
    <div data-builder-skeleton="" aria-hidden="true" className="flex flex-col gap-6">
      {/* The header: back link, card name, meter, Save. */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-24 rounded-xs" />
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-20 rounded-xs" />
            <Skeleton className="h-8 w-64 rounded-sm" />
          </div>
          <div className="ms-auto flex items-center gap-4">
            <Skeleton className="h-4 w-28 rounded-xs" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </div>
      </div>

      {/* The split, at `SplitView`'s own 46/54 and with the pinned pane first. The mobile row
          gap mirrors the builder's own `gap-4` — the bones have to occupy the box the real
          layout does, and 32px here against 16px there is a 16px jump on swap. */}
      <div className="grid items-start gap-4 lg:grid-cols-[46fr_54fr] lg:gap-8">
        {/* The preview stage, boned as the box it is: the same hairline, ground and padding
            `<BuilderPreview>`'s root draws, the same `50svh` mobile cap, and a phone-width
            frame filling it. `lg:h-[600px]` is the one declared number here and it is a bone,
            not a layout: the real frame measures its own budget on mount (see `useFitBudget`),
            and 600px is what that measurement lands on at 1440×900 — close enough that the
            swap does not jump, and load-bearing on nothing. */}
        {/* ⚠ `--builder-preview-h`, the same token the real pane reads. It said `50svh` while
            the real pane now resolves to `min(38svh, 300px)`, so the bone reserved 106px more
            than the thing replacing it and the whole control column jumped up on load. */}
        <div className="flex h-[var(--builder-preview-h)] flex-col gap-3 rounded-xl border border-line bg-surface-sunk p-3 lg:h-auto lg:p-4">
          <Skeleton className="mx-auto w-full max-w-[336px] flex-1 rounded-xl lg:h-[600px] lg:flex-none" />
          <Skeleton className="h-3 w-40 shrink-0 rounded-xs" />
        </div>

        {/* The control column, in the shape it actually arrives in: **Fields, then Colour**,
            stacked. It used to bone a pill-shaped tab row and two template cells, because the
            controls used to be three tabs opening on the template picker. Both are gone, and a
            skeleton that keeps drawing the old shape is worse than no skeleton — it reserves
            the wrong box, which is the one thing §8D.1 says the bones must not do. */}
        <div className="flex flex-col gap-8">
          {/* The section rail — `<BuilderNav>`, which below `lg` is a segmented pill on a well
              and above it an 84px icon column. It was not boned at all, so a 52px control
              appeared under a settled layout on every load. */}
          <Skeleton className="h-13 w-48 shrink-0 rounded-full lg:hidden" />

          <div className="flex flex-col gap-4">
            {/* The `<h2>Fields</h2>` and the picker's prose intro. */}
            <Skeleton className="h-5 w-20 rounded-xs" />
            <Skeleton className="h-4 w-full rounded-xs" />
            {/* A group heading and four field rows — the real row height, `py-3` on a 20px
                two-line control, so the column below does not jump when the ticks arrive. */}
            <div className="flex flex-col gap-3">
              <Skeleton className="h-3 w-24 rounded-xs" />
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-11 w-full rounded-xs" />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* The `<h2>Design</h2>` and its intro, then the nine palette cells.

                ⚠ **Nine 44px swatches, not three card-shaped tiles.** This block used to draw
                three `aspect-[336/500]` cells in a `grid-cols-3` — a shape the Design panel has
                not had since the colour axis stopped being nine live wallet passes. At a 320px
                viewport those columns resolved to 88px wide and therefore **131px tall each**,
                against the 44px squares that actually arrive: a ~119px jump in this block alone,
                on a screen whose bones exist precisely so nothing moves (§8D.1). The rail above
                them was not boned at all, which is another 44px of the same. */}
            <Skeleton className="h-5 w-20 rounded-xs" />
            <Skeleton className="h-4 w-full rounded-xs" />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
                <Skeleton key={index} className="size-11 rounded-[9px] md:size-10 md:rounded-[7px]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
