import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentedTabItem<T extends string> = {
  key: T;
  label: string;
  icon?: LucideIcon;
  count?: number | null;
  /**
   * `data-tour` hook for the product tour. It belongs on the trigger rather
   * than the panel: a panel only exists while its tab is active, so a tour
   * step pointing at one could never find it from another tab.
   */
  dataTour?: string;
};

type SegmentedTabsProps<T extends string> = {
  items: Array<SegmentedTabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
  className?: string;
};

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "Sections",
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex w-full max-w-full flex-wrap gap-1 rounded-xl border border-border/70 bg-muted/40 p-1 sm:w-auto",
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const isActive = value === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-tour={item.dataTour}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-bg-hover/60 hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            <span className="truncate">{item.label}</span>
            {item.count != null && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  isActive
                    ? "bg-muted text-foreground"
                    : "bg-background/60 text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
