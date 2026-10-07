"use client";

import { BellRing, Check } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/primitives/button";
import {
  NotifyRecipients,
  behindRows,
  notifiableRows,
  type NotifyTarget,
} from "@/components/share/notify-recipients";

/**
 * **Send update** — the one place the owner is told "the people who hold this card haven't heard
 * about your changes", and the way to tell them.
 *
 * Client, 2026-10-03: *"whenever the user changes any of the fields, there will be a notification
 * … Notify each and every one of your contacts. I don't want a pop-up for every field change —
 * something like a jitter effect on the button."* So this is a **passive signal plus an action**:
 *
 * · **Nothing opens by itself.** Ten edits in a row are ten landed writes and one button that
 *   shakes each time one lands. The picker opens only when the owner presses it.
 * · **Nothing is sent by itself.** Editing a card already reaches every recipient through their
 *   link with zero messages; this is only the *telling*, and it is explicit.
 *
 * ## One button, five looks — it never goes away
 *
 * Client, 2026-10-03: *"the button should always persist in all the cards … it should not come
 * when the user is changing the field."* So there is exactly one `<Button>` in every state; a
 * control that popped in on the first edit would itself be the surprise.
 *
 * | state | when | what the owner sees |
 * | --- | --- | --- |
 * | `loading` | the first audience read has not landed | a neutral, disabled "Send update" |
 * | `empty` | nobody holds this card (a new card) | disabled "✓ All up to date", reason says to share first |
 * | `idle` | everyone has been told about the current version | disabled "✓ All up to date" |
 * | `behind` | somebody has not | the primary button, a **count of unshared changes**, and the jitter |
 * | `sending` | a send was just accepted | "Sending…" until the audience is re-read |
 * | `blocked` | the card has unsaved changes | a disabled "Send update" that says to save first |
 *
 * The badge counts *changes*, not people ({@link pendingChanges}); who they are is the picker's
 * job and its own description line.
 *
 * ## ⚠ `blocked` — it never tells anyone about an edit that is not saved
 *
 * Card edits wait for **Save changes** now (client, 2026-10-07), and an update tells recipients
 * that the card they hold changed. With unsaved edits on screen, "Send update" would invite the
 * owner to announce a change their recipients cannot see yet — so while the draft is dirty the
 * button is disabled, says why (`blockedReason`, visible as a tooltip and read as its
 * description), and the picker cannot open. It never saves on the owner's behalf.
 *
 * ## ⚠ `sending` is optimistic, and only for the ids that were sent
 *
 * `POST /cards/{id}/notify` answers `ENQUEUED` before any WhatsApp is attempted, so the truth
 * comes from the audience re-read `NotifyRecipients` makes a few seconds later (its
 * `onChanged`). Until then those recipients are held out of the "behind" count so the button does
 * not keep nagging about a send that is in flight — and the moment that read lands the hold is
 * dropped, so a send that failed re-arms the button instead of being hidden by it.
 *
 * ## The jitter
 *
 * `nudge` is a counter owned by `useCardAudience`; only a change *after* the button mounted
 * counts (see `bornAt`). Its parity picks one of two identical keyframes (`cb-nudge-a` / `cb-nudge-b`, `globals.css`), because restarting a CSS animation
 * needs a *different* animation name and the alternative — a `key` change — would remount the
 * button and throw away keyboard focus mid-edit. Reduced motion needs no code here: the duration
 * is `var(--dur-slow)`, which the central override zeroes.
 */

export interface SendUpdateButtonProps {
  cardId: string;
  targets: readonly NotifyTarget[];
  /** `false` until the first audience read for this card has landed. */
  ready: boolean;
  /** Goes up each time more versions become unannounced. Drives the jitter. */
  nudge: number;
  /** Re-read the audience, so the count reflects what actually landed. */
  onChanged: () => void;
  /** Passed to the picker. A seam so a test can reconcile immediately; production leaves it. */
  reconcileDelayMs?: number;
  /**
   * Set while the card has unsaved changes: the button is disabled with this as its reason, so
   * no update can go out about an edit that has not been saved.
   */
  blockedReason?: string | null;
}

