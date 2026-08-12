import { cn } from "@/lib/utils";

export type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name — the visible label is usually the row it sits in. */
  label: string;
  disabled?: boolean;
  /** Native tooltip, used to explain why a switch is inert. */
  title?: string;
  className?: string;
};

/**
 * A two-state switch, for settings that apply the moment they are flipped.
 *
 * Deliberately not a checkbox: checkboxes in this app sit inside forms and wait
 * for a Save, and using the same control for both meanings is what made "tick
 * Include, nothing happens" so hard to read.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  title,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        checked ? "border-foreground bg-foreground" : "border-border bg-secondary",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className,
      )}
    >
      <span
        className={cn(
          "h-3.5 w-3.5 rounded-full bg-surface shadow-sm transition-transform duration-150",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}
