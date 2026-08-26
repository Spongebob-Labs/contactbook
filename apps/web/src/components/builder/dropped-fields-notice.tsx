import type { ReactElement } from "react";

import { fieldCountLabel } from "@/components/app";

/**
 * §11 E-40 — the profile moved underneath an open card.
 *
 * A card is a *filter over the profile*, and a filter can point at something that is no longer
 * there: a field the owner deleted, or a whole group that went with it. `resolveCard` never
 * throws over that (invariant I-2) — it drops the id and reports it in `droppedFieldIds`, so
 * the card still renders. What is left is telling the owner, which is this component's whole
 * job.
 *
 * **Never a ghost row.** The alternative anyone reaches for first is rendering the missing
 * field as an empty row so the count still adds up. That produces a card advertising a phone
 * number that does not exist, and a `.vcf` with a blank `TEL`. Saying it in words costs one
 * sentence and is the only honest option.
 *
 * The count is not repaired either — the builder does not silently rewrite `fieldIds` to
 * remove them. The picker has no checkbox for a field the profile no longer has, so an
 * automatic removal would be the builder editing the card behind the owner's back; the notice
 * is the disclosure that lets them decide.
 */

export interface DroppedFieldsNoticeProps {
  /** `ResolvedCard.droppedFieldIds`. The component renders nothing when it is empty. */
  droppedFieldIds: readonly string[];
}

export function DroppedFieldsNotice({
  droppedFieldIds,
}: DroppedFieldsNoticeProps): ReactElement | null {
  const count = droppedFieldIds.length;
  if (count === 0) return null;

  return (
    <p
      data-dropped-fields=""
      data-dropped-count={count}
      role="status"
      data-prose
      className="rounded-lg border border-line bg-surface-sunk px-5 py-3 text-sm text-ink-3"
    >
      {/* "1 field" / "5 fields" — the same pluralisation the meter uses, from one function.
          The verb has to agree with it, which `fieldCountLabel` cannot know about. */}
      {`${fieldCountLabel(count)} ${count === 1 ? "was" : "were"} removed from your profile.`}
    </p>
  );
}
