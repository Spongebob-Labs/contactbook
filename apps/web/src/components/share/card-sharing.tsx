"use client";

import { useState, useTransition } from "react";

import { EmptyState } from "@/components/data";
import { ConfirmDialog, useToast } from "@/components/overlay";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Select } from "@/components/primitives/select";
import { cards as cardsApi, contacts as contactsApi, shareLinks as linksApi } from "@/lib/api/browser";
import { isApiError, toScreenError } from "@/lib/api/errors";
import type { ShareLinkResponseDto } from "@/lib/api/schema";
import { normaliseE164 } from "@/lib/contacts-parse";
import { formatLongDate, formatPhoneDisplay } from "@/lib/format";
import {
  contactLabel,
  type CardShareRow,
  type Contact,
} from "@/types/domain";

/**
 * Minting a card's link, and seeing who holds one.
 *
 * ## Why sharing is aimed at a person rather than published
 * The share panel used to be a QR code, a public link and a `.vcf` download — an *anonymous*
 * model: publish one link, let anyone scan it.
 *
 * The API has no anonymous link, and this is not an oversight to be worked around. `ShareCardDto`
 * **requires** a `contactId`; `/cards/{id}/link`, `/cards/{id}/public-link` and
 * `/cards/{id}/share-link` were each probed against staging and every one answers `Cannot GET`,
 * while `/public/links/{token}` answers with a domain error — the way a route that exists
 * reports a record that does not. There is exactly one minting path, and it takes a recipient.
 *
 * That constraint buys something: a link per person is a link that can be revoked for **one**
 * person, and `viewCount` on it means "did Priya open it", not "was this card looked at". Both
 * are surfaced below. An anonymous link would have neither.
 *
 * The QR and the `.vcf` still live in `share-sheet.tsx` and work with no API at all. What changed
 * is that they are no longer the only way to share, and no longer the primary one.
 *
 * ## Two calls, because a recipient may not exist yet
 * `POST /contacts` upserts on `(you, phoneE164)`, so a typed number becomes a contact id without
 * a duplicate check and without a separate trip to the registry. That is what lets an account
 * with no contacts at all press one button and end up with a live link.
 *
 * ## The failure that is not a failure
 * `POST /cards/{id}/share` fails with `CARD_SHARE_TEMPLATE_NOT_CONFIGURED` when no approved
 * WhatsApp template is registered — **but it mints the link first, and the link is live**. So
 * that code is caught, the link is read back from `GET /share-links`, and the panel hands it over
 * with a note that the message did not go out. Reporting it as an error would hide something that
 * works behind something that looks broken.
 */

/* ── Sending ─────────────────────────────────────────────────────────────────────────── */

/**
 * What a successful mint produced.
 *
 * Every field comes off `ShareLinkResponseDto` — the API echoes the recipient back on the link it
 * returns, so nothing here is re-read from local state and the panel above cannot end up naming a
 * different person than the one the link was minted for.
 */
export interface MintedLink {
  shareLinkId: string;
  /** Live, resolvable, and the same string the QR will encode once this is handed upward. */
  url: string;
  contactId: string;
  /** The recipient's name if they have one, else their number — `contactLabel`'s rule. */
  recipientLabel: string;
  recipientPhoneE164: string;
  /**
   * True when the WhatsApp send could not be enqueued for want of an approved `CARD_SHARE`
   * template. **The link is still live.** The panel says so and offers to send it by hand.
   */
  templateMissing: boolean;
}

function mintedFrom(link: ShareLinkResponseDto, templateMissing: boolean): MintedLink {
  return {
    shareLinkId: link.id,
    url: link.url,
    contactId: link.contactId,
    recipientLabel: contactLabel({
      displayName: link.contactDisplayName,
      phoneE164: link.contactPhoneE164,
    }),
    recipientPhoneE164: link.contactPhoneE164,
    templateMissing,
  };
}

