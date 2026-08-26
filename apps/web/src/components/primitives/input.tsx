"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Field, controlClassName } from "./label";

/**
 * Text input — 40px box, `--radius-sm`, `--line-control` boundary (§8.6, §8.3).
 *
 * The label is a required prop, not an optional convenience: AC-25 sweeps every route
 * with axe and an unlabelled input is a serious violation. Use `hideLabel` when the
 * design has no room for it — the label stays in the accessibility tree either way.
 */

export interface InputProps extends Omit<ComponentPropsWithRef<"input">, "size"> {
  label: ReactNode;
  hideLabel?: boolean;
  hint?: ReactNode;
  /** Presence makes the field invalid and announces the message with `role="alert"`. */
  error?: ReactNode;
  disabledReason?: ReactNode;
  /** Country code, currency symbol, search glyph — sits inside the boundary. */
  leadingAddon?: ReactNode;
  /** Clear button, unit, character count. */
  trailingAddon?: ReactNode;
  /** Class for the label+control+message stack, not the `<input>`. */
  fieldClassName?: string;
}

export function Input({
  label,
  hideLabel,
  hint,
  error,
  disabledReason,
  leadingAddon,
  trailingAddon,
  fieldClassName,
  className,
  id,
  required,
  readOnly,
  ...rest
}: InputProps) {
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
      {({ id: controlId, describedBy, invalid }) => {
        const control = (
          <input
            {...rest}
            id={controlId}
            required={required}
            readOnly={readOnly}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            data-readonly={readOnly ? "true" : undefined}
            className={
              leadingAddon || trailingAddon
                ? cn("h-10 min-w-0 flex-1 bg-transparent text-base text-ink", "placeholder:text-ink-3", className)
                : controlClassName({ invalid, readOnly, className: cn("h-10", className) })
            }
          />
        );

        if (!leadingAddon && !trailingAddon) return control;

        // Addons live inside the boundary so the whole assembly reads as one control.
        return (
          <div
            className={controlClassName({
              invalid,
              readOnly,
              className: "flex items-center gap-2 px-3",
            })}
          >
            {leadingAddon ? (
              <span className="shrink-0 text-sm text-ink-3">{leadingAddon}</span>
            ) : null}
            {control}
            {trailingAddon ? <span className="shrink-0">{trailingAddon}</span> : null}
          </div>
        );
      }}
    </Field>
  );
}
