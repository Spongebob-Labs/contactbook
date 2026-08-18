import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Field, SectionIntro } from "@/components/cards/builder/builder-parts";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type {
  CardButtonStyle,
  CardCorner,
  CardFontPair,
  CardLayout,
  CardSnapshot,
  CardTheme,
} from "@/lib/card-schema";
import { CARD_THEMES, backgroundCss } from "@/lib/card-themes";
import { cn } from "@/lib/utils";

const LAYOUTS: Array<{ value: CardLayout; label: string; hint: string }> = [
  { value: "stack", label: "Stack", hint: "Buttons down the page" },
  { value: "cardface", label: "Card face", hint: "Panel with a QR" },
  { value: "compact", label: "Compact", hint: "Dense contact list" },
];

const FONT_PAIRS: Array<{ value: CardFontPair; label: string }> = [
  { value: "sans", label: "Sans" },
  { value: "serif-display", label: "Serif headings" },
  { value: "serif", label: "Serif" },
  { value: "geometric", label: "Geometric" },
  { value: "humanist", label: "Humanist" },
  { value: "mono", label: "Mono" },
];

const BUTTON_STYLES: Array<{ value: CardButtonStyle; label: string }> = [
  { value: "filled", label: "Filled" },
  { value: "outline", label: "Outline" },
  { value: "soft", label: "Soft" },
  { value: "shadow", label: "Hard shadow" },
];

const CORNERS: Array<{ value: CardCorner; label: string }> = [
  { value: "sharp", label: "Sharp" },
  { value: "soft", label: "Soft" },
  { value: "round", label: "Round" },
  { value: "pill", label: "Pill" },
];

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/**
 * Design controls.
 *
 * Picking a preset replaces the whole theme; nudging any individual control
 * re-labels it "custom". That keeps the preset grid honest — a swatch stays
 * selected only while the card still actually looks like it.
 */
export function DesignSection({
  snapshot,
  onChange,
}: {
  snapshot: CardSnapshot;
  onChange: (next: CardSnapshot) => void;
}) {
  const { theme } = snapshot;

  const setTheme = (next: CardTheme) => onChange({ ...snapshot, theme: next });

  /** Any hand edit detaches the card from its preset. */
  const tweak = (partial: Partial<CardTheme>) =>
    setTheme({ ...theme, ...partial, id: "custom" });

  const solidColor =
    theme.background.kind === "solid" ? theme.background.color : "";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <SectionIntro
          title="Layout"
          hint="Changes the structure. Themes change the look."
        />
        <div className="grid grid-cols-3 gap-2">
          {LAYOUTS.map((option) => {
            const selected = snapshot.layout === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onChange({ ...snapshot, layout: option.value })
                }
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors duration-150",
                  selected
                    ? "border-foreground bg-secondary"
                    : "border-border hover:bg-bg-hover",
                )}
              >
                <span className="text-[13px] font-semibold text-foreground">
                  {option.label}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionIntro
          title="Theme"
          hint={
            theme.id === "custom"
              ? "Custom — pick a preset to start over."
              : undefined
          }
        />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {CARD_THEMES.map((preset) => {
            const selected = theme.id === preset.id;
            const { label: _label, ...bare } = preset;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={selected}
                onClick={() => setTheme(bare)}
                className={cn(
                  "relative flex aspect-[3/4] items-end justify-center overflow-hidden rounded-lg border transition-transform duration-150 hover:scale-[1.03]",
                  selected
                    ? "border-foreground ring-2 ring-foreground/20"
                    : "border-border",
                )}
                style={{ background: backgroundCss(preset.background) }}
              >
                <span
                  className="mb-1.5 h-1.5 w-6 rounded-full"
                  style={{ backgroundColor: preset.accent }}
                  aria-hidden="true"
                />
                {selected ? (
                  <span
                    className="absolute inset-x-0 top-1 flex justify-center"
                    aria-hidden="true"
                  >
                    <Check
                      className="h-3.5 w-3.5"
                      strokeWidth={3}
                      style={{ color: preset.textColor }}
                    />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionIntro title="Fine tuning" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Typeface">
            <Select
              value={theme.fontPair}
              onChange={(event) =>
                tweak({ fontPair: event.target.value as CardFontPair })
              }
            >
              {FONT_PAIRS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Buttons">
            <Select
              value={theme.buttonStyle}
              onChange={(event) =>
                tweak({ buttonStyle: event.target.value as CardButtonStyle })
              }
            >
              {BUTTON_STYLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Corners">
            <Select
              value={theme.corners}
              onChange={(event) =>
                tweak({ corners: event.target.value as CardCorner })
              }
            >
              {CORNERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Accent">
            <ColorInput
              value={theme.accent}
              onChange={(accent) => tweak({ accent })}
            />
          </Field>

          {solidColor ? (
            <Field label="Background">
              <ColorInput
                value={solidColor}
                onChange={(color) =>
                  tweak({ background: { kind: "solid", color } })
                }
              />
            </Field>
          ) : null}

          <Field label="Text">
            <ColorInput
              value={theme.textColor}
              onChange={(textColor) => tweak({ textColor })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/**
 * Swatch plus hex entry.
 *
 * The text field keeps its own draft: only a complete six-digit hex is
 * committed upward, so a half-typed "#1B24" never reaches the snapshot and
 * fails schema validation on publish — but the user can still see what they
 * are typing, which a strictly controlled input would prevent.
 */
function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // Resync when the value changes elsewhere — picking a preset, for instance.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border">
        <span
          className="absolute inset-0"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Pick colour"
        />
      </label>
      <Input
        value={draft}
        spellCheck={false}
        maxLength={7}
        className="font-mono uppercase"
        onChange={(event) => {
          const next = event.target.value.trim().toUpperCase();
          setDraft(next);
          if (HEX_PATTERN.test(next)) {
            onChange(next);
          }
        }}
        onBlur={() => setDraft(value)}
      />
    </div>
  );
}
