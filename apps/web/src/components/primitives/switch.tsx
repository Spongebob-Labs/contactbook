"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Label } from "./label";
import { TOUCH_HIT_44_Y } from "./touch-target";

/**
 * Switch — an immediate on/off, never a deferred one. If the change needs a Save button
 * it is a Checkbox, not a Switch.
 *
 * The unchecked track is `--line-control` (3.46:1 on paper), never `--line`: the track
 * is a control boundary and 1.4.11 measures it (AC-13). Same `aria-labelledby` +
 * `htmlFor` pairing as Checkbox, for the same HTML-AAM reason.
 */

export interface SwitchProps
  extends Omit<React.ComponentPropsWithRef<typeof SwitchPrimitive.Root>, "children"> {
  label: ReactNode;
  hideLabel?: boolean;
  description?: ReactNode;
  /** Put the control before the label — the profile row reads better that way. */
  labelPosition?: "start" | "end";
  rowClassName?: string;
}

export function Switch({
  label,
  hideLabel = false,
  description,
  labelPosition = "start",
  id,
  className,
  rowClassName,
  ...rest
}: SwitchProps) {
  const generatedId = useId();
  const controlId = id ?? `${generatedId}-switch`;
  const labelId = `${controlId}-label`;
  const descriptionId = description ? `${controlId}-description` : undefined;

  const text = (
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
  );

  const control = (
    <SwitchPrimitive.Root
      {...rest}
      id={controlId}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1",
        /* The track is 44px wide and 24px tall, so only the vertical axis is short — hence the
           `_Y` variant, which grows the region up and down and leaves the width alone. Rendered
           once per profile field row, where `hideLabel` is used and this is the only target.
           See `touch-target.ts`. */
        TOUCH_HIT_44_Y,
        "bg-line-control transition-colors duration-[var(--dur-fast)] ease-out",
        "data-[state=checked]:bg-accent",
        "disabled:cursor-not-allowed disabled:bg-ink-4",
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-surface-raised",
          "transition-transform duration-[var(--dur-fast)] ease-out",
          "data-[state=checked]:translate-x-5",
        )}
      />
    </SwitchPrimitive.Root>
  );

  return (
    <div className={cn("flex items-center justify-between gap-4", rowClassName)}>
      {labelPosition === "start" ? (
        <>
          {text}
          {control}
        </>
      ) : (
        <>
          {control}
          {text}
        </>
      )}
    </div>
  );
}
