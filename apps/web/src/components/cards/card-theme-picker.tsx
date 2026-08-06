import { useState } from "react";
import { Check, Pipette } from "lucide-react";
import {
  CARD_THEME_PRESETS,
  contrastForeground,
  normalizeHex,
  themeFromPreset,
} from "@/lib/card-maker";
import type { ContactCardTheme } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type CardThemePickerProps = {
  value: ContactCardTheme;
  onChange: (theme: ContactCardTheme) => void;
};

export function CardThemePicker({ value, onChange }: CardThemePickerProps) {
  const [hexDraft, setHexDraft] = useState(value.primary);
  const isCustom = value.presetId === "custom";

  const applyCustomHex = (raw: string) => {
    setHexDraft(raw);
    const normalized = normalizeHex(raw);
    if (!normalized) {
      return;
    }
    onChange({ presetId: "custom", primary: normalized });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2.5">
        {CARD_THEME_PRESETS.map((preset) => {
          const selected = !isCustom && value.presetId === preset.id;
          const checkColor = contrastForeground(preset.primary);
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              aria-label={`Theme ${preset.label}`}
              aria-pressed={selected}
              onClick={() => {
                const next = themeFromPreset(preset.id);
                setHexDraft(next.primary);
                onChange(next);
              }}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-[10px] border transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                selected
                  ? "border-foreground scale-105 shadow-sm"
                  : "border-black/10 hover:scale-105",
              )}
              style={{
                backgroundColor: preset.primary,
                boxShadow: selected
                  ? `inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 12px ${preset.primary}55`
                  : "inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              {selected ? (
                <Check
                  className="h-3.5 w-3.5 drop-shadow"
                  style={{ color: checkColor }}
                  aria-hidden="true"
                  strokeWidth={3}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <label
          className={cn(
            "relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border",
            isCustom ? "ring-2 ring-ring" : "bg-muted",
          )}
          style={{
            backgroundColor: isCustom
              ? (normalizeHex(value.primary) ?? value.primary)
              : undefined,
          }}
          title="Custom color"
        >
          {!isCustom ? (
            <Pipette
              className="pointer-events-none absolute h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
          <input
            type="color"
            value={normalizeHex(value.primary) ?? "#C4A882"}
            onChange={(event) => {
              const next = event.target.value.toUpperCase();
              setHexDraft(next);
              onChange({ presetId: "custom", primary: next });
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Pick custom card color"
          />
        </label>
        <div className="min-w-0 flex-1">
          <Input
            value={hexDraft}
            onChange={(event) => applyCustomHex(event.target.value)}
            placeholder="#C4A882"
            spellCheck={false}
            aria-label="Custom hex color"
            className="font-mono uppercase"
          />
        </div>
      </div>
    </div>
  );
}
