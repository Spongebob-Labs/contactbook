import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Badge — a small, never-interactive count or status marker at `--radius-sm`.
 *
 * The distinction from `Chip` is deliberate and worth keeping: a Chip is a pill the user
 * can act on or filter by; a Badge is a fact attached to something else. The zero-field
 * warning badge (AC-36) is the reason the `warning` tone exists.
 */

export type BadgeTone = "neutral" | "accent" | "warning" | "danger" | "success";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunk text-ink-3",
  accent: "bg-accent-wash text-accent",
  warning: "bg-warning-wash text-warning-ink",
  danger: "bg-danger-wash text-danger",
  success: "bg-accent-wash text-success",
};

export interface BadgeProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
  tone?: BadgeTone;
  /** Decorative glyph — 16px only (§8.8). */
  icon?: ReactNode;
  children: ReactNode;
}

export function Badge({ tone = "neutral", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      data-tone={tone}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-sm px-2 align-middle",
        "text-xs tabular-nums",
        TONES[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex size-4 items-center justify-center">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
