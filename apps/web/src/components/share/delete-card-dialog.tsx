"use client";

import type { ReactNode } from "react";

import { ConfirmDialog } from "@/components/overlay";
import type { ResolvedCard } from "@/types/domain";

/**
 * "Delete card" on `/cards/[cardId]` — spec §5.5, §8D.1, §11 E-50, plan T22.
 *
 * ## Confirmed before the fact, never after it
 * §8D.1 splits the two confirmations and the split is easy to get backwards: a *reversible*
 * action is confirmed afterwards by a toast carrying an Undo; a *destructive* one is
 * confirmed beforehand, here, because afterwards there is nothing left to undo. A "Card
 * deleted" toast with no Undo is the worst of both, so this screen shows an inline
 * confirmation instead once the deletion goes through.
 *
 * ## The `consequence` slot, used for a card's blast radius
 * T08 added that slot for E-41 ("3 cards use this field"). A card has a blast radius too,
 * and it is the part a person cannot see from this screen: the published link and the QR
 * code printed on whatever the card was put on stop resolving. Stating it in words — with
 * the actual URL, taken from the same `ResolvedCard` the page previewed — is the difference
 * between a confirmation and a speed bump.
 *
 * The profile is deliberately named as *surviving*. A card is a filter over profile fields
 * (§5.3), so deleting one removes a view and never the data; a user who thinks otherwise
 * will not press the button, and a user who thinks the opposite will press it too easily.
 */

export interface DeleteCardDialogProps {
  /** The one `ResolvedCard` the preview, the `.vcf` and the PNG all share (I-5). */
  resolved: ResolvedCard;
  /** Rendered inside the dialog's trigger. The screen owns the button's own attributes. */
  trigger: ReactNode;
  /** Runs after the user confirms. The dialog closes itself; this owns what happens next. */
  onConfirm: () => void;
  /** In-flight archive. The confirm button announces busy and swallows a second click (E-43). */
  busy?: boolean;
  /**
   * How many people have been sent this card.
   *
   * Named in the consequence line, because archiving **revokes every active share link** — so the
   * number of people whose link stops working is the fact the owner is actually deciding about.
   */
  shareCount?: number;
}

export function DeleteCardDialog({
  resolved,
  trigger,
  onConfirm,
  busy = false,
  shareCount = 0,
}: DeleteCardDialogProps) {
  /**
   * ⚠ The consequence changed with the API, and it got sharper.
   *
   * It used to say the QR and the published link stop resolving. What `DELETE /cards/{id}`
   * actually does is archive the card **and revoke every active share link on it** — so the
   * people who matter are the ones already holding a link, and the honest number is how many.
   */
  const consequence =
    shareCount === 0
      ? "Nobody has been sent this card, so no links stop working. Anyone who already saved your details keeps them."
      : `${shareCount} ${shareCount === 1 ? "person" : "people"} were sent this card, and their ${shareCount === 1 ? "link" : "links"} stop opening. Anyone who already saved your details keeps them.`;

  return (
    <ConfirmDialog
      trigger={trigger}
      tone="destructive"
      // Not "Delete card": that is the confirm button's label, and an overline carrying the
      // same string makes every accessible-name query in every suite ambiguous.
      overline="Delete"
      title={`Delete "${resolved.cardName}"?`}
      detail="This archives the card. The profile fields it maps stay exactly where they are — a card is a view of your profile, not a copy of it."
      consequence={consequence}
      confirmLabel="Delete card"
      busy={busy}
      // Not "Cancel": the safe choice reads better as the thing it actually does, and it is
      // the control `ConfirmDialog` lands focus on.
      cancelLabel="Keep card"
      onConfirm={onConfirm}
    />
  );
}
