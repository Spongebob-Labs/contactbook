import { TriangleAlert } from "lucide-react";

import { canBuildVcf } from "@/card/build-vcf";
import { Badge } from "@/components/primitives/badge";
import { cn } from "@/lib/cn";
import type { ResolvedCard } from "@/types/domain";

/**
 * `FieldCountMeter` — **AC-36, and the most important component in this directory.**
 *
 * ## The bug this exists to prevent, stated plainly
 * The old build shipped card `5a286f9e` with **zero** field mappings. Its generated `.vcf`
 * was **73 bytes** — `FN` and `N` and nothing else. Worse, presets were ranked
 * `updatedAt desc`, so the newest card, which is always the freshly-created empty one, was
 * preselected, and copying it copied nothing. A user who handed that card out gave people a
 * name and no way to reach anyone. The fixtures reproduce it deliberately: `card_empty_demo`
 * maps no fields *and* is the newest card by `updatedAt`, so any recency-sorted list puts it
 * first.
 *
 * ## Why it takes a `ResolvedCard` and not a number
 * Because a number invites `count > 0` at the call site, and a second definition of "this
 * card shares nothing" is exactly how the guard rots. `canBuildVcf` (T11) is the single
 * definition and it is read here, once. Two consequences follow from that and both matter:
 *
 * - a **links-only** card is *not* empty. `fieldCount` counts `fields` **and** `socialFields`
 *   together (§6.4), so a card mapping only social links still shares something. A local
 *   count taken over `resolved.fields` alone would warn on a perfectly good card.
 * - if the definition ever changes, it changes in one place, and `buildVcf`'s throw, the
 *   builder's disabled Save (T23) and the public card's absent button (T18) all move with it.
 *
 * ## The two variants
 * `badge` is the tile marker (§8D.3's "field-count badge"); `meter` is the persistent
 * builder-header meter of §8D.4. Both carry `data-field-count` (§13.2) and the same
 * `data-field-count-state`, so one selector covers every surface.
 *
 * The zero state says so **in words**. Colour alone is not a status (§8D.1), and the
 * consequence — not the count — is what the reader needs.
 */

/** §11 E-01's consequence, in the owner's language. The count alone does not explain it. */
export const EMPTY_CARD_NOTE = "Anyone who scans it will only get your name.";

/** "1 field", "5 fields" — the singular is the only special case. */
export function fieldCountLabel(count: number): string {
  return count === 1 ? "1 field" : `${count} fields`;
}

export interface FieldCountMeterProps {
  /** The same `ResolvedCard` the preview and the payload share (I-5). */
  resolved: ResolvedCard;
  /** `badge` for a tile caption, `meter` for the builder header (§8D.4). */
  variant?: "badge" | "meter";
  /**
   * Whether the zero state spells out its consequence here.
   *
   * `meter` only, and `false` in exactly one place: the card builder, whose §11 E-01 warning bar
   * carries that sentence verbatim two lines below. Printing it in both makes the same warning
   * appear twice on one screen and neither copy the authority — the same reasoning the
   * card-detail screen applies when it lets this component be the sole owner of the sentence.
   * The count still turns `--warning-ink` and `data-field-count-state` still reads `empty`, so
   * nothing that *checks* the state changes.
   */
  note?: boolean;
  className?: string;
}

export function FieldCountMeter({
  resolved,
  variant = "badge",
  note = true,
  className,
}: FieldCountMeterProps) {
  const count = resolved.fieldCount;
  // The one guard. Never a local comparison — see the module note.
  const shares = canBuildVcf(resolved);
  const state = shares ? "sharing" : "empty";

  if (variant === "meter") {
    return (
      <p
        data-field-count-meter="meter"
        data-field-count={count}
        data-field-count-state={state}
        className={cn("inline-flex flex-wrap items-baseline gap-2 text-sm", className)}
      >
        <span className="text-ink-3">Field count</span>
        <span
          data-field-count-value=""
          className={cn("tabular-nums", shares ? "text-ink" : "text-warning-ink")}
        >
          {count}
        </span>
        {shares || !note ? null : (
          <span className="text-xs text-warning-ink">{EMPTY_CARD_NOTE}</span>
        )}
      </p>
    );
  }

  return (
    <Badge
      data-field-count-meter="badge"
      data-field-count={count}
      data-field-count-state={state}
      tone={shares ? "neutral" : "warning"}
      icon={shares ? undefined : <TriangleAlert aria-hidden="true" className="size-4" />}
      {...(shares ? {} : { title: EMPTY_CARD_NOTE })}
    >
      {fieldCountLabel(count)}
      {/* Spoken, not merely coloured: a warning nobody can hear is not a warning. */}
      {shares ? null : <span className="sr-only"> — {EMPTY_CARD_NOTE}</span>}
    </Badge>
  );
}
