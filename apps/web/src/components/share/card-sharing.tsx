"use client";

import { useTransition } from "react";

import { EmptyState } from "@/components/data";
import { ConfirmDialog, useToast } from "@/components/overlay";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { cards as cardsApi, contacts as contactsApi, shareLinks as linksApi } from "@/lib/api/browser";
import { isApiError, toScreenError } from "@/lib/api/errors";
import type { ShareLinkResponseDto } from "@/lib/api/schema";
import { formatLongDate, formatPhoneDisplay } from "@/lib/format";
import { type CardShareRow } from "@/types/domain";

/**
 * Sending a card to a person, and seeing who holds one.
 *
 * ## Why sharing is aimed at a person rather than published
 * `ShareCardDto` **requires** a `contactId`. A link per person is a link that can be revoked for
 * **one** person, and `viewCount` on it means "did Priya open it", not "was this card looked at".
 * The card's own one-to-many link (`card.publicUrl`, the QR's payload) is separate and is what
 * the "Card link" block copies; it is never repointed by a send.
 *
 * ## Two calls, because a recipient may not exist yet
 * `POST /contacts` upserts on `(you, phoneE164)`, so a typed number becomes a contact id without
 * a duplicate check. That upsert is also what "adds them to your contacts" in the quick-share
 * flow: there is no second call for it. Then `POST /cards/{id}/share {contactId}` mints (or
 * reuses — unique per `(card, contact)`) the link and writes the WhatsApp send to the outbox.
 * The browser never talks to Twilio; the outbox does, after this response.
 *
 * ## The failure that is not a failure
 * `POST /cards/{id}/share` fails with `CARD_SHARE_TEMPLATE_NOT_CONFIGURED` when no approved
 * WhatsApp template is registered — **but it mints the link first, and the link is live**. So
 * that code is caught, the link is read back from `GET /share-links`, and the caller is handed
 * it with `templateMissing: true`, so it can say plainly that nothing went out and offer the
 * owner a `wa.me` link to send it themselves.
 */

/* ── Sending ─────────────────────────────────────────────────────────────────────────── */

/**
 * What a successful mint produced.
 *
 * Every field comes off `ShareLinkResponseDto` — the API echoes the recipient back on the link it
 * returns, so nothing here is re-read from local state and the screen cannot end up naming a
 * different person than the one the link was minted for.
 */
export interface MintedLink {
  shareLinkId: string;
  /** Live and resolvable: this recipient's own link. */
  url: string;
  contactId: string;
  /** The recipient's name if they have one, else their formatted number — `recipientName`. */
  recipientLabel: string;
  recipientPhoneE164: string;
  /**
   * True when the WhatsApp send could not be enqueued for want of an approved `CARD_SHARE`
   * template. **The link is still live.**
   */
  templateMissing: boolean;
}

/**
 * How the share UI names a person: their name, or — when the registry has none — their number,
 * **formatted and written once**.
 *
 * ⚠ Not `contactLabel` (types/domain). That falls back to the raw E.164 string, and a picker then
 * appended the formatted number after it, so every unnamed contact read
 * "+447979080009 · +44 7979 080009".
 */
export function recipientName(displayName: string | null, phoneE164: string): string {
  const name = displayName?.trim() ?? "";
  return name.length > 0 ? name : formatPhoneDisplay(phoneE164);
}

function mintedFrom(link: ShareLinkResponseDto, templateMissing: boolean): MintedLink {
  return {
    shareLinkId: link.id,
    url: link.url,
    contactId: link.contactId,
    recipientLabel: recipientName(link.contactDisplayName, link.contactPhoneE164),
    recipientPhoneE164: link.contactPhoneE164,
    templateMissing,
  };
}

/** Who a send is for: a typed number (upserted first) or a contact already in the registry. */
export type ShareTarget =
  | { phoneE164: string; displayName?: string }
  | { contactId: string };

/**
 * Send one card to one person. The whole two-call flow, shared by `/cards/{id}` and `/share`.
 *
 * Resolves with the minted link — `templateMissing: true` when the link exists but WhatsApp did
 * not go out. Rejects with the API's own error for everything else, so the caller reports it.
 *
 * The phone number is never logged here or anywhere below; it travels only in the request body.
 */
export async function shareCardWith(cardId: string, target: ShareTarget): Promise<MintedLink> {
  const phoneE164 = "phoneE164" in target ? target.phoneE164 : null;
  const recipientId =
    "contactId" in target
      ? target.contactId
      : (
          await contactsApi.upsert({
            phoneE164: target.phoneE164,
            displayName:
              target.displayName !== undefined && target.displayName.trim().length > 0
                ? target.displayName.trim()
                : undefined,
          })
        ).id;

  try {
    return mintedFrom(await cardsApi.share(cardId, { contactId: recipientId }), false);
  } catch (thrown) {
    if (isApiError(thrown) && thrown.code === "CARD_SHARE_TEMPLATE_NOT_CONFIGURED") {
      const recovered = await findMintedLink(cardId, recipientId, phoneE164);
      if (recovered !== null) return mintedFrom(recovered, true);
    }
    throw thrown;
  }
}

/**
 * Recover the link a `CARD_SHARE_TEMPLATE_NOT_CONFIGURED` response minted but did not return.
 *
 * The API is idempotent per `(card, contact)` pair and mints **before** it tries to enqueue the
 * message, so the row exists even though the request 4xx'd. `GET /share-links` is unpaginated and
 * covers every card, so the pair is found by matching on the card **and** the recipient — never
 * on `cardId` alone, which would hand back some other recipient's link.
 *
 * Returns `null` rather than throwing: the caller's fallback is to report the original error,
 * which is the honest outcome when the link cannot be shown.
 */
async function findMintedLink(
  cardId: string,
  contactId: string,
  phoneE164: string | null,
): Promise<ShareLinkResponseDto | null> {
  try {
    const links = await linksApi.list();
    return (
      links.find(
        (link) =>
          link.cardId === cardId &&
          link.contactId === contactId &&
          (phoneE164 === null || link.contactPhoneE164 === phoneE164),
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
export function CardShares({ shares, onChanged }: CardSharesProps) {
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
        description="People you send it to show up here, with whether they opened it."
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
