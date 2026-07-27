import { cn } from "@/lib/utils";

type FilterTab = {
  key: string;
  label: string;
};

type FilterTabBarProps<T extends string> = {
  tabs: Array<{ key: T; label: string } | FilterTab>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function FilterTabBar<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: FilterTabBarProps<T>) {
  return (
    <div
      className={cn(
        "flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key as T)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
