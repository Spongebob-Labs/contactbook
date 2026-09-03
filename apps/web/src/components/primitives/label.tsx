"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Label, plus the field shell every labelled control in this directory shares.
 *
 * AC-25 is decided here: a control with no programmatic label is a serious axe
 * violation on every route it appears on, so `Field` owns id generation and the
 * `aria-describedby` wiring rather than trusting thirteen call sites to remember.
 *
 * Radix `Label` (not a bare `<label>`) because it also suppresses text selection on
 * double-click, which is the small behaviour that makes a form feel hand-built.
 */

export interface LabelProps extends ComponentPropsWithRef<typeof LabelPrimitive.Root> {
  /** Renders the decorative asterisk. `required` on the control is what AT announces. */
  required?: boolean;
  /** Visually hidden but still in the accessibility tree (§8D.3 search field). */
  srOnly?: boolean;
}

export function Label({ required, srOnly, className, children, ...rest }: LabelProps) {
  return (
    <LabelPrimitive.Root
      {...rest}
      className={cn("text-sm text-ink", srOnly && "sr-only", className)}
    >
      {children}
      {required ? (
        <span aria-hidden="true" className="text-danger">
          {" "}
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  );
}

export interface FieldChildArgs {
  /** Put this on the control — `Field` has already pointed the label at it. */
  id: string;
  /**
   * The label element's id. Radix's Select/Checkbox/Switch/Radio roots are `<button>`s,
   * and HTML-AAM names a button from its *content*, not from an associated `<label>` —
   * so those controls must point at this with `aria-labelledby` or they end up named
   * after their own value. That is the AC-25 trap in this directory.
   */
  labelId: string;
  /** Hint and error ids, pre-joined. Undefined when there is neither. */
  describedBy: string | undefined;
  invalid: boolean;
}

export interface FieldProps {
  label: ReactNode;
  /** Keeps the label in the accessibility tree and out of the layout. */
  hideLabel?: boolean;
  hint?: ReactNode;
  /** Presence of an error is what makes the field invalid — there is no separate flag. */
  error?: ReactNode;
  required?: boolean;
  /** Why the control is unavailable, announced through `aria-describedby` (§8D.7). */
  disabledReason?: ReactNode;
  id?: string;
  className?: string;
  children: (args: FieldChildArgs) => ReactNode;
}

/**
 * Label + control + hint/error, with the ARIA already joined up.
 *
 * The error is `role="alert"` because §8D.2 requires validation failures to be
 * announced, not merely rendered.
 */
export function Field({
  label,
  hideLabel = false,
  hint,
  error,
  required = false,
  disabledReason,
  id,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? `${generatedId}-control`;
  const hintId = hint ? `${generatedId}-hint` : undefined;
  const errorId = error ? `${generatedId}-error` : undefined;
  const reasonId = disabledReason ? `${generatedId}-reason` : undefined;
  const describedBy = [hintId, errorId, reasonId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label
        htmlFor={controlId}
        id={`${controlId}-label`}
        required={required}
        srOnly={hideLabel}
      >
        {label}
      </Label>

      {children({
        id: controlId,
        labelId: `${controlId}-label`,
        describedBy,
        invalid: Boolean(error),
      })}

      {hint ? (
        <p id={hintId} className="text-sm text-ink-3">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {disabledReason ? (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The shared control skin — inputs, textareas and the select trigger.
 *
 * `--line-control` (3.46:1 on paper), never `--line` (1.41:1, decorative): a control
 * boundary is a non-text contrast target under 1.4.11 and AC-13 measures it.
 */
/**
 * The height every boxed form control resolves to — `<Input>`, `<Select>`'s trigger and
 * `<Input>`'s addon shell.
 *
 * ⚠ **44px on touch, 40px on a pointer.** §8D.7 specifies 40px and that is the right number for
 * a cursor, which is a single pixel. It is 4px under the floor a fingertip needs — Apple's HIG,
 * Android's Material guidance and WCAG 2.5.5 arrive at 44 independently — and these three
 * components are *every* text field, search box and dropdown in the product. Shipping the whole
 * form layer 4px short is a defect you feel as mis-taps rather than see as a broken layout.
 *
 * It is one constant rather than three `h-10`s because the addon shell wraps the input: if the
 * shell and the input inside it disagree by 4px, the field grows a visible seam.
 *
 * The breakpoint is `md`, the same line the shell uses to swap its rail for the bottom bar.
 */
export const CONTROL_HEIGHT = "h-10 max-md:h-11";

export function controlClassName({
  invalid = false,
  readOnly = false,
  className,
}: {
  invalid?: boolean;
  readOnly?: boolean;
  className?: string;
} = {}): string {
  return cn(
    "w-full rounded-sm border bg-surface px-3 text-base text-ink",
    "placeholder:text-ink-3 transition-colors duration-[var(--dur-fast)] ease-out",
    "disabled:cursor-not-allowed disabled:bg-surface-sunk disabled:text-ink-3",
    invalid ? "border-danger" : "border-line-control hover:border-ink-3",
    readOnly && "bg-surface-sunk",
    className,
  );
}
