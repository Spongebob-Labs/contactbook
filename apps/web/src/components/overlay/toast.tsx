"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/primitives/button";
import { OverlayStyles, layerClassName } from "./dialog";

/**
 * Toast — an `--elevation-1` layer (§8.7), and specifically the **reversible-action**
 * affordance (§8D.1).
 *
 * The split matters and is easy to get backwards: something reversible is confirmed
 * *after* the fact by a toast carrying the reversing action; something destructive is
 * confirmed *before* the fact by `ConfirmDialog`, because after the fact there is nothing
 * left to undo. A "Card deleted" toast with no Undo is the worst of both.
 *
 * The `danger` tone exists for E-44 — an export that failed needs to say so and offer
 * "Try again"; it is a report, not a confirmation.
 *
 * State is React state and nothing else (§10.1): no storage, no queue that outlives a
 * reload. `ToastProvider` is mounted once, by T09, in `(app)/layout.tsx`.
 */

export type ToastTone = "default" | "danger";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** The outcome, in words. §8D.1 forbids stating it by icon alone. */
  title: string;
  description?: string;
  /** The reversing action for a reversible outcome, or the retry for a failure. */
  action?: ToastAction;
  tone?: ToastTone;
  /** Overrides the provider default. */
  duration?: number;
  /** Label for the dismiss control. */
  dismissLabel?: string;
}

interface ToastRecord extends ToastOptions {
  id: string;
}

export interface ToastApi {
  /** Pushes a toast and returns its id. */
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error(
      "useToast() must be called inside <ToastProvider>. T09 mounts it once in " +
        "src/app/(app)/layout.tsx; do not mount a second one.",
    );
  }
  return api;
}

const TONES: Record<ToastTone, string> = {
  default: "border-line",
  danger: "border-danger",
};

export interface ToastProviderProps {
  /** Default lifetime. Long enough to read the title and reach the action. */
  duration?: number;
  children?: ReactNode;
}

export function ToastProvider({ duration = 6000, children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<readonly ToastRecord[]>([]);
  // A counter, not `Math.random()` or `Date.now()`: two toasts pushed in the same tick
  // must not collide, and the id must not differ between renders.
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast(options) {
        const id = `toast-${(nextId.current += 1)}`;
        setToasts((current) => [...current, { ...options, id }]);
        return id;
      },
      dismiss,
    }),
    [dismiss],
  );

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={duration}>
      <OverlayStyles />
      <ToastContext.Provider value={api}>{children}</ToastContext.Provider>

      {toasts.map((entry) => (
        <ToastPrimitive.Root
          key={entry.id}
          data-overlay-toast=""
          data-elevation="1"
          data-tone={entry.tone ?? "default"}
          duration={entry.duration}
          onOpenChange={(open) => {
            if (!open) dismiss(entry.id);
          }}
          className={layerClassName(
            cn(
              "flex items-start gap-3 rounded-lg p-4",
              TONES[entry.tone ?? "default"],
            ),
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* ⚠ `data-toast-title` exists for the same reason `data-toast-description` below
                does, and was simply missing: Radix mirrors toast copy into an off-screen
                announce region, so a bare `getByText` on a title matches two nodes and fails
                strict mode. A title-only toast — most of them — had no stable hook at all. */}
            <ToastPrimitive.Title data-toast-title="" className="text-sm text-ink">
              {entry.title}
            </ToastPrimitive.Title>
            {/* `data-toast-description` is the hook tests target. Radix mirrors toast text into
                an off-screen announce region for screen readers — correct behaviour, and the
                reason a bare `getByText` on toast copy matches two nodes. */}
            {entry.description ? (
              <ToastPrimitive.Description
                data-toast-description=""
                className="text-sm text-ink-3"
              >
                {entry.description}
              </ToastPrimitive.Description>
            ) : null}
          </div>

          {entry.action ? (
            <ToastPrimitive.Action asChild altText={entry.action.label}>
              <Button variant="text-link" onClick={entry.action.onClick}>
                {entry.action.label}
              </Button>
            </ToastPrimitive.Action>
          ) : null}

          <ToastPrimitive.Close asChild>
            <Button
              variant="ghost"
              iconOnly
              aria-label={entry.dismissLabel ?? "Dismiss"}
              className="-mr-2 -mt-1 shrink-0"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}

      {/* Bottom-right on desktop, full width above the 64px bottom bar on mobile, and
          clear of the home indicator (§8D.3's safe-area rule). */}
      <ToastPrimitive.Viewport
        className={cn(
          /* ⚠ `dvh`, never `max-h-screen`. `max-h-screen` is `100vh`, which on iOS Safari is the
             PRE-collapse chrome height — about 114px taller than what the reader can see on an
             iPhone SE. A full stack sized against it puts its top toasts above the visible
             viewport, and a `fixed` element cannot be scrolled to, so those toasts are simply
             gone. This was the only `vh` unit left in the app. */
          "fixed z-50 flex max-h-[calc(100dvh_-_var(--space-16))] w-full flex-col gap-2 p-4",
          "bottom-[calc(var(--bottombar-height)_+_env(safe-area-inset-bottom,0px))] right-0",
          "sm:bottom-0 sm:right-0 sm:max-w-sm",
        )}
      />
    </ToastPrimitive.Provider>
  );
}
