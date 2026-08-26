import { TriangleAlert } from "lucide-react";
import type { ReactElement } from "react";

import { EMPTY_CARD_NOTE } from "@/components/app";

/**
 * §11 E-01 — **the single most important guard in this run.**
 *
 * ## The bug, in numbers
 *
 * The old build shipped card `5a286f9e` with zero field mappings. Its generated `.vcf` was
 * **73 bytes** — an `FN` and an `N` and nothing else. Worse, presets were ranked
 * `updatedAt desc`, so the newest card, which is always the freshly created empty one, was
 * preselected; copying it copied nothing. Somebody handed that card out and gave people a name
 * and no way to reach anyone.
 *
 * ## Three properties, all deliberate
 *
 * · **Persistent.** There is no dismiss control, and one must never be added. A warning you can
 *   close is a warning that gets closed.
 * · **It states the consequence, not the count.** "0 fields" is a number; "anyone who scans it
 *   will only get your name" is what actually happens. The sentence is composed from
 *   `EMPTY_CARD_NOTE`, which the field-count meter also prints, so the product cannot end up
 *   describing this in two voices.
 * · **It carries the way out.** "Add fields" is a `<Link>` to `/profile` — the fix for an empty
 *   card is fields in the profile, and §8D.4 forbids an embedded editor here.
 *
 * ## What is NOT here
 *
 * The preview. The builder keeps rendering the card — name only — beside this bar, because a
 * consequence nobody can see is a consequence nobody acts on. Swapping the card for an empty
 * state would be the helpful-looking change that hides the whole point.
 *
 * The Save block is not here either: the reason travels with the button (`disabledReason` on
 * `<Button>`), so a screen-reader user reaches the explanation from the control they are
 * standing on rather than only from a banner they may never land on.
 */

/** §11 E-01's sentence, verbatim, and the one place it is written. */
export const EMPTY_CARD_WARNING_TEXT = `This card maps 0 fields. ${EMPTY_CARD_NOTE}`;

/**
 * Why Save is unavailable, wired to the button through `aria-describedby`.
 *
 * Second person and actionable: it says what to do, not what went wrong. §6.10 — no error
 * codes, no jargon.
 */
export const EMPTY_CARD_SAVE_REASON =
  "You can't save a card that maps no fields — tick at least one field first.";

/**
 * ⚠ **A button, not a link to `/profile`.**
 *
 * E-01's action used to navigate away, which threw the builder session out to fix a problem the
 * builder itself can now fix: the Add-field dialog both picks an existing field and authors a new
 * one. Leaving the screen to answer "this card maps 0 fields" was the longest possible route to
 * the shortest possible fix.
 *
 * `[data-add-fields]` is kept as the handle for it, so the e2e suite still addresses one control
 * for this action — only what it does changed.
 */
export function EmptyCardWarning({ onAddFields }: { onAddFields: () => void }): ReactElement {
  return (
    <div
      data-empty-card-warning=""
      /* `role="status"` rather than `alert`: the bar is present from the first frame on a card
         that maps nothing, and an assertive live region on load talks over the page title.
         It is polite when it appears mid-edit, which is when it is news. */
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg bg-warning-wash px-5 py-4"
    >
      <TriangleAlert
        aria-hidden="true"
        className="size-5 shrink-0 text-warning-ink"
      />

      <p
        data-empty-card-warning-text=""
        data-prose
        className="min-w-0 flex-1 text-sm text-warning-ink"
      >
        {EMPTY_CARD_WARNING_TEXT}
      </p>

      <button
        type="button"
        data-add-fields=""
        onClick={onAddFields}
        className="text-sm text-warning-ink underline underline-offset-4"
      >
        Add fields
      </button>
    </div>
  );
}
