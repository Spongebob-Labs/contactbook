"use client";

import { Download, Wallet } from "lucide-react";
import { useId, useState } from "react";

import { useToast } from "@/components/overlay";
import { Button, buttonClassName } from "@/components/primitives/button";
import { ExportPngButton } from "@/components/share/export-png-button";
import { parseErrorEnvelope } from "@/lib/api/errors";
import { browserApiBase } from "@/lib/api/mode";
import type { ResolvedCard } from "@/types/domain";

/**
 * **Add to Apple Wallet · Add to Google Wallet · Save QR to phone** — `/cards/[cardId]`, block (d).
 *
 * ## Why the wallet buttons are back, and why they are honest this time
 * They were removed on 2026-09-20 because both did nothing but raise a toast explaining that they
 * did nothing. Client review, 2026-09-28, reversed the call: *"'Add to Wallet' must be functional
 * and visible."* Visible is a UI decision; functional needs a backend that does not exist yet —
 * the API has no pass endpoint and no Apple Pass Type ID certificate to sign one with.
 *
 * So the two buttons are wired to the endpoints the backend is being asked for, behind
 * `NEXT_PUBLIC_WALLET_PASSES`:
 *
 * · **Apple** — `GET /cards/{id}/wallet/apple` answers `application/vnd.apple.pkpass`. A plain
 *   navigation, not a `fetch`: Safari hands a pkpass response to Wallet itself, and a blob URL
 *   does not reliably get the same treatment.
 * · **Google** — `GET /cards/{id}/wallet/google` answers `{ saveUrl }`, the signed
 *   `pay.google.com/gp/v/save/…` link, which the browser then opens.
 *
 * With the flag unset (today) both render **visibly but disabled**, with one short line saying
 * so, and the control beside them that does work: **Save QR to phone**, which writes the share
 * face — the card and its scannable QR — to an image through the same renderer the old "Export
 * PNG" used. That is the functional part until the passes ship.
 *
 * ⚠ These are the app's own chrome (`components/primitives/button`), never `<CardActionButton>`:
 * a card-coloured control under a card on the app canvas fuses with it
 * (`tests/contract/card-buttons-on-canvas.test.tsx`). When the passes go live, swap these two for
 * Apple's and Google's official badge artwork — both brands require it on a real "Add to" control.
 *
 * ⚠ Rendered OUTSIDE `<WalletPassBlock>`'s scroll rail, which wraps the face alone: a control in
 * the rail is sized by the rigid 336px face and needs a sideways scroll at 320px.
 */

/** `NEXT_PUBLIC_WALLET_PASSES=1` turns the two pass buttons on. Unset means off. */
export function walletPassesEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_WALLET_PASSES;
  return flag === "1" || flag === "true";
}

/** The one line shown while the passes are off. */
export const WALLET_OFF_NOTE = "Wallet passes aren't available yet. Save the QR image instead.";

/** The intended endpoints, relative to the browser's API base (the `/api/cb` proxy by default). */
export function applePassHref(cardId: string): string {
  return `${browserApiBase()}/cards/${encodeURIComponent(cardId)}/wallet/apple`;
}

export function googlePassEndpoint(cardId: string): string {
  return `${browserApiBase()}/cards/${encodeURIComponent(cardId)}/wallet/google`;
}

export interface WalletActionsProps {
  cardId: string;
  /** The screen's one `ResolvedCard` — the image is rasterised from it (I-5). */
  resolved: ResolvedCard;
  /** Injected for tests; the page reads the build-time flag. */
  enabled?: boolean;
}

export function WalletActions({
  cardId,
  resolved,
  enabled = walletPassesEnabled(),
}: WalletActionsProps) {
  const { toast } = useToast();
  const [googlePending, setGooglePending] = useState(false);
  /* The visible line IS the reason, so the disabled buttons point at it rather than carrying a
     hidden copy of the same sentence — a screen reader would otherwise hear it three times. */
  const noteId = useId();

  async function openGoogleWallet() {
    setGooglePending(true);
    try {
      const response = await fetch(googlePassEndpoint(cardId), {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      const saveUrl =
        response.ok && typeof body === "object" && body !== null
          ? (body as { saveUrl?: unknown }).saveUrl
          : undefined;
      if (typeof saveUrl !== "string" || !saveUrl.startsWith("https://")) {
        const envelope = parseErrorEnvelope(body);
        throw new Error(envelope?.code ?? `status ${response.status}`);
      }
      window.location.assign(saveUrl);
    } catch {
      toast({
        title: "Couldn't open Google Wallet",
        description: "Try again in a moment, or save the QR image instead.",
        tone: "danger",
      });
    } finally {
      setGooglePending(false);
    }
  }

  return (
    <section
      data-wallet-actions=""
      data-wallet-enabled={enabled ? "true" : "false"}
      aria-labelledby="wallet-actions-heading"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 id="wallet-actions-heading" className="text-overline uppercase text-ink-3">
        Wallet
      </h2>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
        {enabled ? (
          <a
            href={applePassHref(cardId)}
            data-wallet-add="apple"
            className={buttonClassName({ variant: "secondary", className: "justify-start" })}
          >
            <Wallet aria-hidden="true" size={16} strokeWidth={1.75} />
            Add to Apple Wallet
          </a>
        ) : (
          <Button
            variant="secondary"
            data-wallet-add="apple"
            disabled
            aria-describedby={noteId}
            className="justify-start"
          >
            <Wallet aria-hidden="true" size={16} strokeWidth={1.75} />
            Add to Apple Wallet
          </Button>
        )}

        <Button
          variant="secondary"
          data-wallet-add="google"
          disabled={!enabled}
          aria-describedby={enabled ? undefined : noteId}
          loading={googlePending}
          loadingLabel="Opening…"
          className="justify-start"
          onClick={() => {
            void openGoogleWallet();
          }}
        >
          <Wallet aria-hidden="true" size={16} strokeWidth={1.75} />
          Add to Google Wallet
        </Button>
      </div>

      {enabled ? null : (
        <p id={noteId} data-wallet-off-note="" className="text-sm text-ink-3">
          {WALLET_OFF_NOTE}
        </p>
      )}

      <ExportPngButton
        resolved={resolved}
        variant="secondary"
        className="justify-start sm:self-start lg:self-stretch"
        label={
          <>
            <Download aria-hidden="true" size={16} strokeWidth={1.75} />
            Save QR to phone
          </>
        }
      />
    </section>
  );
}
