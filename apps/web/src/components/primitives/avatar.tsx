"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/cn";

/**
 * Avatar with a monogram fallback — E-19 (no `avatarUrl`) and E-20 (a URL that 404s)
 * both land here, and both must produce a readable initial rather than a broken glyph
 * or an empty hole.
 *
 * The root carries `role="img"` and `aria-label={name}` so the person is announced once,
 * by name; the monogram itself is `aria-hidden` so AT never reads "P S".
 */

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<AvatarSize, string> = {
  xs: "size-6 text-xs",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-lg",
  xl: "size-24 text-h3",
};

/** First and last initial — never more than two, never fewer than one. */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (
    words[0].charAt(0) + words[words.length - 1].charAt(0)
  ).toUpperCase();
}

export interface AvatarProps {
  /** The person's name — the accessible name and the monogram source. */
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** `--radius-full` by default (§8.6); `rounded` is for a logo mark. */
  shape?: "circle" | "rounded";
  className?: string;
}

export function Avatar({
  name,
  src,
  size = "md",
  shape = "circle",
  className,
}: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      role="img"
      aria-label={name}
      data-size={size}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden",
        "bg-surface-sunk text-ink-3",
        shape === "circle" ? "rounded-full" : "rounded-lg",
        SIZES[size],
        className,
      )}
    >
      {src ? (
        <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />
      ) : null}
      {/* delayMs stays 0: a blank disc before the monogram appears is a layout flash. */}
      <AvatarPrimitive.Fallback
        aria-hidden="true"
        className="inline-flex size-full items-center justify-center"
      >
        {monogram(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
