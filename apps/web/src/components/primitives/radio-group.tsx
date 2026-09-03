"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Field } from "./label";
import { TOUCH_HIT_44 } from "./touch-target";

/**
 * RadioGroup — Radix owns the roving tabindex and the arrow-key wrap, which is the part
 * hand-rolled radio groups always get wrong and axe always catches.
 *
 * One group label (`aria-labelledby` on the radiogroup) plus one label per radio: a
 * radio named only by its position in the DOM is a serious AC-25 violation.
 */

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  label: ReactNode;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  items: readonly RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  orientation?: "vertical" | "horizontal";
  className?: string;
  fieldClassName?: string;
}

export function RadioGroup({
  label,
  hideLabel,
  hint,
  error,
  required,
  disabled,
  items,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  orientation = "vertical",
  className,
  fieldClassName,
}: RadioGroupProps) {
  const generatedId = useId();

  return (
    <Field
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      id={id}
      className={fieldClassName}
    >
      {({ id: controlId, labelId, describedBy, invalid }) => (
        <RadioGroupPrimitive.Root
          id={controlId}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          name={name}
          required={required}
          disabled={disabled}
          orientation={orientation}
          className={cn(
            "flex gap-3",
            orientation === "vertical" ? "flex-col" : "flex-row flex-wrap items-center",
            className,
          )}
        >
          {items.map((item) => {
            const itemId = `${generatedId}-${item.value}`;
            const itemLabelId = `${itemId}-label`;
            const itemDescriptionId = item.description ? `${itemId}-description` : undefined;

            return (
              <div
                key={item.value}
                className={cn(
                  "flex gap-3",
                  item.description ? "items-start" : "items-center",
                )}
              >
                <RadioGroupPrimitive.Item
                  id={itemId}
                  value={item.value}
                  disabled={item.disabled}
                  aria-labelledby={itemLabelId}
                  aria-describedby={itemDescriptionId}
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                    "border bg-surface transition-colors duration-[var(--dur-fast)] ease-out",
                    /* 20px drawn, 44px reachable on touch. See `touch-target.ts`. */
                    TOUCH_HIT_44,
                    "data-[state=checked]:border-accent",
                    "disabled:cursor-not-allowed disabled:bg-surface-sunk",
                    invalid ? "border-danger" : "border-line-control",
                  )}
                >
                  <RadioGroupPrimitive.Indicator className="block size-2 rounded-full bg-accent" />
                </RadioGroupPrimitive.Item>

                <div className="flex min-w-0 flex-col gap-1">
                  <label
                    id={itemLabelId}
                    htmlFor={itemId}
                    className="cursor-pointer text-sm text-ink"
                  >
                    {item.label}
                  </label>
                  {item.description ? (
                    <p id={itemDescriptionId} className="text-sm text-ink-3">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </RadioGroupPrimitive.Root>
      )}
    </Field>
  );
}
