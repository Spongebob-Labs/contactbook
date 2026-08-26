"use client";

import {
  useEffect,
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Field, controlClassName } from "@/components/primitives";
import { OTP_LENGTH, digitsOnly } from "@/lib/auth-validation";
import { cn } from "@/lib/cn";

/**
 * Six single-character boxes — spec §8D.2 A-2, §11 E-47.
 *
 * ## The behaviours, and why each one is here
 * · **Auto-advance.** A digit moves focus to the next box. Without it the control is six
 *   inputs, not one code.
 * · **Backspace retreats.** Backspace in an empty box clears the box *before* it and lands
 *   there — the correction path people actually use, and the one that is missing from most
 *   hand-rolled OTP fields.
 * · **Paste distributes (E-47).** A six-digit paste into the first box fills all six and
 *   focuses the last. The same code path handles Android's autofill, which arrives as a
 *   single `change` carrying the whole code rather than as a paste event at all — hence the
 *   `raw.length > 1` branch in {@link handleChange} as well as the `onPaste` handler.
 * · **`autoComplete="one-time-code"`** on every box. iOS offers the code above the keyboard
 *   and fills the focused field; it is part of the spec and is not noise (§8D.2 trap list).
 * · **Non-digits never enter.** Everything routes through `digitsOnly`, so the field and
 *   `validateOtp` agree on what a digit is.
 *
 * ## Accessibility
 * T05's `Field` owns the label, the `role="alert"` error and the `aria-describedby` wiring
 * (§8D.2's announcement clause). Each box carries its own `Digit n of 6` name because
 * "Verification code" repeated six times tells a screen-reader user nothing about where
 * they are, and the boxes are grouped so the group name is still reachable.
 */

export interface OtpInputProps {
  /** 0–6 digits. The parent owns it; this component never holds a second copy. */
  value: string;
  onChange: (next: string) => void;
  error?: ReactNode;
  label?: string;
  disabled?: boolean;
  /** §8D.2: the first field is focused on mount. */
  autoFocus?: boolean;
  className?: string;
}

/**
 * ⚠ THE HOLE CHARACTER. Six boxes are a sparse array — clearing the third one must leave
 * the fourth where it is — but the answer they produce is a single string. A plain
 * `join("")` collapses the hole and silently shifts every digit after it left, which looks
 * like the field eating input. So an empty box is carried as a **space**, and only trailing
 * spaces are dropped so that "nothing typed" is still `""`.
 *
 * `validateOtp` needs no special case for this: a space is not a digit, so `"1 3456"` fails
 * on exactly the sentence it should — "Enter the 6-digit code."
 */
function slotsOf(value: string): string[] {
  return Array.from({ length: OTP_LENGTH }, (_, i) => {
    const character = value[i];
    return character === undefined || character === " " ? "" : character;
  });
}

function joinSlots(slots: readonly string[]): string {
  return slots
    .map((slot) => (slot === "" ? " " : slot))
    .join("")
    .replace(/ +$/, "");
}

export function OtpInput({
  value,
  onChange,
  error,
  label = "Verification code",
  disabled = false,
  autoFocus = true,
  className,
}: OtpInputProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const slots = slotsOf(value);

  useEffect(() => {
    if (autoFocus) boxes.current[0]?.focus();
  }, [autoFocus]);

  function focusBox(index: number) {
    const clamped = Math.min(Math.max(index, 0), OTP_LENGTH - 1);
    const box = boxes.current[clamped];
    box?.focus();
    box?.select();
  }

  /** Write `digits` into the boxes from `start`, then land on the last one written. */
  function distribute(start: number, digits: string) {
    if (digits.length === 0) return;
    const next = slotsOf(value);
    let cursor = start;
    for (const digit of digits) {
      if (cursor >= OTP_LENGTH) break;
      next[cursor] = digit;
      cursor += 1;
    }
    onChange(joinSlots(next));
    // Land on the next empty box, or stay on the last one when the code is full — which is
    // E-47's "focuses the last" for a six-digit paste into box one.
    focusBox(cursor >= OTP_LENGTH ? OTP_LENGTH - 1 : cursor);
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const raw = digitsOnly(event.target.value);

    if (raw.length === 0) {
      const next = slotsOf(value);
      next[index] = "";
      onChange(joinSlots(next));
      return;
    }

    // Typing replaces (the box selects itself on focus), so a multi-character value here is
    // an autofill or a paste the browser routed through `change` — distribute it.
    if (raw.length > 1) {
      distribute(index, raw.slice(0, OTP_LENGTH - index));
      return;
    }

    distribute(index, raw);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = slotsOf(value);
      if (next[index] === "") {
        // Empty box: clear and retreat.
        if (index > 0) {
          next[index - 1] = "";
          onChange(joinSlots(next));
          focusBox(index - 1);
        }
        return;
      }
      next[index] = "";
      onChange(joinSlots(next));
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      const next = slotsOf(value);
      next[index] = "";
      onChange(joinSlots(next));
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pasted = digitsOnly(event.clipboardData.getData("text"));
    if (pasted.length === 0) return;
    event.preventDefault();
    distribute(index, pasted.slice(0, OTP_LENGTH - index));
  }

  return (
    <Field label={label} hideLabel error={error}>
      {({ id, labelId, describedBy, invalid }) => (
        <div
          role="group"
          aria-labelledby={labelId}
          data-otp-input=""
          data-otp-length={OTP_LENGTH}
          className={cn("flex items-center gap-2", className)}
        >
          {slots.map((slot, index) => (
            <input
              key={index}
              ref={(node) => {
                boxes.current[index] = node;
              }}
              id={index === 0 ? id : undefined}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              disabled={disabled}
              value={slot}
              aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              data-otp-box={index}
              onChange={(event) => handleChange(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={(event) => handlePaste(index, event)}
              onFocus={(event) => event.currentTarget.select()}
              className={controlClassName({
                invalid,
                className: "h-13 min-w-0 flex-1 px-0 text-center text-lg tabular-nums",
              })}
            />
          ))}
        </div>
      )}
    </Field>
  );
}
