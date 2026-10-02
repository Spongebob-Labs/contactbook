"use client";

import { useCallback, useEffect, useMemo, useRef, type ReactElement } from "react";

import { canBuildVcf } from "@/card/build-vcf";
import { QrZone } from "@/card/qr-zone";
import { Button } from "@/components/primitives/button";
import { CardLinkBlock } from "@/components/share/card-link-block";
import { CardShares } from "@/components/share/card-sharing";
import { NotifyBanner } from "@/components/share/notify-recipients";
import { SendToPhone } from "@/components/share/send-to-phone";
import { WalletActions } from "@/components/share/wallet-actions";
import { Skeleton } from "@/components/primitives/skeleton";
import { fetchCardSharing } from "@/lib/api/browser-loaders";
import { useApiResource } from "@/lib/use-api";
import type { ResolvedCard } from "@/types/domain";

/**
 * The **Share** panel of the Profile & Cards workspace — everything `/cards/{id}` offered for
 * sending a card, without leaving the page the card is being built on.
 *
 * Client, 2026-09-30: *"Share could be more simplistic and better."* So it is four blocks, in the
 * order they are reached for: **send it to a number** (the primary action, and the only form),
 * **the link** (copy, WhatsApp, the share sheet), **the QR** (scan it off this screen, save it,
 * wallet), and **who has it**. What `/cards/{id}` also carried and this does not: the full-size
 * share face (the QR block is its working part) and "What's on this card" (the card is on the
 * right of this very screen).
 *
 * Mount it with `key={cardId}`: a half-typed number belongs to the card it was typed for.
 */

export interface WorkspaceSharePanelProps {
  cardId: string;
  userId: string;
  /** The workspace's one resolution of the selected card (I-5) — never re-resolved here. */
  resolved: ResolvedCard;
  /** Takes the owner to the Fields panel, from the "no fields yet" note. */
  onAddFields: () => void;
}

/** The QR is drawn at the share face's own size, so it is exactly as scannable as the pass. */
const QR_CARD_WIDTH = 336;

export function WorkspaceSharePanel({
  cardId,
  userId,
  resolved,
  onAddFields,
}: WorkspaceSharePanelProps): ReactElement {
  /* The name is only used to label a recipient row the share-link list missed, so a rename must
     not refetch the recipients. Read through a ref. */
  const cardName = useRef(resolved.cardName);
  useEffect(() => {
    cardName.current = resolved.cardName;
  }, [resolved.cardName]);
  const load = useCallback(
    () => fetchCardSharing(cardId, cardName.current, userId),
    [cardId, userId],
  );
  const sharing = useApiResource(load);
  const shares = useMemo(() => sharing.data?.shares ?? [], [sharing.data]);
  const contacts = useMemo(() => sharing.data?.contacts ?? [], [sharing.data]);
  const holders = useMemo(() => new Set(shares.map((share) => share.contactId)), [shares]);

  const sharesNothing = !canBuildVcf(resolved);

  return (
    <div data-workspace-share-panel="" className="flex flex-col gap-8">
      <SendToPhone
        title="Send to a phone"
        cards={[{ id: cardId, name: resolved.cardName }]}
        contacts={contacts}
        alreadySent={(_, contactId) => holders.has(contactId)}
        onSent={sharing.reload}
        notice={
          sharesNothing ? (
            /* §11 E-01's consequence, in the owner's words, before they send. */
            <p data-share-empty-note="" className="text-sm text-warning-ink">
              This card has no fields yet, so the link only shows your name.{" "}
              <button
                type="button"
                data-share-add-fields=""
                onClick={onAddFields}
                className="font-medium underline underline-offset-4"
              >
                Add fields
              </button>
            </p>
          ) : undefined
        }
      />

      {/* The exact string the QR below encodes, so the two can never publish different URLs. */}
      <CardLinkBlock url={resolved.qrPayload ?? null} cardName={resolved.cardName} />

      <section
        data-workspace-qr=""
        aria-labelledby="workspace-qr-heading"
        className="flex min-w-0 flex-col gap-4 border-t border-line pt-8"
      >
        <div className="flex flex-col gap-1">
          <h2 id="workspace-qr-heading" className="text-overline uppercase text-ink-3">
            QR code
          </h2>
          <p className="text-sm text-ink-3">
            Hold your screen up to someone&apos;s camera, or save the image to your phone.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-start">
          {/* A white plate on a sunk well, so the symbol keeps its quiet zone on any theme. */}
          <div className="flex shrink-0 justify-center self-start rounded-xl border border-line bg-surface-sunk p-4 max-sm:self-stretch">
            <QrZone payload={resolved.qrPayload} cardWidth={QR_CARD_WIDTH} mode="full" />
          </div>
          <div className="min-w-0 flex-1">
            <WalletActions cardId={cardId} resolved={resolved} />
          </div>
        </div>
      </section>

      <section
        data-workspace-sent-to=""
        aria-labelledby="card-shares-heading"
        className="flex min-w-0 flex-col gap-4 border-t border-line pt-8"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="card-shares-heading" className="text-overline uppercase text-ink-3">
            Sent to
          </h2>
          {sharing.state === "error" ? (
            <Button variant="text-link" className="text-sm" onClick={sharing.reload}>
              Try again
            </Button>
          ) : null}
        </div>

        {sharing.state === "loading" ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : sharing.state === "error" ? (
          <p className="text-sm text-ink-3">We couldn&apos;t load who has this card.</p>
        ) : (
          <>
            {/* Renders only when somebody is behind on this card. */}
            <NotifyBanner
              cardId={cardId}
              shares={shares}
              contacts={contacts}
              onChanged={sharing.reload}
            />
            <CardShares cardId={cardId} shares={shares} onChanged={sharing.reload} />
          </>
        )}
      </section>
    </div>
  );
}
