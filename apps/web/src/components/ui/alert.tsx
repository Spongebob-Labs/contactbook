import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border-[0.5px] border-border bg-card p-4 text-sm text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}
