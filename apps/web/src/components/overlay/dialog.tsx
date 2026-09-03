"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/primitives/button";

/**
 * Dialog — and the stylesheet the whole `overlay/` directory ships.
 *
 * ⚠ THIS DIRECTORY IS THE ONLY ONE IN THE BUILD PERMITTED `box-shadow` (F-09, §8.7).
 * Everywhere else is a flat surface separated by a hairline rule, because a drop shadow
 * on every surface is one of the loudest generated-UI tells. Elevation here has to be
 * earned: these are layers genuinely detached from the page — portalled, fixed, floating
 * over other content — and a modal with no shadow is a usability failure, not restraint.
 *
 * ── Why the rule is a stylesheet and not a utility class ──────────────────────────────
 * T05's `select.tsx` renders a portalled menu carrying `data-elevation="1"` (the §13.2
 * contract attribute) and **deliberately no shadow**: `primitives/` is not this directory,
 * so declaring one there would have failed AC-15. It left the styling open for T08.
 * A per-component class here could never reach that node. An attribute rule can — so this
 * directory ships exactly one global rule, keyed on the contract attribute, and every
 * overlay root mounts it. `ToastProvider` mounts app-wide from `(app)/layout.tsx` (T09),
 * so the rule is permanently resident on every authenticated route; `OverlayStyles` is
 * exported from the barrel for any layout that renders a `Select` with no overlay nearby.
 *
 * React 19 hoists `<style href precedence>` into `<head>` and dedupes by `href`, so all
 * seven components can render it unconditionally and exactly one `<style>` exists.
 */

export const OVERLAY_STYLE_HREF = "contactbook-overlay";

/**
 * The elevation rule.
 *
 * `:where()` pins it at zero specificity on purpose. This sheet and T02's
 * `:focus-visible` rule are both unlayered, so specificity is what separates them —
 * at (0,0,0) the focus ring's own `box-shadow` (0,1,0) can never be overwritten by a
 * shadow, which is what keeps AC-26's 3:1 guarantee intact. It also means any component
 * class in this directory beats the default without a `!important` anywhere.
 */
export const ELEVATION_CSS = `:where([data-elevation="0"]) { box-shadow: var(--elevation-0); }
:where([data-elevation="1"]) { box-shadow: var(--elevation-1); }
:where([data-elevation="2"]) { box-shadow: var(--elevation-2); }`;

/**
 * Overlay motion (§8.9). Keyframes live here rather than in a component's inline style
 * for two reasons: Radix only waits for a CSS *animation* before unmounting a closing
 * layer (a transition is ignored, so "closing" would not exist), and an inline
 * `animation` would be visible to happy-dom's computed style and hang every close in
 * the unit suite. Durations are `var(--dur-*)`, so the central reduced-motion override
 * in `globals.css` zeroes all of this with no per-component opt-in (AC-27).
 */
const MOTION_CSS = `@keyframes cb-scrim-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes cb-scrim-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes cb-layer-in { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes cb-layer-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(4px) scale(0.98); } }
@keyframes cb-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes cb-sheet-out { from { transform: translateY(0); } to { transform: translateY(100%); } }
@keyframes cb-drawer-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes cb-drawer-out { from { transform: translateX(0); } to { transform: translateX(-100%); } }`;

export const OVERLAY_CSS = `${ELEVATION_CSS}\n${MOTION_CSS}`;

/**
 * Mount the directory's stylesheet. Rendered by every overlay root; safe to render any
 * number of times and safe to mount directly in a layout.
 */
export function OverlayStyles() {
  return (
    <style href={OVERLAY_STYLE_HREF} precedence="default">
      {OVERLAY_CSS}
    </style>
  );
}

/* ── The modal-layer guard ─────────────────────────────────────────────────────────────
   Stacked modals are not supported: a dialog over a sheet traps focus twice, gives the
   user two Escapes to press, and double-locks scroll. Rather than leave that reachable
   and hope no screen builds it, a modal layer publishes itself through context and a
   second one refuses to open. */