export interface SendToContactProps {
  cardId: string;
  /** The owner's registry. Empty is a real state — a new account has no contacts. */
  contacts: readonly Contact[];
  /** Contact ids that already hold this card, so the picker can say so. */
  alreadySentTo: ReadonlySet<string>;
  /** Handed the minted link, so the panel above can publish it without waiting for a re-read. */
  onShared: (minted: MintedLink) => void;
}

/** Which of the two ways of naming a recipient the form is currently in. */
type Target = "pick" | "new";

/**
 * Turn a card into a link by naming who it is for.
 *
 * ## Why a number field and not only a picker
 * The picker used to be the whole control, and on a new account it rendered a dead end: *"You
 * have no contacts yet"* — an empty state in front of the one action the panel exists to perform,
 * on precisely the accounts most likely to be trying it for the first time. Since `POST /contacts`
 * **upserts**, a typed number needs no prior registry entry and no separate "add contact" trip:
 * one submit does `POST /contacts` then `POST /cards/{id}/share`, and a link exists.
 *
 * So the number field is the default whenever the registry is empty, and stays available as
 * "someone new" when it is not. A number already on file upserts into the same row rather than a
 * duplicate, which is why there is no "already added" check in front of it.
 */
export function SendToContact({ cardId, contacts, alreadySentTo, onShared }: SendToContactProps) {
  const { toast } = useToast();
  const [target, setTarget] = useState<Target>(contacts.length === 0 ? "new" : "pick");
  const [contactId, setContactId] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = contacts.find((contact) => contact.id === contactId) ?? null;
  const optedOut = selected !== null && selected.optedOutAt !== null;
  const ready = target === "pick" ? contactId.length > 0 : phone.trim().length > 0;

  function submit() {
    setPhoneError(null);

    // Validated before the transition opens: a malformed number is a local fact, and spending a
    // round trip to have the API reject it would report it as a server failure instead.
    let phoneE164: string | null = null;
    if (target === "new") {
      phoneE164 = normaliseE164(phone);
      if (phoneE164 === null) {
        setPhoneError("Include the country code, like +919820000000.");
        return;
      }
    }

    startTransition(async () => {
      try {
        /* Two calls, in order, and the first is skipped when an existing contact was picked.
           `POST /contacts` upserts on (you, phoneE164) — so a number already in the registry
           refreshes rather than erroring, and the id it returns is the same one the picker
           would have offered. */
        const recipientId =
          phoneE164 === null
            ? contactId
            : (
                await contactsApi.upsert({
                  phoneE164,
                  displayName: name.trim().length > 0 ? name.trim() : undefined,
                })
              ).id;

        const link = await cardsApi.share(cardId, { contactId: recipientId });
        const minted = mintedFrom(link, false);

        toast({ title: `Link created for ${minted.recipientLabel}` });
        reset();
        onShared(minted);
      } catch (thrown) {
        /* ⚠ The one error that is not a failure. Without an approved `CARD_SHARE` template the
           WhatsApp send cannot be enqueued — but the API still mints a live link, so reporting
           this as a failure would hide something that works behind an apology.

           The link it minted is not in this response, so it is fetched back: `GET /share-links`
           is the only read of a minted link the API offers, and the pair is idempotent, so the
           row is certain to be there. If even that read fails the send is reported honestly
           rather than claiming a link nobody can show. */
        if (isApiError(thrown) && thrown.code === "CARD_SHARE_TEMPLATE_NOT_CONFIGURED") {
          const recovered = await findMintedLink(cardId, phoneE164, contactId);
          if (recovered !== null) {
            toast({
              title: "Link created, message not sent",
              description:
                "WhatsApp sending is not switched on yet. Copy the link below and send it yourself.",
            });
            reset();
            onShared(mintedFrom(recovered, true));
            return;
          }
        }
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
      }
    });
  }

  function reset() {
    setContactId("");
    setPhone("");
    setName("");
    setPhoneError(null);
  }

  return (
    <div data-send-to-contact="" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-overline uppercase text-ink-3">Create a link</p>
        {/* Only offered when there is a registry to switch back to. On an empty one this would be
            a toggle between a list of nothing and the field already on screen. */}
        {contacts.length === 0 ? null : (
          <Button
            variant="text-link"
            data-send-target={target === "pick" ? "new" : "pick"}
            onClick={() => {
              setTarget(target === "pick" ? "new" : "pick");
              reset();
            }}
          >
            {target === "pick" ? "Someone new" : "Pick from contacts"}
          </Button>
        )}
      </div>

      <p className="text-sm text-ink-3">
        {`A link is minted for one person, so ${
          target === "pick" ? "choose who this card is for" : "enter the number this card is for"
        }. They get their own link you can revoke without touching anyone else's.`}
      </p>

      {target === "pick" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Select
            label="Contact"
            value={contactId}
            onValueChange={setContactId}
            items={contacts.map((contact) => ({
              value: contact.id,
              // The number is in the label because two people can share a name and a registry is
              // addressed by number — picking the wrong row sends a card to a stranger.
              label: `${contactLabel(contact)} · ${formatPhoneDisplay(contact.phoneE164)}${
                alreadySentTo.has(contact.id) ? " · already sent" : ""
              }`,
            }))}
            fieldClassName="min-w-0 flex-1"
          />
          <SendButton pending={pending} ready={ready} onClick={submit} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Input
              label="Their number"
              data-send-phone=""
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+919820000000"
              value={phone}
              error={phoneError}
              // The hint is the country code, because that is the single thing a paste is most
              // likely to be missing and the API rejects without it.
              hint={phoneError === null ? "With the country code." : undefined}
              onChange={(event) => {
                setPhone(event.target.value);
                setPhoneError(null);
              }}
              fieldClassName="min-w-0 flex-1"
            />
            <Input
              label="Name"
              data-send-name=""
              placeholder="Optional"
              value={name}
              hint="For your registry only."
              onChange={(event) => setName(event.target.value)}
              fieldClassName="min-w-0 flex-1"
            />
          </div>
          <div className="flex">
            <SendButton pending={pending} ready={ready} onClick={submit} />
          </div>
        </div>
      )}

      {/* Shown for the *selected* contact only: a standing warning above an empty picker is
          noise, and this is the moment it matters. */}
      {optedOut ? (
        <p data-send-opted-out="" className="text-sm text-warning-ink">
          This contact asked to stop receiving messages, so nothing will be delivered. The link
          will still be created if you send it.
        </p>
      ) : null}

      {selected !== null && alreadySentTo.has(selected.id) ? (
        <p data-send-already="" className="text-sm text-ink-3">
          They already have this card. Sending again reuses the same link rather than making a
          second one.
        </p>
      ) : null}
    </div>
  );
}

