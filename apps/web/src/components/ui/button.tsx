import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "rounded-xl bg-primary px-4 py-2 text-primary-foreground hover:bg-[#1F2937]",
        secondary:
          "rounded-xl border border-border bg-transparent px-4 py-2 text-foreground hover:bg-bg-hover",
        outline:
          "rounded-xl border border-border bg-transparent px-4 py-2 text-foreground hover:bg-bg-hover",
        ghost:
          "rounded-md bg-transparent px-3 py-2 text-muted-foreground hover:bg-bg-hover hover:text-foreground",
        destructive:
          "rounded-xl bg-destructive px-4 py-2 text-white hover:bg-destructive/90",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 rounded-xl px-3 text-sm",
        lg: "h-12 rounded-xl px-5 text-sm",
        icon: "h-8 w-8 rounded-md border border-border bg-surface p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
