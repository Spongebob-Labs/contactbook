"use client";

/**
 * "This card changed — tell the people who have it."
 *
 * ## The mental model this UI has to carry
 *
 * Editing a card's fields already propagates live to every recipient with **zero messages
 * sent** — a recipient who opens their link sees the new details whether or not anybody was
 * notified. What this feature adds is the *telling*, and it is **owner-triggered and explicit**:
 * an owner can make ten edits in a row and nothing goes out until they deliberately press send.
 *
 * So this is deliberately a **passive signal plus an action**, never a toast on save and never
 * an automatic send. `PUT /cards/{id}/fields` must never imply a notify happened.
 *
 * ## ⚠ `ENQUEUED` is not "delivered", and there is no callback that says otherwise
 *
 * `POST /cards/{id}/notify` answers `201` with `status: 'ENQUEUED'` **synchronously**, before the
 * WhatsApp send has been attempted — the send happens later through the outbox/Cloud Tasks
 * pipeline. Every call returns that same value whether the send later succeeds or fails outright
 * (the usual failure being no Twilio-approved `CARD_UPDATE` template in that environment).
 *
 * There is no webhook and no push. The only way to learn the outcome is to re-fetch
 * `GET /cards/{id}/audience` and see whether `versionsBehind` actually reached `0`. Hence the
 * shape below: send, say "sending", then **reconcile against a fresh audience read** and report
 * from that — never from the notify response.
 */

import { useState, useTransition } from "react";

import { cards as cardsApi } from "@/lib/api/browser";
import { toScreenError } from "@/lib/api/errors";
import { Badge, Button, Checkbox } from "@/components/primitives";
import { Dialog } from "@/components/overlay";
import { useToast } from "@/components/overlay";
import type { CardShareRow } from "@/types/domain";

/**
 * Exactly what the picker needs to name and address one recipient — no more.
 *
 * ⚠ It used to take `CardShareRow[]`, which is `ContactShare` plus notify data, so it demanded
 * `url`, `cardName`, `createdAt` and `firstViewedAt` that this component never reads. That was
 * fine while the only caller was the card-detail screen (which assembles those from three
 * endpoints anyway) and became a problem the moment the **builder** needed to open this dialog
 * after a save: the builder has `GET /cards/:id/audience` and nothing else, and the honest
 * choices were to fire two more requests or to fabricate the four missing fields.
 *
 * Narrowing the prop is the third option and the right one. `CardShareRow` is structurally
 * assignable to this, so the card-detail call site is unchanged, and `audience` alone is now
 * enough to build a target — see `toNotifyTargets`.
 */
export interface NotifyTarget {
  shareLinkId: string;
  contactId: string;
  contactLabel: string;
  status: "ACTIVE" | "REVOKED";
  /** `currentVersion - (lastNotifiedVersion ?? 0)`. `0` = caught up, `null` = not notifiable. */
  versionsBehind: number | null;
  lastNotifiedVersion: number | null;
}

/** `CardShareRow` must stay usable as a target — the card-detail screen passes it straight in. */
const _assignable: NotifyTarget = null as unknown as CardShareRow;
void _assignable;

/**
 * Build targets from an `audience` response alone.
 *
 * ⚠ `audience` lists ACTIVE links only, which is why `status` is hard-coded rather than read —
 * a revoked link simply is not in the response. The label falls back the same way
 * `contactLabel` does everywhere else: a name if there is one, else the number, never a blank
 * cell where a name should be.
 */
export function toNotifyTargets(
  recipients: readonly {
    shareLinkId: string;
    contactId: string;
    contactDisplayName: string | null;
    contactPhoneE164: string;
    versionsBehind: number;
    lastNotifiedVersion: number | null;
  }[],
): readonly NotifyTarget[] {
  return recipients.map((r) => ({
    shareLinkId: r.shareLinkId,
    contactId: r.contactId,
    contactLabel: r.contactDisplayName?.trim() || r.contactPhoneE164,
    status: "ACTIVE" as const,
    versionsBehind: r.versionsBehind,
    lastNotifiedVersion: r.lastNotifiedVersion,
  }));
}

/** How long to wait before reading the audience back. The send is a queue hop, not a round trip. */
export const RECONCILE_DELAY_MS = 4000;

/**
 * The rows a notify can address: ACTIVE links only.
 *
 * `versionsBehind === null` means the link has no `audience` entry — it is revoked, so it cannot
 * be notified at all. Filtering on the field rather than on `status` keeps this honest even if a
 * row's status and its audience membership ever disagree.
 */