const ModalLayerContext = createContext(false);

/** True when this subtree is already inside an open modal layer (Dialog or Sheet). */
export function useInsideModalLayer(): boolean {
  return useContext(ModalLayerContext);
}

export function warnNestedModal(component: string): void {
  if (process.env.NODE_ENV === "production") return;
  // §13.1's structured shape. No PII — a component name and nothing else.
  console.error("[contactbook]", {
    scope: "overlay",
    problem: "nested-modal-blocked",
    component,
  });
}

export type DialogSize = "sm" | "md" | "lg";

const SIZES: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-[44rem]",
};

/**
 * The scrim: a flat ink tint at 40%, and nothing else.
 *
 * F-05 bans glassmorphism outright — no blur filter behind a layer, anywhere, not only on
 * cards. Two reasons, and the second is the one that bites: frosted glass is an AI-UI
 * tell, and it disappears entirely in `html-to-image` rasterisation, so a card exported
 * to PNG from behind one would come out wrong (§6.8).
 */
export const scrimClassName =
  "fixed inset-0 z-40 bg-ink/40 " +
  "data-[state=open]:animate-[cb-scrim-in_var(--dur-base)_var(--ease-out)] " +
  "data-[state=closed]:animate-[cb-scrim-out_var(--dur-fast)_var(--ease-in)]";

/** The shared floating-layer skin: opaque ground, real boundary, earned elevation. */
export const layerSurfaceClassName = "z-50 border border-line bg-surface-raised text-ink";

/** Enter/exit for a layer that fades and lifts. The sheet slides instead — see `sheet.tsx`. */
export const layerMotionClassName =
  "data-[state=open]:animate-[cb-layer-in_var(--dur-base)_var(--ease-out)] " +
  "data-[state=closed]:animate-[cb-layer-out_var(--dur-fast)_var(--ease-in)]";

export function layerClassName(className?: string): string {
  return cn(layerSurfaceClassName, layerMotionClassName, className);
}

/**
 * Publishes "a modal layer is open" to everything rendered inside it. `Dialog` and
 * `Sheet` both wrap their content in this; both refuse to open inside it.
 */
export function ModalLayerProvider({ children }: { children: ReactNode }) {
  return <ModalLayerContext.Provider value={true}>{children}</ModalLayerContext.Provider>;
}

export interface DialogProps {
  /** Rendered inside `Dialog.Trigger asChild`. Omit when driving `open` yourself. */
  trigger?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `--text-overline` kicker above the title — the §6.10 panel anatomy. */
  overline?: ReactNode;
  /** Required — it is the dialog's accessible name (AC-25). */
  title: ReactNode;
  /** Keeps the title in the accessibility tree and out of the layout. */
  hideTitle?: boolean;
  /** Optional supporting line; also becomes `aria-describedby`. */
  description?: ReactNode;
  size?: DialogSize;
  /** Right-aligned action row beneath a hairline. */
  footer?: ReactNode;
  /** Label for the icon-only close control. */
  closeLabel?: string;
  /** Drop the corner close control — for a dialog whose footer already offers Cancel. */
  hideClose?: boolean;
  /** Take over the initial focus target. `ConfirmDialog` uses it to land on Cancel. */
  onOpenAutoFocus?: (event: Event) => void;
  children?: ReactNode;
  className?: string;
}

