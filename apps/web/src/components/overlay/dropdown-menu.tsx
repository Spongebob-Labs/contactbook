"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { OverlayStyles, layerClassName } from "./dialog";

/**
 * DropdownMenu — an `--elevation-1` layer of actions (§8.7, §8D.7).
 *
 * A menu, not a list of links: Radix supplies `role="menu"`, roving focus, typeahead and
 * Escape; the look is ours. Item radius is `--radius-md`, which §8.6 names for dropdown
 * items specifically.
 *
 * A destructive row is marked with `tone="destructive"` and carries `data-tone` so it can
 * never be mistaken for the rows above it — but selecting it opens a `ConfirmDialog`
 * rather than deleting outright (§8D.1). The colour is a warning, not the guard.
 */

export interface DropdownMenuProps {
  /** Rendered inside `DropdownMenu.Trigger asChild`. Icon-only triggers need `aria-label`. */
  trigger: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  children: ReactNode;
  className?: string;
}

export function DropdownMenu({
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  side = "bottom",
  align = "end",
  children,
  className,
}: DropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <OverlayStyles />
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          data-elevation="1"
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={layerClassName(
            cn(
              "min-w-[12rem] overflow-hidden rounded-lg p-1",
              "max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto",
              className,
            ),
          )}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

export type DropdownMenuItemTone = "default" | "destructive";

export interface DropdownMenuItemProps {
  onSelect?: (event: Event) => void;
  tone?: DropdownMenuItemTone;
  disabled?: boolean;
  /** Leading icon at 16px (§8.8). Decorative — the label carries the meaning. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const ITEM_TONES: Record<DropdownMenuItemTone, string> = {
  default: "text-ink data-highlighted:bg-accent-wash",
  destructive: "text-danger data-highlighted:bg-danger-wash",
};

export function DropdownMenuItem({
  onSelect,
  tone = "default",
  disabled,
  icon,
  className,
  children,
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      onSelect={onSelect}
      disabled={disabled}
      data-tone={tone}
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2 max-md:py-2.5 text-base",
        "data-disabled:pointer-events-none data-disabled:text-ink-3",
        ITEM_TONES[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center">
          {icon}
        </span>
      ) : null}
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

/** Section heading inside a longer menu. */
export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.Label className="px-3 py-2 text-overline uppercase text-ink-3">
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

/** A real border, like every other hairline in the system (§8.7) — never a shadow fake. */
export function DropdownMenuSeparator() {
  return <DropdownMenuPrimitive.Separator className="my-1 border-t border-line" />;
}

export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