export function notifiableRows(shares: readonly NotifyTarget[]): readonly NotifyTarget[] {
  return shares.filter((s) => s.versionsBehind !== null && s.status === "ACTIVE");
}

/** Rows that have not been told about the current version. Drives the banner's existence. */
export function behindRows(shares: readonly NotifyTarget[]): readonly NotifyTarget[] {
  return notifiableRows(shares).filter((s) => (s.versionsBehind ?? 0) > 0);
}

export interface NotifyRecipientsProps {
  cardId: string;
  shares: readonly NotifyTarget[];
  /** Re-read the card detail, so `versionsBehind` reflects what actually landed. */
  onChanged: () => void;
  /**
   * The control that opens the dialog.
   *
   * `undefined` gives the default "Notify recipients" button. **`null` gives no trigger at
   * all**, for a caller that opens this programmatically — the builder does exactly that after
   * a save, where the prompt is the consequence of pressing Save and a second button would be
   * a control nobody pressed.
   */
  trigger?: React.ReactNode | null;
  /**
   * Controlled open state. Omit for the self-managed button; supply both to drive it from
   * outside.
   *
   * ⚠ Both or neither. `open` without `onOpenChange` produces a dialog the owner cannot
   * dismiss — Cancel, Escape and the backdrop all route through here.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * The owner's whole contact registry, so the dialog can account for anyone it is NOT showing.
   *
   * ⚠ Notify is scoped to people who already hold a link to **this** card, and that is a real
   * constraint rather than a limitation to route around: the message says "X updated their card,
   * tap to see the latest" and carries that link. Somebody who was never given the card has
   * nothing to open, so the action for them is Share, which mints a link and sends the first
   * message. Without this the dialog just looks broken to an owner with ten contacts and one
   * recipient — which is exactly how it read.
   */
  contacts?: readonly { id: string }[];
  /**
   * Overridable so a test can reconcile immediately.
   *
   * A seam rather than `vi.useFakeTimers`: faking the clock globally to reach this one `setTimeout`
   * leaked into the next test in the file and made an unrelated assertion time out. A prop with a
   * production default keeps the timing real where it matters and deterministic where it does not.
   */
  reconcileDelayMs?: number;
}

/**
 * The picker.
 *
 * **Every active recipient is selected by default, not only the ones behind.** That mirrors the
 * original share flow: an owner may always deliberately re-notify somebody already caught up, and
 * re-notifying about a version already sent is a safe server-side no-op (the same
 * `outboxMessageId` comes back), not a duplicate message. So the owner deselects; we do not
 * pre-filter for them.
 */
