import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "outline";

const variants: Record<BadgeVariant, string> = {
  default:
    "bg-accent-subtle text-primary ring-accent-border",
  secondary:
    "bg-accent-subtle text-primary ring-accent-border",
  success: "bg-success/12 text-success ring-success/20",
  warning:
    "bg-accent-subtle text-primary ring-accent-border",
  outline: "border border-border-strong text-muted-foreground",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex h-auto items-center rounded px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.1em] ring-1 ring-inset ring-transparent",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
