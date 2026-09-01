import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/cn";

/**
 * Rule — the hairline that does the separating work shadows would otherwise do (§8.7).
 *
 * Always a real CSS `border`, never a faked one: a hairline drawn as a shadow does not
 * survive `html-to-image` rasterisation, so a card exported to PNG would silently lose
 * its rules.
 * Always 1px, never 0.5px — sub-pixel hairlines vanish at non-integer DPRs.
 *
 * `tone="control"` is `--line-control` (3.46:1) and is what a control boundary must use;
 * the default `--line` is 1.41:1 and is decorative only.
 */

export interface RuleProps extends ComponentPropsWithRef<"div"> {
  orientation?: "horizontal" | "vertical";
  tone?: "default" | "control";
  /** Inset by `--hairline-inset-offset` — the framing device the Passage template uses. */
  inset?: boolean;
  /** Removes it from the accessibility tree. Use when the rule adds no structure. */
  decorative?: boolean;
}

export function Rule({
  orientation = "horizontal",
  tone = "default",
  inset = false,
  decorative = false,
  className,
  ...rest
}: RuleProps) {
  return (
    <div
      {...rest}
      role={decorative ? undefined : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      aria-hidden={decorative ? "true" : undefined}
      data-tone={tone}
      className={cn(
        "shrink-0",
        orientation === "horizontal" ? "w-full border-t" : "h-full self-stretch border-l",
        tone === "control" ? "border-line-control" : "border-line",
        inset && (orientation === "horizontal" ? "mx-3" : "my-3"),
        className,
      )}
    />
  );
}