function SendButton({
  pending,
  ready,
  onClick,
}: {
  pending: boolean;
  ready: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      data-send-card=""
      disabled={!ready}
      disabledReason="Name who this card is for."
      loading={pending}
      loadingLabel="Creating…"
      onClick={onClick}
    >
      Create link
    </Button>
  );
}

/**
 * Recover the link a `CARD_SHARE_TEMPLATE_NOT_CONFIGURED` response minted but did not return.
 *
 * The API is idempotent per `(card, contact)` pair and mints **before** it tries to enqueue the
 * message, so the row exists even though the request 4xx'd. `GET /share-links` is unpaginated and
 * covers every card, so the pair is found by matching on both ids — never on `cardId` alone, which
 * would hand back some other recipient's link.
 *
 * Returns `null` rather than throwing: the caller's fallback is to report the original error,
 * which is the honest outcome when the link cannot be shown.
 */
async function findMintedLink(
  cardId: string,
  phoneE164: string | null,
  contactId: string,
): Promise<ShareLinkResponseDto | null> {
  try {
    const links = await linksApi.list();
    const forCard = links.filter((link) => link.cardId === cardId);
    return (
      forCard.find((link) =>
        phoneE164 === null
          ? link.contactId === contactId
          : link.contactPhoneE164 === phoneE164,
      ) ?? null
    );
  } catch {
    return null;
  }
}

/* ── Who has it ──────────────────────────────────────────────────────────────────────── */