/**
 * How many unshared changes the most-behind recipient is missing.
 *
 * Every perceivable edit bumps the card's version by one, and `versionsBehind` is the card's
 * version minus the one a recipient was last told about — so the largest gap is the number of
 * changes somebody still has not been told about. (Two edits to one field are two changes.)
 */
export function pendingChanges(behind: readonly NotifyTarget[]): number {
  return behind.reduce((most, target) => Math.max(most, target.versionsBehind ?? 0), 0);
}

export function SendUpdateButton({
  cardId,
  targets,
  ready,
  nudge,
  onChanged,
  reconcileDelayMs,
  blockedReason = null,
}: SendUpdateButtonProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(() => new Set());
  /* The counter as it stood when this button mounted. A button born into a non-zero `nudge` (the
     owner switched cards, or came back to one) must not shake on arrival — only a change that
     lands while it is on screen is news. */
  const [bornAt] = useState(nudge);

  const notifiable = notifiableRows(targets);
  const behind = behindRows(targets).filter((target) => !inFlight.has(target.shareLinkId));
  const changes = pendingChanges(behind);
  const people = behind.length;

  const state: SendUpdateState =
    blockedReason !== null
      ? "blocked"
      : !ready
    ? "loading"
    : behind.length > 0
      ? "behind"
      : inFlight.size > 0
        ? "sending"
        : notifiable.length === 0
          ? "empty"
          : "idle";

  const upToDateReason =
    state === "empty"
      ? "No one has this card yet. Share it first, and later changes can be sent to them here."
      : "Everyone who has this card has your latest changes.";

  return (
    <>
      {/* ONE button in every state, so the slot never appears, vanishes or changes size as the
          owner edits — only its look and label change. */}
      <Button
        data-send-update=""
        data-send-update-state={state}
        /* `a`/`b` by parity, absent until the first change lands. See the note above. */
        data-nudge={state === "behind" && nudge !== bornAt ? (nudge % 2 === 0 ? "a" : "b") : undefined}
        variant={state === "behind" ? "primary" : "secondary"}
        {...(state === "behind"
          ? {
              "aria-label": `Send update: ${changes} ${changes === 1 ? "change" : "changes"} not yet shared with ${people} ${people === 1 ? "person" : "people"}`,
              onClick: () => setOpen(true),
            }
          : state === "sending"
            ? { loading: true, loadingLabel: "Sending…" }
            : state === "blocked"
              ? { disabled: true, disabledReason: blockedReason ?? "", title: blockedReason ?? "" }
              : {
                  disabled: true,
                  disabledReason:
                    state === "loading" ? "Checking who has this card…" : upToDateReason,
                })}
        className="max-sm:w-full"
      >
        {state === "behind" ? (
          <BellRing aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
        ) : state === "idle" || state === "empty" ? (
          <Check aria-hidden="true" className="size-4 shrink-0 text-success" strokeWidth={2} />
        ) : (
          <BellRing aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
        )}
        {state === "idle" || state === "empty" ? "All up to date" : "Send update"}
        {state === "behind" ? (
          <span
            data-send-update-count=""
            aria-hidden="true"
            className="grid min-w-5 place-items-center rounded-full bg-canvas px-1.5 text-xs font-semibold leading-5 text-ink"
          >
            {changes}
          </span>
        ) : null}
      </Button>

      {/* Mounted only while open, so the picker's ticks start from "who is behind" every time
          rather than from whatever the first read looked like. */}
      {open && state !== "blocked" ? (
        <NotifyRecipients
          cardId={cardId}
          shares={targets}
          trigger={null}
          open
          preselect="behind"
          {...(reconcileDelayMs === undefined ? {} : { reconcileDelayMs })}
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
          onSent={(ids) => setInFlight(new Set(ids))}
          onChanged={() => {
            setInFlight(new Set());
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}

type SendUpdateState = "loading" | "empty" | "idle" | "sending" | "behind" | "blocked";
