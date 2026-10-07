"use client";

import { Check } from "lucide-react";
import { useRef, type ReactElement } from "react";

import { Dialog, DialogClose } from "@/components/overlay";
import { Button } from "@/components/primitives";
import { cn } from "@/lib/cn";

import type { CardSaveState } from "./use-card-drafts";

/**
 * **Save changes** — the one way a card's edits on the workspace reach the server.
 *
 * Client, 2026-10-07: *"Whenever the user is adding or removing a field on the card, that button
 * should pop up … Using the Save Changes button, all the fields are saved."* So the button exists
 * only while the selected card's draft differs from what is saved, and a quiet **Discard** sits
 * beside it.
 *
 * ## Where it shows
 *
 * · **In an action bar at the foot of the editor column** (`data-save-bar`, in `profile-client.tsx`)
 *   — a floating, rounded bar the width of the column, pinned just above the bottom of the
 *   viewport (above the app's bottom navigation on a phone). It holds "Unsaved changes" on the
 *   left and **Discard** + **Save changes** on the right, and exists only while there is something
 *   to save, something saving, or a failed save to retry. It was in the toolbar first (2026-10-07);
 *   there it wrapped under the tabs, away from the fields it saves, and scrolled out of reach.
 * · **The same bar says "All changes saved"** for a few seconds after a save, then goes. It is not in
 *   the toolbar: there it widened the row until Send update wrapped under the tabs the moment a save
 *   finished. The toolbar holds the tabs and Send update and nothing else, so it cannot move.
 *
 * The result of a save is announced once, by the workspace's own live region, not by either copy.
 */

export interface SaveChangesProps {
  /** The draft differs from the saved card. */
  dirty: boolean;
  state: CardSaveState;
  onSave: () => void;
  onDiscard: () => void;
}

/** One sentence for a failed save, as the owner reads it. */
export function saveErrorMessage(state: Extract<CardSaveState, { kind: "error" }>): string {
  const lead = state.partial ? "Some changes were saved, but the fields on this card were not. " : "";
  return `${lead}${state.title}. ${state.detail}`;
}

/** What the live region says about a save, or `""` when there is nothing new to say. */
export function saveAnnouncement(state: CardSaveState): string {
  if (state.kind === "saved") return "Changes saved.";
  if (state.kind === "error") return `Changes not saved. ${saveErrorMessage(state)}`;
  return "";
}

/** Whether there is anything to show: changes, a save under way, or a failed one to retry. */
export function saveControlsVisible({ dirty, state }: Pick<SaveChangesProps, "dirty" | "state">) {
  return dirty || state.kind === "saving";
}

export function SaveChangesControls({
  dirty,
  state,
  onSave,
  onDiscard,
}: SaveChangesProps): ReactElement | null {
  const saving = state.kind === "saving";

  if (!saveControlsVisible({ dirty, state })) {
    /* Clean. For a moment after a save the bar says so, quietly (the workspace hides it again). */
    if (state.kind !== "saved") return null;
    return (
      <p
        data-save-changes-state="saved"
        className="flex w-full items-center gap-1.5 text-sm text-ink-3"
      >
        <Check aria-hidden="true" className="size-4 shrink-0 text-success" strokeWidth={2} />
        All changes saved
      </p>
    );
  }

  const failed = state.kind === "error" ? state : null;

  return (
    <div
      data-save-changes=""
      data-save-changes-state={saving ? "saving" : failed !== null ? "error" : "dirty"}
      className="flex w-full min-w-0 items-center gap-2"
    >
      <p
        className={cn(
          "min-w-0 flex-1 text-sm",
          failed !== null ? "text-danger" : "text-ink-3",
        )}
      >
        {failed !== null ? (
          <span data-save-changes-error="" className="line-clamp-2">
            {saveErrorMessage(failed)}
            {failed.requestId === null ? null : (
              <span className="text-ink-3"> Reference: {failed.requestId}</span>
            )}
          </span>
        ) : saving ? null : (
          <span className="inline-flex items-center gap-2 font-medium text-ink">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-warning-ink" />
            Unsaved changes
          </span>
        )}
      </p>
      <Button
        variant="ghost"
        data-save-changes-discard=""
        onClick={onDiscard}
        disabled={saving}
        className="shrink-0"
      >
        Discard
      </Button>
      <Button
        data-save-changes-button=""
        onClick={onSave}
        loading={saving}
        loadingLabel="Saving…"
        className="shrink-0"
      >
        Save changes
      </Button>
    </div>
  );
}

/**
 * The prompt for leaving a card with unsaved changes for another one in the switcher. Three
 * answers, because each is a real intent: keep editing this card, throw the edits away, or keep
 * them and go.
 */
export function UnsavedCardDialog({
  open,
  cardName,
  saving,
  onStay,
  onDiscard,
  onSave,
}: {
  open: boolean;
  cardName: string;
  saving: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
}): ReactElement {
  const stayRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
      overline="Unsaved changes"
      title={`Save changes to ${cardName}?`}
      size="sm"
      hideClose
      onOpenAutoFocus={(event) => {
        /* The safe answer first, as every confirmation here does. */
        event.preventDefault();
        stayRef.current?.focus();
      }}
      footer={
        <>
          <DialogClose asChild>
            <Button ref={stayRef} variant="secondary" data-unsaved-stay="">
              Stay
            </Button>
          </DialogClose>
          <Button variant="destructive" data-unsaved-discard="" onClick={onDiscard} disabled={saving}>
            Discard changes
          </Button>
          <Button data-unsaved-save="" onClick={onSave} loading={saving} loadingLabel="Saving…">
            Save and switch
          </Button>
        </>
      }
    >
      <p className="text-base text-ink">
        You changed {cardName} and haven&apos;t saved it. Save the changes before opening another
        card, or discard them.
      </p>
    </Dialog>
  );
}
