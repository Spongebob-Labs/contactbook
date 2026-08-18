import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Device bezel for the live preview.
 *
 * Fixed 390×844 (iPhone 14 proportions) and scaled to fit rather than made
 * fluid: a preview that reflows at the container's width would show a layout
 * nobody will ever see, which defeats the purpose of previewing at all.
 */
export function PhoneFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[330px] overflow-hidden rounded-[38px] border-[10px] border-[#101418] bg-[#101418] shadow-[0_24px_60px_rgba(15,23,42,0.22)]",
        className,
      )}
    >
      <div className="relative aspect-[390/844] w-full overflow-hidden rounded-[28px] bg-white">
        <div
          className="pointer-events-none absolute left-1/2 top-2 z-20 h-6 w-[34%] -translate-x-1/2 rounded-full bg-[#101418]"
          aria-hidden="true"
        />
        <div className="h-full w-full overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
