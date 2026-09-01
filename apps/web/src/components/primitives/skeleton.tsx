import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/cn";

/**
 * Skeleton — the loading primitive. **Never a spinner** (§8D.1): the bone occupies the
 * exact box the real content will, so nothing shifts when data arrives.
 *
 * The shimmer is an opacity pulse. Under `prefers-reduced-motion` the central rule in
 * `globals.css` caps every animation duration, so the pulse freezes without this
 * component knowing anything about it (§8.9, AC-27).
 *
 * Size it from the call site — `<Skeleton className="h-40 w-full" />`. A skeleton that
 * guesses its own dimensions is the thing that causes the shift it exists to prevent.
 */

export type SkeletonVariant = "text" | "block" | "circle";

const VARIANTS: Record<SkeletonVariant, string> = {
  text: "h-4 w-full rounded-xs",
  block: "h-full w-full rounded-lg",
  circle: "rounded-full",
};

export interface SkeletonProps extends ComponentPropsWithRef<"div"> {
  variant?: SkeletonVariant;
  /** Number of stacked lines. Only meaningful for `variant="text"`. */
  lines?: number;
}

export function Skeleton({
  variant = "block",
  lines = 1,
  className,
  ...rest
}: SkeletonProps) {
  const bone = cn("animate-pulse bg-surface-sunk", VARIANTS[variant]);

  if (variant === "text" && lines > 1) {
    return (
      <div
        {...rest}
        aria-busy="true"
        data-skeleton="true"
        data-variant={variant}
        className={cn("flex w-full flex-col gap-2", "animate-pulse", className)}
      >
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            data-skeleton-line=""
            // The last line of a paragraph is short — a stack of equal bars reads as a
            // table, not as prose.
            className={cn(VARIANTS.text, "bg-surface-sunk", index === lines - 1 && "w-3/5")}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      {...rest}
      aria-busy="true"
      data-skeleton="true"
      data-variant={variant}
      className={cn(bone, className)}
    />
  );
}
