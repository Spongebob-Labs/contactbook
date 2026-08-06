import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
  /** Secondary line, e.g. the contact's phone number. */
  description?: string;
};

type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  isLoading?: boolean;
  disabled?: boolean;
  /** Selection cap; unselected rows are disabled once reached. */
  maxSelected?: number;
  className?: string;
  id?: string;
  "aria-labelledby"?: string;
};

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select options",
  searchPlaceholder = "Search",
  emptyMessage = "No matches",
  loadingMessage = "Loading…",
  isLoading = false,
  disabled = false,
  maxSelected,
  className,
  id,
  "aria-labelledby": ariaLabelledBy,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(option.value)),
    [options, selectedSet],
  );
  const atLimit = maxSelected !== undefined && value.length >= maxSelected;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  const toggleOption = (optionValue: string) => {
    if (selectedSet.has(optionValue)) {
      onValueChange(value.filter((item) => item !== optionValue));
      return;
    }
    if (atLimit) {
      return;
    }
    onValueChange([...value, optionValue]);
  };

  const triggerLabel =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions.length} selected`;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        id={id}
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={cn(
            "truncate",
            selectedOptions.length === 0 && "text-muted-foreground",
          )}
        >
          {triggerLabel}
        </span>
        <ChevronsUpDown
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </Button>

      {selectedOptions.length > 0 && (
        <ul className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto overscroll-contain">
          {selectedOptions.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleOption(option.value)}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-[#374151] transition-colors duration-150 hover:bg-bg-hover disabled:opacity-60"
              >
                <span className="truncate">{option.label}</span>
                <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="sr-only">Remove {option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
          <div
            className="mt-2 max-h-[min(14rem,40vh)] overflow-y-auto overscroll-contain"
            role="listbox"
            aria-multiselectable="true"
          >
            {isLoading ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {loadingMessage}
              </p>
            ) : filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={!isSelected && atLimit}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
                      isSelected && "bg-muted text-foreground",
                    )}
                    onClick={() => toggleOption(option.value)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })
            )}
          </div>
          {maxSelected !== undefined && (
            <p className="border-t border-border px-3 pb-1 pt-2 text-xs text-muted-foreground">
              {value.length} of {maxSelected} selected
            </p>
          )}
        </div>
      )}
    </div>
  );
}