export function Dialog({
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  overline,
  title,
  hideTitle = false,
  description,
  size = "md",
  footer,
  closeLabel = "Close",
  hideClose = false,
  onOpenAutoFocus,
  children,
  className,
}: DialogProps) {
  const nested = useInsideModalLayer();

  // Key presence, not value, is what removes Radix's default `aria-describedby`.
  const describedByOverride = description ? {} : { "aria-describedby": undefined };

  if (nested) {
    warnNestedModal("Dialog");
    return null;
  }

  return (
    <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <OverlayStyles />
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-overlay-scrim="" data-elevation="0" className={scrimClassName} />

        <DialogPrimitive.Content
          data-elevation="2"
          onOpenAutoFocus={onOpenAutoFocus}
          {...describedByOverride}
          className={layerClassName(
            cn(
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              /* `dvw`, not `vw`. `100vw` includes a classic scrollbar's width, so on a desktop
                 window with one the box over-measures by ~15px; below `max-w-*` that is
                 invisible, but the two units should not disagree when the height already uses
                 `dvh`. */
              "w-[calc(100dvw_-_var(--space-8))]",
              "max-h-[calc(100dvh_-_var(--space-16))] overflow-y-auto rounded-lg p-6",
              SIZES[size],
              className,
            ),
          )}
        >
          <ModalLayerProvider>
            <div className="flex items-start justify-between gap-4">
              <div className={cn("flex flex-col gap-2", hideTitle && "sr-only")}>
                {overline ? (
                  <p className="text-overline uppercase text-ink-3">{overline}</p>
                ) : null}
                <DialogPrimitive.Title className="text-h3">{title}</DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="text-sm text-ink-3">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>

              {hideClose ? null : (
                <DialogPrimitive.Close asChild>
                  {/* ⚠ `-mr-2` only. The `-mt-1` that used to be here pulled a 44px corner
                      target to within 8px of the dialog's top-right edge on a 320px phone,
                      which on a rounded 12px corner puts part of the target outside the
                      panel. Optical alignment is not worth a control you can miss. */}
                  <Button variant="ghost" iconOnly aria-label={closeLabel} className="-mr-2">
                    <X aria-hidden="true" className="size-5" />
                  </Button>
                </DialogPrimitive.Close>
              )}
            </div>

            {children ? <div className="mt-4 text-base text-ink">{children}</div> : null}

            {footer ? (
              /**
               * ⚠ **The footer is pinned to the bottom of the scroll box, and that is a mobile
               * fix rather than a style.**
               *
               * The dialog is one scroll container: header, body and footer all live inside it.
               * That is correct and it caps at `100dvh - 64px`, so nothing overflows the
               * viewport. What it does not do is keep the *action* reachable. Two cases:
               *
               *   · **A long list.** The notify picker with eight recipients is ~990px of
               *     content in 603px of dialog on an iPhone SE, so `Send 8 updates` sits ~390px
               *     below the fold — the reader has to scroll to the end of a checklist to find
               *     the button that acts on it.
               *   · **The software keyboard.** iOS Safari does not shrink the layout viewport
               *     for the keyboard, so `dvh` does not react to it. With ~300px of keyboard up
               *     the bottom of a centred `fixed` dialog is *unreachable at any scroll
               *     position*, and every dialog in this product that has a text input also has
               *     a Save in its footer.
               *
               * `sticky bottom-0` inside the existing scroller answers both without adding a
               * second one. The negative margins cancel the panel's own `p-6` so the sticky bar
               * spans the full width and its ground covers the content scrolling underneath it —
               * without them the row would float with 24px of transparent gutter each side and
               * the text beneath would show through.
               *
               * The ground is opaque for the same reason. `bg-surface-raised` is the dialog's
               * own panel colour, so the bar reads as part of the panel rather than as a layer
               * on top of it.
               */
              <div
                className={cn(
                  "sticky bottom-0 z-10 -mx-6 -mb-6 mt-6 flex flex-wrap items-center justify-end gap-3",
                  "border-t border-line bg-surface-raised px-6 pb-6 pt-4",
                )}
              >
                {footer}
              </div>
            ) : null}
          </ModalLayerProvider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** `Dialog.Close` for a footer button — `<DialogClose asChild><Button …/></DialogClose>`. */
export const DialogClose = DialogPrimitive.Close;
