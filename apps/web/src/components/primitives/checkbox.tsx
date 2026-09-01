"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Label } from "./label";

/**
 * Checkbox — Radix root, our 20px box.
 *
 * The root is a `<button role="checkbox">`, and HTML-AAM names a button from its own
 * content, so the label is wired with **`aria-labelledby`** as well as `htmlFor`. The
 * `htmlFor` is what makes the label text clickable; the `aria-labelledby` is what makes
 * the accessible name right (AC-25). Both are needed — neither alone is enough.
 *
 * `checked="indeterminate"` is the field-picker's "some fields in this group" state and
 * surfaces as `aria-checked="mixed"`.
 */

export interface CheckboxProps
  extends Omit<React.ComponentPropsWithRef<typeof CheckboxPrimitive.Root>, "children"> {
  label: ReactNode;
  /** Keeps the label in the accessibility tree and out of the layout. */
  hideLabel?: boolean;
  /** Secondary line under the label, wired through `aria-describedby`. */
  description?: ReactNode;
  invalid?: boolean;
  /** Class for the row, not the box. */
  rowClassName?: string;
}

export function Checkbox({
  label,
  hideLabel = false,
  description,
  invalid = false,
  id,
  className,
  rowClassName,
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const controlId = id ?? `${generatedId}-checkbox`;
  const labelId = `${controlId}-label`;
  const descriptionId = description ? `${controlId}-description` : undefined;

  return (
    // Centred against the label when it is one line; top-aligned once a description
    // gives the row height. Neither needs an off-scale nudge (§8.5).
    <div
      className={cn("flex gap-3", description ? "items-start" : "items-center", rowClassName)}
    >
      <CheckboxPrimitive.Root
        {...rest}
        id={controlId}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        aria-invalid={invalid || undefined}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-xs border bg-surface",
          "text-accent-ink transition-colors duration-[var(--dur-fast)] ease-out",
          "data-[state=checked]:bg-accent data-[state=checked]:border-accent",
          "data-[state=indeterminate]:bg-accent data-[state=indeterminate]:border-accent",
          "disabled:cursor-not-allowed disabled:bg-surface-sunk disabled:text-ink-3",
          invalid ? "border-danger" : "border-line-control",
          className,
        )}
      >
        <CheckboxPrimitive.Indicator className="inline-flex items-center justify-center">
          {rest.checked === "indeterminate" ? (
            <Minus aria-hidden="true" className="size-4" />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>

      <div className={cn("flex min-w-0 flex-col gap-1", hideLabel && "sr-only")}>
        <Label id={labelId} htmlFor={controlId} className="cursor-pointer">
          {label}
        </Label>
        {description ? (
          <p id={descriptionId} className="text-sm text-ink-3">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
