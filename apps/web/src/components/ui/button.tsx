import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[7px] px-3.5 text-xs font-bold tracking-[0.01em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[#D4C4A8] dark:hover:bg-[#D4C4A8]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-bg-hover",
        outline:
          "border-[1.5px] border-accent-border bg-transparent text-primary hover:bg-accent-subtle",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-bg-hover hover:text-foreground",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 dark:text-foreground",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 rounded-[7px] px-3 text-xs",
        lg: "h-10 rounded-[7px] px-5 text-sm",
        icon: "h-9 w-9 px-0",
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
