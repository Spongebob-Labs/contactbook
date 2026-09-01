import { cn } from "@/lib/cn";

/**
 * `STEP n OF 6` over a six-segment hairline bar — spec §8D.2, AC-28.
 *
 * ## Why the number is text and the bar is decoration
 * The bar is `aria-hidden`: six 1px rules cannot say "you are on step three of six" to
 * anyone who is not looking at them, and a `role="progressbar"` would announce a
 * percentage, which is not what this is. The overline above it carries the whole meaning in
 * words, so the bar is free to be purely typographic — which is also why it is a hairline
 * rather than a filled track with a rounded cap. Flat surfaces, hairline rules (§8C.2).
 *
 * The literal `STEP 3 OF 6` is uppercase in the DOM rather than in CSS. `--text-overline`
 * carries the tracking, not the casing, and a test that reads the rendered step number
 * should read the same characters a person does.
 */

export interface AuthProgressProps {
  /** 1-based. */
  step: number;
  total: number;
  className?: string;
}

export function AuthProgress({ step, total, className }: AuthProgressProps) {
  const segments = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div
      data-auth-progress=""
      data-auth-step={step}
      data-auth-total={total}
      className={cn("flex flex-col gap-3", className)}
    >
      <p className="text-overline text-ink-3">{`STEP ${step} OF ${total}`}</p>

      <div aria-hidden="true" className="flex items-center gap-1">
        {segments.map((segment) => (
          <span
            key={segment}
            data-auth-segment={segment}
            data-auth-segment-filled={segment <= step ? "true" : "false"}
            className={cn("h-px flex-1", segment <= step ? "bg-ink" : "bg-line")}
          />
        ))}
      </div>
    </div>
  );
}
