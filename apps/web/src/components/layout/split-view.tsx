import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The two-pane layout the card builder consumes (spec §8D.4, AC-29): one pane pinned and
 * always visible, the other scrolling beside or beneath it.
 *
 * The contract T23 depends on, stated so it does not have to be rediscovered:
 *
 * · **The pinned pane is first in DOM order, always** — `pinnedSide` moves it with
 *   `order`, never by reordering the children. On mobile the preview must be the first
 *   thing under the header, and on desktop a reading order of preview-then-controls is
 *   the one that matches the picture in §8D.4.
 * · **It is `sticky` at every width**, not just on desktop. §8D.4: "the preview is never
 *   pushed off-screen", and AC-29 asserts it is visible without scrolling at all three
 *   viewports. Mobile caps it at 45svh (`svh`, not `vh` — `vh` is the pre-collapse
 *   browser-chrome height on iOS, so `45vh` is taller than 45% of what the user sees).
 * · **Desktop splits ~46 / 54** in favour of the controls, per §8D.4.
 * · The panes are `region`s when labelled, so a screen-reader user can move between the
 *   preview and the controls instead of arrowing through the whole control column.
 *
 * This component owns geometry only. It renders no ground, no border and no padding of
 * its own: the builder's preview pane needs `--canvas` behind a floating card, and a
 * future consumer may want a framed panel. A layout primitive that decides how things
 * look is one every consumer has to fight.
 */

export interface SplitViewProps {
  /** The pane that stays put — the live `<ShareFace>` in the builder. */
  pinned: ReactNode;
  /** The pane that scrolls — the builder's Template / Fields / Theme tabs. */
  children: ReactNode;
  /** Which column the pinned pane occupies ≥1024px. DOM order never changes. */
  pinnedSide?: "left" | "right";
  pinnedLabel?: string;
  contentLabel?: string;
  className?: string;
  pinnedClassName?: string;
  contentClassName?: string;
}

export function SplitView({
  pinned,
  children,
  pinnedSide = "left",
  pinnedLabel,
  contentLabel,
  className,
  pinnedClassName,
  contentClassName,
}: SplitViewProps) {
  const pinnedRight = pinnedSide === "right";

  return (
    <div
      data-split-view=""
      data-pinned-side={pinnedSide}
      className={cn(
        "grid items-start gap-8",
        pinnedRight ? "lg:grid-cols-[54fr_46fr]" : "lg:grid-cols-[46fr_54fr]",
        className,
      )}
    >
      <div
        data-split-pinned=""
        role={pinnedLabel ? "region" : undefined}
        aria-label={pinnedLabel}
        className={cn(
          // Mobile: pinned to the top of the scroll container, capped at ~45svh so the
          // controls beneath it are still reachable without a fight.
          "sticky top-0 z-10 max-h-[45svh] overflow-hidden bg-canvas",
          // Desktop: the full column, offset by the shell's own top padding.
          "lg:top-8 lg:z-0 lg:max-h-[calc(100svh-var(--space-16))] lg:overflow-y-auto",
          pinnedRight && "lg:order-2",
          pinnedClassName,
        )}
      >
        {pinned}
      </div>

      <div
        data-split-content=""
        role={contentLabel ? "region" : undefined}
        aria-label={contentLabel}
        className={cn("min-w-0", pinnedRight && "lg:order-1", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}
