import type { ReactElement } from "react";

import { CARD_ASPECT_CLASS } from "@/components/data";
import { Skeleton } from "@/components/primitives";

/**
 * The builder in bones — the `<Suspense>` fallback and the body of both `loading.tsx` files.
 *
 * §8D.1: **the bones are the real box of the real content.** Three things follow, and none of
 * them is decoration:
 *
 * · The preview bone is the **stage and the phone frame inside it**, at the real geometry —
 *   `h-[50svh]` below `lg`, a phone-width column capped at 336px, the caption beneath. It used
 *   to be a single `CARD_ASPECT_CLASS` (`aspect-[336/500]`) tile, because the pane used to
 *   preview the *share face* and that is the face's rigid ratio. The pane previews the **card
 *   page** now, which has no ratio at all — it is as tall as the owner's field list — so a
 *   500px-tall bone would reserve the wrong box, which is the one thing §8D.1 says bones must
 *   not do. The palette cells below still read `CARD_ASPECT_CLASS`, because those really are
 *   face-shaped.
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

      {/* The split, at `SplitView`'s own 46/54 and with the pinned pane first. */}
      <div className="grid items-start gap-8 lg:grid-cols-[46fr_54fr]">
        {/* The preview stage, boned as the box it is: the same hairline, ground and padding
            `<BuilderPreview>`'s root draws, the same `50svh` mobile cap, and a phone-width
            frame filling it. `lg:h-[600px]` is the one declared number here and it is a bone,
            not a layout: the real frame measures its own budget on mount (see `useFitBudget`),
            and 600px is what that measurement lands on at 1440×900 — close enough that the
            swap does not jump, and load-bearing on nothing. */}
        <div className="flex h-[50svh] flex-col gap-3 rounded-xl border border-line bg-surface-sunk p-3 lg:h-auto lg:p-4">
          <Skeleton className="mx-auto w-full max-w-[336px] flex-1 rounded-xl lg:h-[600px] lg:flex-none" />
          <Skeleton className="h-3 w-40 shrink-0 rounded-xs" />
        </div>

        {/* The control column, in the shape it actually arrives in: **Fields, then Colour**,
            stacked. It used to bone a pill-shaped tab row and two template cells, because the
            controls used to be three tabs opening on the template picker. Both are gone, and a
            skeleton that keeps drawing the old shape is worse than no skeleton — it reserves
            the wrong box, which is the one thing §8D.1 says the bones must not do. */}
        <div className="flex flex-col gap-8">
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
            {/* The `<h2>Colour</h2>`, and the first row of the nine palette cells at the same
                aspect as the cells that are coming. */}
            <Skeleton className="h-5 w-20 rounded-xs" />
            <Skeleton className="h-4 w-full rounded-xs" />
            <div className="grid max-w-[420px] grid-cols-3 gap-4 sm:grid-cols-4">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Skeleton className={`h-auto w-full rounded-xl ${CARD_ASPECT_CLASS}`} />
                  <Skeleton className="h-3 w-2/3 rounded-xs" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