export interface CardSharesProps {
  cardId: string;
  /** Re-read after a revoke or restore. */
  onChanged: () => void;
  /**
   * Every link minted for this card, newest first, with the contact each was sent to.
   *
   * `CardShareRow` rather than a narrower shape so this list can also show who has not been told
   * about the current version — the same rows the notify picker reads, so the badge here and the
   * selection there can never disagree about who is behind.
   */
  shares: readonly CardShareRow[];
}

/**
 * Everyone this card has been sent to, and whether they opened it.
 *
 * Revoke and restore are both here, and the copy is careful about the asymmetry: revoking 410s
 * the public link immediately, and restoring reuses **the same token** — so a WhatsApp message
 * sent weeks ago starts working again. That is a genuine surprise, and the reason the confirm
 * says the act is reversible rather than implying it is final.
 */
export function CardShares({ cardId, shares, onChanged }: CardSharesProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function setStatus(shareLinkId: string, status: "ACTIVE" | "REVOKED", who: string) {
    startTransition(async () => {
      try {
        await linksApi.update(shareLinkId, { status });
        toast({
          title: status === "REVOKED" ? `Revoked ${who}'s link` : `Restored ${who}'s link`,
          tone: status === "REVOKED" ? "danger" : undefined,
        });
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
      }
      onChanged();
    });
  }

  if (shares.length === 0) {
    return (
      <EmptyState
        headingLevel={3}
        overline="Nothing sent yet"
        title="You haven't sent this card to anyone"
        description="Use Share to send it to a contact. They get a WhatsApp message with a link that always shows your current details."
      />
    );
  }

  return (
    <ul data-card-shares="" className="flex flex-col">
      {shares.map((share) => (
        <li
          key={share.shareLinkId}
          data-card-share={share.shareLinkId}
          data-share-status={share.status}
          className="flex flex-col gap-2 border-b border-line py-4 last:border-b-0"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="flex min-w-0 items-baseline gap-2 text-base text-ink">
              <span className="min-w-0 truncate">{share.contactLabel}</span>
              {share.status === "REVOKED" ? (
                <Badge tone="neutral" data-share-revoked={share.shareLinkId}>
                  Revoked
                </Badge>
              ) : null}
              {/* ⚠ `versionsBehind` is `null` for a revoked link — no audience entry, so it
                  cannot be notified. Guarded with `> 0` on a nullable number rather than a
                  truthiness check, so `null` never reads as "behind". */}
              {(share.versionsBehind ?? 0) > 0 ? (
                <Badge tone="warning" data-share-behind={share.shareLinkId}>
                  Not told yet
                </Badge>
              ) : null}
            </p>
            <span className="text-xs text-ink-3 tabular-nums">
              {share.viewCount === 0
                ? "Not opened yet"
                : `Opened ${share.viewCount} ${share.viewCount === 1 ? "time" : "times"}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
            <span>
              {"Sent "}
              <time dateTime={share.createdAt}>{formatLongDate(share.createdAt)}</time>
            </span>

            {share.status === "ACTIVE" ? (
              <ConfirmDialog
                tone="destructive"
                overline="Revoke"
                title={`Revoke ${share.contactLabel}'s link?`}
                detail="Their link stops opening immediately. Anything they already saved to their phone stays with them."
                // The reversibility is the whole point: restoring reuses the same token, so the
                // message they already have starts working again.
                consequence="You can restore this later, and the link they already have will work again."
                confirmLabel="Revoke link"
                cancelLabel="Keep it working"
                busy={pending}
                onConfirm={() => setStatus(share.shareLinkId, "REVOKED", share.contactLabel)}
                trigger={
                  <Button variant="text-link" data-share-revoke={share.shareLinkId}>
                    Revoke
                  </Button>
                }
              />
            ) : (
              <Button
                variant="text-link"
                data-share-restore={share.shareLinkId}
                loading={pending}
                loadingLabel="Restoring…"
                onClick={() => setStatus(share.shareLinkId, "ACTIVE", share.contactLabel)}
              >
                Restore
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
