"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { createContext, useContext, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { OverlayStyles, layerClassName } from "./dialog";

/**
 * Tooltip — an `--elevation-1` layer (§8.7), and the smallest one in the system.
 *
 * ⚠ A TOOLTIP MAY NEVER BE THE ONLY CARRIER OF MEANING (§8.8, AC-25). It *describes*;
 * the trigger still has to *name* itself. T09's collapsed 68px sidebar rail is the real
 * consumer: every rail item keeps its `aria-label` and gains a tooltip on hover — the
 * label is what a screen reader announces, the tooltip is what a mouse user reads.
 *
 * `Tooltip` supplies its own Radix provider when it is not inside a `TooltipProvider`,
 * because a component that throws unless a distant layout remembered a provider is a
 * trap. Wrap a *group* of triggers in `TooltipProvider` when you want the shared
 * skip-delay — moving along a rail should not re-pay the open delay at every icon.
 */

const TooltipGroupContext = createContext(false);

export interface TooltipProviderProps {
  /** Time before the first tooltip in the group opens. */
  delayDuration?: number;
  /** Window in which a neighbouring trigger opens instantly. */
  skipDelayDuration?: number;
  children: ReactNode;
}

export function TooltipProvider({
  delayDuration = 400,
  skipDelayDuration = 300,
  children,
}: TooltipProviderProps) {
  return (
    <TooltipGroupContext.Provider value={true}>
      <TooltipPrimitive.Provider
        delayDuration={delayDuration}
        skipDelayDuration={skipDelayDuration}
      >
        {children}
      </TooltipPrimitive.Provider>
    </TooltipGroupContext.Provider>
  );
}

export interface TooltipProps {
  /** The description. Short — a tooltip is a label, not a paragraph. */
  content: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  /** The trigger. Rendered `asChild`, so it must be a single focusable element. */
  children: ReactNode;
  className?: string;
}

export function Tooltip({
  content,
  open,
  defaultOpen,
  onOpenChange,
  side = "right",
  align = "center",
  delayDuration = 400,
  children,
  className,
}: TooltipProps) {
  const grouped = useContext(TooltipGroupContext);

  const root = (
    <TooltipPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <OverlayStyles />
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>

      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          data-overlay-tooltip=""
          data-elevation="1"
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={layerClassName(
            cn("max-w-xs rounded-sm px-3 py-2 text-sm text-ink", className),
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );

  if (grouped) return root;

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>{root}</TooltipPrimitive.Provider>
  );
}