export function NotifyRecipients({
  cardId,
  shares,
  onChanged,
  trigger,
  contacts = [],
  reconcileDelayMs = RECONCILE_DELAY_MS,
  open: openProp,
  onOpenChange,
}: NotifyRecipientsProps) {
  const { toast } = useToast();
  const notifiable = notifiableRows(shares);
  const [openSelf, setOpenSelf] = useState(false);

  /* Controlled when the caller supplies `open`, self-managed otherwise. One `setOpen` for the
     rest of the component so nothing below has to know which mode it is in. */
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openSelf;
  const setOpen = (next: boolean) => {
    if (!controlled) setOpenSelf(next);
    onOpenChange?.(next);
  };
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(notifiable.map((s) => s.shareLinkId)),
  );
  const [sending, startSend] = useTransition();

  /* An owner with nobody to notify gets no control at all — not a disabled one. An empty-state
     control here is worse than none, the same rule the QR and save-to-contacts work follows. */
  if (notifiable.length === 0) return null;

  function openChanged(next: boolean) {
    setOpen(next);
    // Reopening starts from "everyone" again rather than from a stale deselection.
    if (next) setSelected(new Set(notifiable.map((s) => s.shareLinkId)));
  }

  function toggle(shareLinkId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(shareLinkId)) next.delete(shareLinkId);
      else next.add(shareLinkId);
      return next;
    });
  }

  function send() {
    /* ⚠ Filtered against the rows currently on screen, not sent raw. One id that is not an
       ACTIVE link on this card fails the WHOLE call with 404 — there is no partial success — so
       validating here keeps that unreachable in normal use. */
    const ids = notifiable.map((s) => s.shareLinkId).filter((linkId) => selected.has(linkId));
    if (ids.length === 0) return;

    startSend(async () => {
      try {
        await cardsApi.notify(cardId, { shareLinkIds: ids });
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
        return;
      }

      setOpen(false);
      /* Deliberately not "Sent". The queue accepted it; nobody has received anything yet. */
      toast({
        title: ids.length === 1 ? "Sending one update" : `Sending ${ids.length} updates`,
        description: "WhatsApp delivery happens in the background. This list updates once it lands.",
      });

      /* The reconcile. `notify`'s own response cannot tell us whether the send worked, so the
         truth comes from a fresh audience read a few seconds later — that is what moves the
         banner, and what leaves a recipient marked behind if their send failed. */
      await new Promise((resolve) => setTimeout(resolve, reconcileDelayMs));
      onChanged();
    });
  }

  const behind = behindRows(shares);

  /* Registry contacts with no ACTIVE link on this card. Counted off the same rows the picker
     renders, so the two can never disagree about who is already a recipient. */
  const onCard = new Set(notifiable.map((s) => s.contactId));
  const withoutCard = contacts.filter((c) => !onCard.has(c.id)).length;

  return (
    <Dialog
      open={open}
      onOpenChange={openChanged}
      /* `null` means "no trigger" — see the prop's note. `undefined` still gets the default. */
      trigger={trigger === null ? undefined : (trigger ?? <Button variant="secondary">Notify recipients</Button>)}
      overline="Notify"
      title="Tell recipients this card changed"
      description={
        behind.length === 0
          ? "Everyone has been told about the current version. You can still send again."
          : `${behind.length} of ${notifiable.length} ${
              behind.length === 1 ? "person has" : "people have"
            } not been told about your latest changes.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            data-notify-send=""
            onClick={send}
            disabled={sending || selected.size === 0}
            aria-disabled={sending || selected.size === 0}
          >
            {sending
              ? "Sending…"
              : selected.size === 1
                ? "Send 1 update"
                : `Send ${selected.size} updates`}
          </Button>
        </>
      }
    >
      {withoutCard > 0 ? (
        <p data-notify-not-recipients="" className="mb-4 text-sm text-ink-3">
          {`${withoutCard} other ${withoutCard === 1 ? "contact" : "contacts"} `}
          {withoutCard === 1 ? "doesn't have" : "don't have"} this card yet, so there is nothing to
          tell them about. Close this and use <span className="text-ink">Share</span> to send it to
          them — they get the card and a link in one message.
        </p>
      ) : null}

      <ul data-notify-picker="" className="flex flex-col">
        {notifiable.map((share) => {
          const isBehind = (share.versionsBehind ?? 0) > 0;
          return (
            <li
              key={share.shareLinkId}
              data-notify-row={share.shareLinkId}
              data-notify-behind={isBehind ? "true" : undefined}
              className="border-b border-line py-3 last:border-b-0"
            >
              <Checkbox
                checked={selected.has(share.shareLinkId)}
                onCheckedChange={() => toggle(share.shareLinkId)}
                label={
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="min-w-0 truncate">{share.contactLabel}</span>
                    {isBehind ? (
                      <Badge tone="warning" data-notify-row-behind={share.shareLinkId}>
                        Behind
                      </Badge>
                    ) : null}
                  </span>
                }
                description={
                  isBehind
                    ? share.lastNotifiedVersion === null
                      ? "Has never been told about a change to this card."
                      : `Last told about version ${share.lastNotifiedVersion}.`
                    : "Already told about the current version."
                }
              />
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

export interface NotifyBannerProps {
  cardId: string;
  shares: readonly NotifyTarget[];
  onChanged: () => void;
  /** Passed straight through to the picker — see `NotifyRecipientsProps.contacts`. */
  contacts?: readonly { id: string }[];
}

/**
 * The passive signal, above the "Sent to" list.
 *
 * Rendered **only** when somebody is actually behind — not greyed out, not with a zero count.
 * A card whose recipients are all caught up says nothing at all, which is the point: this is a
 * thing to notice when it appears, not a permanent fixture that trains the eye to skip it.
 */
export function NotifyBanner({ cardId, shares, onChanged, contacts = [] }: NotifyBannerProps) {
  const behind = behindRows(shares);
  if (behind.length === 0) return null;

  return (
    <div
      data-notify-banner=""
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-md border border-line bg-surface-sunk px-4 py-3"
    >
      <p className="min-w-0 text-sm text-ink">
        <span className="font-medium">
          {behind.length === 1
            ? "1 recipient hasn't been told"
            : `${behind.length} recipients haven't been told`}
        </span>
        {" — they still see your latest details, they just don't know they changed."}
      </p>
      <NotifyRecipients
        cardId={cardId}
        shares={shares}
        contacts={contacts}
        onChanged={onChanged}
        trigger={
          <Button variant="secondary" data-notify-banner-action="">
            Notify
          </Button>
        }
      />
    </div>
  );
}
