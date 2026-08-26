"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Field, controlClassName } from "./label";

/**
 * Multi-line input — the same field contract as `Input`, so a screen can swap one for
 * the other without relearning the props. `resize-y` only: a horizontally resizable
 * textarea breaks the 68-character measure cap (§8.4).
 */

export interface TextAreaProps extends ComponentPropsWithRef<"textarea"> {
  label: ReactNode;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  disabledReason?: ReactNode;
  fieldClassName?: string;
}

export function TextArea({
  label,
  hideLabel,
  hint,
  error,
  disabledReason,
  fieldClassName,
  className,
  id,
  required,
  readOnly,
  rows = 3,
  ...rest
}: TextAreaProps) {
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
      {({ id: controlId, describedBy, invalid }) => (
        <textarea
          {...rest}
          id={controlId}
          rows={rows}
          required={required}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          data-readonly={readOnly ? "true" : undefined}
          className={controlClassName({
            invalid,
            readOnly,
            className: cn("resize-y py-2 leading-normal", className),
          })}
        />
      )}
    </Field>
  );
}
