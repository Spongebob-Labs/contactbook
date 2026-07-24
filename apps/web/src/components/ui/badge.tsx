import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-secondary text-[#374151]",
        secondary: "bg-secondary text-[#374151]",
        outline: "border border-border bg-surface text-foreground",
        success: "bg-success-bg text-success",
        warning: "bg-secondary text-muted-foreground",
        destructive: "bg-[var(--color-danger-bg)] text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
