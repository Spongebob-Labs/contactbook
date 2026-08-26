"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/primitives/button";
import {
  ModalLayerProvider,
  OverlayStyles,
  layerSurfaceClassName,
  scrimClassName,
  useInsideModalLayer,
  warnNestedModal,
} from "./dialog";

/**
 * Sheet — the mobile bottom sheet, on Radix Dialog for the behaviour.
 *
 * ⚠ THE ONLY F-10 EXEMPTION IN THE CODEBASE. `--radius-2xl` (28px) is legal on this
 * component and on nothing else (§8.6, §8C.1). "Everything is `rounded-2xl`" is one of
 * the loudest generated-UI tells, and the sheet is the single place the oversized radius
 * is doing real work — it is what makes the panel read as having risen from the bottom
 * edge rather than as a rectangle that appeared. Only the *top* corners take it; the
 * bottom two are flush with the viewport edge.
 *
 * Motion slides rather than fades: a sheet that fades in has no origin. Durations are
 * `--dur-slow` (§8.9) and are zeroed centrally under reduced motion (AC-27).
 *
 * ## Two edges, one component
 *
 * `side="bottom"` is the mobile sheet above. `side="left"` is a full-height **drawer**, and
 * it is the same component rather than a second one because everything that is hard here is
 * shared: the scrim, the focus trap, the scroll lock, the Escape handling, and above all the
 * modal-layer guard that makes a second modal refuse to open. A drawer built separately in
 * `layout/` would have re-implemented all five and been exempt from the guard.
 *
 * ⚠ **The F-10 exemption does not travel to the drawer.** 28px is legal on the bottom sheet
 * because it is what makes the panel read as having risen from the bottom edge. A drawer is
 * flush to the left edge for its whole height, so its left corners take no radius at all and
 * its right edge takes `--radius-xl` — the panel radius, not the sheet's.
 */

/**
 * Which edge the panel is attached to.
 *
 * `bottom` is the phone sheet. `left` is the app-navigation drawer that the card builder's
 * focus mode puts behind a hamburger.
 */
export type SheetSide = "bottom" | "left";

export interface SheetProps {
  /** Rendered inside `Dialog.Trigger asChild`. Omit when driving `open` yourself. */
  trigger?: ReactNode;
  /** Which edge it slides from. Defaults to the phone sheet. */
  side?: SheetSide;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Required — it is the sheet's accessible name (AC-25). */
  title: ReactNode;
  hideTitle?: boolean;
  description?: ReactNode;
  /** Action row pinned beneath a hairline at the foot of the sheet. */
  footer?: ReactNode;
  closeLabel?: string;
  hideClose?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * Position, radius, safe-area and motion, per edge.
 *
 * A map rather than two branches in the JSX: the pieces that vary are entangled — a
 * drawer's radius is on the opposite corners from its border, and its animation has to
 * agree with the axis it is inset on — and four `side === "left" ? … : …` ternaries down
 * one `cn()` is where those stop agreeing.
 */
const SIDE: Record<SheetSide, string> = {
  /* The bottom edge is flush with the viewport, so it needs no border there — and the
     home-indicator inset has to be respected or the last row is untappable on an iPhone
     (§8D.3's safe-area rule). */
  bottom:
    "fixed inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl " +
    "border-x-0 border-b-0 px-5 pt-3 " +
    "pb-[calc(var(--space-5)_+_env(safe-area-inset-bottom))] " +
    "data-[state=open]:animate-[cb-sheet-in_var(--dur-slow)_var(--ease-out)] " +
    "data-[state=closed]:animate-[cb-sheet-out_var(--dur-slow)_var(--ease-in)]",
  /* Full height against the left edge: no radius and no border on the three flush sides,
     `--radius-xl` on the one corner pair that is actually in the room. `--space-5` plus the
     left safe-area inset, because a landscape iPhone puts a notch there. */
  left:
    "fixed inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col overflow-y-auto " +
    "rounded-l-none rounded-r-xl border-y-0 border-l-0 " +
    "px-5 py-5 ps-[calc(var(--space-5)_+_env(safe-area-inset-left))] " +
    "data-[state=open]:animate-[cb-drawer-in_var(--dur-slow)_var(--ease-out)] " +
    "data-[state=closed]:animate-[cb-drawer-out_var(--dur-slow)_var(--ease-in)]",
};

export function Sheet({
  trigger,
  side = "bottom",
  open,
  defaultOpen,
  onOpenChange,
  title,
  hideTitle = false,
  description,
  footer,
  closeLabel = "Close",
  hideClose = false,
  children,
  className,
}: SheetProps) {
  const nested = useInsideModalLayer();

  // Key presence, not value, is what removes Radix's default `aria-describedby`.
  const describedByOverride = description ? {} : { "aria-describedby": undefined };

  if (nested) {
    warnNestedModal("Sheet");
    return null;
  }

  return (
    <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <OverlayStyles />
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-overlay-scrim=""
          data-elevation="0"
          className={scrimClassName}
        />

        <DialogPrimitive.Content
          data-overlay-sheet={side}
          data-elevation="2"
          {...describedByOverride}
          className={cn(layerSurfaceClassName, SIDE[side], className)}
        >
          <ModalLayerProvider>
            {/* The grabber. Decorative only — dragging is not a supported gesture, so it
                must never be the sole affordance for dismissal (§8.8, AC-25). Bottom only:
                on a drawer it would point at an edge nothing slides toward. */}
            {side !== "bottom" ? null : (
              <div
                aria-hidden="true"
                className="mx-auto mb-4 h-1 w-10 rounded-full bg-line"
              />
            )}

            <div className="flex items-start justify-between gap-4">
              <div className={cn("flex flex-col gap-2", hideTitle && "sr-only")}>
                <DialogPrimitive.Title className="text-h3">{title}</DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="text-sm text-ink-3">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>

              {hideClose ? null : (
                <DialogPrimitive.Close asChild>
                  <Button variant="ghost" iconOnly aria-label={closeLabel} className="-mr-2 -mt-1">
                    <X aria-hidden="true" className="size-5" />
                  </Button>
                </DialogPrimitive.Close>
              )}
            </div>

            {children ? <div className="mt-4 text-base text-ink">{children}</div> : null}

            {footer ? (
              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
                {footer}
              </div>
            ) : null}
          </ModalLayerProvider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
