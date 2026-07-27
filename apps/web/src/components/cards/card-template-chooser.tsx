import { CARD_TEMPLATE_OPTIONS } from "@/lib/card-maker";
import type { ContactCardTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

type CardTemplateChooserProps = {
  value: ContactCardTemplate;
  onChange: (template: ContactCardTemplate) => void;
  className?: string;
};

/** Compact text-only Connect / Scan picker — no thumbnail clutter. */
export function CardTemplateChooser({
  value,
  onChange,
  className,
}: CardTemplateChooserProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-background/50 p-1",
        className,
      )}
      role="radiogroup"
      aria-label="Card template"
    >
      {CARD_TEMPLATE_OPTIONS.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.description}
            onClick={() => onChange(option.id)}
            className={cn(
              "h-10 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-bg-hover hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
