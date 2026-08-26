"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Field, controlClassName } from "./label";

/**
 * Select — Radix for the behaviour (typeahead, roving focus, Escape, scroll-into-view),
 * every pixel of the look ours (Q29).
 *
 * ⚠ ELEVATION. §8.7 lists the select menu under `--elevation-1`, but F-09 scopes every
 * elevation declaration to `src/components/overlay/**` and this is not that directory.
 * The content therefore carries `data-elevation="1"` — the §13.2 contract attribute —
 * and separates itself from the page with an opaque `--surface-raised` ground plus a
 * `--line-control` boundary. T08 owns the `[data-elevation]` styling; declaring it here
 * would fail AC-15.
 */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label: ReactNode;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  disabledReason?: ReactNode;
  placeholder?: string;
  /** The common case. For groups or custom rows, pass `children` of `SelectOptionItem`. */
  items?: readonly SelectOption[];
  children?: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  /** Class for the trigger. */
  className?: string;
  /** Class for the label+control+message stack. */
  fieldClassName?: string;
  contentClassName?: string;
}

export function Select({
  label,
  hideLabel,
  hint,
  error,
  required,
  disabled,
  disabledReason,
  placeholder = "Select…",
  items,
  children,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  className,
  fieldClassName,
  contentClassName,
}: SelectProps) {
  return (
    <Field
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      disabledReason={disabledReason}
      id={id}
      className={fieldClassName}
    >
      {({ id: controlId, labelId, describedBy, invalid }) => (
        <SelectPrimitive.Root
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          name={name}
          required={required}
          disabled={disabled}
        >
          <SelectPrimitive.Trigger
            id={controlId}
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={controlClassName({
              invalid,
              className: cn(
                "flex h-10 items-center justify-between gap-2 text-left",
                "data-[placeholder]:text-ink-3",
                className,
              ),
            })}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon asChild>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={4}
              data-elevation="1"
              className={cn(
                "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden",
                "rounded-sm border border-line-control bg-surface-raised text-ink",
                contentClassName,
              )}
            >
              <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-ink-3">
                <ChevronUp aria-hidden="true" className="size-4" />
              </SelectPrimitive.ScrollUpButton>

              <SelectPrimitive.Viewport className="p-1">
                {items?.map((item) => (
                  <SelectOptionItem key={item.value} value={item.value} disabled={item.disabled}>
                    {item.label}
                  </SelectOptionItem>
                ))}
                {children}
              </SelectPrimitive.Viewport>

              <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-ink-3">
                <ChevronDown aria-hidden="true" className="size-4" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      )}
    </Field>
  );
}

export interface SelectOptionItemProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/** One row. Exported so a caller can build grouped or richer menus by composition. */
export function SelectOptionItem({
  value,
  disabled,
  className,
  children,
}: SelectOptionItemProps) {
  return (
    <SelectPrimitive.Item
      value={value}
      disabled={disabled}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md py-2 pl-8 pr-3",
        "text-base text-ink",
        "data-highlighted:bg-accent-wash data-highlighted:text-ink",
        "data-[state=checked]:text-accent",
        "data-disabled:pointer-events-none data-disabled:text-ink-3",
        className,
      )}
    >
      <span className="absolute left-2 inline-flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check aria-hidden="true" className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

/** Section heading inside a long menu (the country list is the real consumer). */
export function SelectGroupLabel({ children }: { children: ReactNode }) {
  return (
    <SelectPrimitive.Label className="px-3 py-2 text-overline uppercase text-ink-3">
      {children}
    </SelectPrimitive.Label>
  );
}

export const SelectGroup = SelectPrimitive.Group;
export const SelectSeparator = () => (
  // A real border, like every other hairline in the system (§8.7).
  <SelectPrimitive.Separator className="my-1 border-t border-line" />
);
