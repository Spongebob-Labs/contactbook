"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { OverlayStyles, layerClassName } from "./dialog";

/**
 * Popover — an `--elevation-1` layer anchored to its trigger (§8.7).
 *
 * Deliberately **not** modal. "Add field" opens over a profile group and the list beneath
 * must stay readable and operable while the user decides (§8D.3); locking scroll and
 * `aria-hidden`-ing the page for a small anchored panel is the behaviour that makes an
 * app feel heavy. Escape still closes it and focus still returns to the trigger (E-50) —
 * dismissal is identical to a dialog's; only the modality differs.
 */

export interface PopoverProps {
  /** Rendered inside `Popover.Trigger asChild`. */
  trigger: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Required — a floating region with no accessible name is an axe violation (AC-25). */
  title: ReactNode;
  /** Keeps the title in the accessibility tree and out of the layout. */
  hideTitle?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  children?: ReactNode;
  className?: string;
}

export function Popover({
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  title,
  hideTitle = false,
  side = "bottom",
  align = "start",
  children,
  className,
}: PopoverProps) {
  const titleId = `${useId()}-popover-title`;

  return (
    <PopoverPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <OverlayStyles />
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-elevation="1"
          aria-labelledby={titleId}
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={layerClassName(
            cn(
              "w-[var(--radix-popover-content-available-width)] max-w-xs rounded-lg p-4",
              "max-h-[var(--radix-popover-content-available-height)] overflow-y-auto",
              className,
            ),
          )}
        >
          <p
            id={titleId}
            className={cn("text-sm text-ink", hideTitle ? "sr-only" : "mb-3")}
          >
            {title}
          </p>
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** `Popover.Close` for a "Done" button inside the panel. */
export const PopoverClose = PopoverPrimitive.Close;
