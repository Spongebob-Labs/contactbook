"use client";

import { Download, Wallet } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button, buttonClassName } from "@/components/primitives/button";
import { ExportPngButton } from "@/components/share/export-png-button";
import { browserApiBase } from "@/lib/api/mode";
import type { ResolvedCard } from "@/types/domain";

/**
 * **Add to Apple Wallet · Add to Google Wallet · Save QR to phone** — the Share panel of
 * Profile & Cards and the `/cards/[cardId]` screen, next to the QR.
 *
 * ## Apple Wallet is live
 *
 * `GET /cards/{id}/wallet-pass` (the backend's `WalletPassController`) builds and signs a
 * `.pkpass` from the card's CURRENT data on every request and answers
 * `application/vnd.apple.pkpass`. The pass carries the owner's name, the card name, the headline
 * and a QR that is the card's live `/c/{token}` link — no phone numbers, no field values — and the
 * backend pushes edits and archives to passes already installed, so the web app has no part in
 * keeping one fresh.
 *
 * ### ⚠ A plain link, never `fetch`
 *
 * iOS Safari hands a `pkpass` response to Wallet only when the response IS the navigation. A
 * `fetch()` + blob never reaches Wallet. So the button is an `<a href>` that goes through the
 * `/api/cb` proxy (which attaches the session cookie as a bearer and passes the API's headers and
 * bytes through unchanged). It deliberately has no `download` attribute: that would turn the tap
 * into a file download instead of the "Add to Wallet" sheet.
 *
 * ### Three states, because the link cannot report its own failure
 *
 * A tapped link that answers `409 WALLET_NOT_CONFIGURED` (signing secrets not deployed) would
 * replace the page with a JSON error. So on iPhone/iPad the block first asks the same endpoint
 * once, in the background ({@link checkWalletPass}), and shows the live link only when it really
 * answered a pass:
 *
 * · **iPhone / iPad, pass available** — the live "Add to Apple Wallet" link.
 * · **iPhone / iPad, not available** (feature off on this server, or any error) — the button,
 *   disabled, with one line saying so. Never an error toast.
 * · **Anywhere else** (desktop, Android) — the button stays visible, disabled, with one line
 *   saying it works on iPhone. Client, 2026-09-28: *"'Add to Wallet' must be functional and
 *   visible."*
 *
 * ## Google Wallet is not built
 *
 * The backend has no Google endpoint, so that button is visible, disabled and says "coming soon".
 * It makes no request — an earlier version called an endpoint that never existed.
 *
 * ⚠ These are the app's own chrome (`components/primitives/button`), never `<CardActionButton>`:
 * a card-coloured control under a card on the app canvas fuses with it
 * (`tests/contract/card-buttons-on-canvas.test.tsx`).
 *
 * ⚠ Apple requires its official "Add to Apple Wallet" badge artwork on a production control. It is
 * a download from Apple's guidelines page and is not in the repo yet; when it is, replace the
 * icon-and-text inside the link below with it (minimum 44pt high, unaltered).
 *
 * ⚠ Rendered OUTSIDE `<WalletPassBlock>`'s scroll rail, which wraps the face alone: a control in
 * the rail is sized by the rigid 336px face and needs a sideways scroll at 320px.
 */

/** The pass endpoint, relative to the browser's API base (the `/api/cb` proxy by default). */
export function applePassHref(cardId: string): string {
  return `${browserApiBase()}/cards/${encodeURIComponent(cardId)}/wallet-pass`;
}

/** Shown where Apple Wallet cannot be used from this device. */
export const WALLET_NOT_IOS_NOTE = "Add to Apple Wallet works on iPhone. Open this page on your phone.";
/** Shown on iPhone when the server cannot make a pass. */
export const WALLET_UNAVAILABLE_NOTE = "Apple Wallet isn't available yet. Save the QR image instead.";
/** Google Wallet has no backend yet. */
export const GOOGLE_SOON_NOTE = "Google Wallet is coming soon.";

/**
 * iPhone or iPad. iPadOS 13+ Safari reports itself as a Mac, so a "Mac" with a touch screen is an
 * iPad (no Mac has one). Read in an effect, never during render: the server has no `navigator`,
 * and a value that differs between server and client is a hydration mismatch.
 */
export function detectIOS(nav: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">): boolean {
  if (/iPhone|iPad|iPod/i.test(nav.userAgent)) return true;
  return nav.platform === "MacIntel" && nav.maxTouchPoints > 1;
}

export type WalletPassAvailability = "ready" | "unavailable";

/**
 * Ask the pass endpoint whether it can answer, without opening it.
 *
 * `ready` only for a `200` whose `Content-Type` is the pass type. Everything else — `409
 * WALLET_NOT_CONFIGURED`, `404`, `401`, a network failure — is `unavailable`, because the only
 * thing the owner can do about any of them is not tap a link that would land on an error page.
 * The body is discarded unread: this is a probe, not a download.
 */
export async function checkWalletPass(cardId: string): Promise<WalletPassAvailability> {
  try {
    const response = await fetch(applePassHref(cardId), {
      credentials: "same-origin",
      cache: "no-store",
    });
    const type = response.headers.get("content-type") ?? "";
    void response.body?.cancel().catch(() => undefined);
    return response.ok && type.includes("application/vnd.apple.pkpass") ? "ready" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export interface WalletActionsProps {
  cardId: string;
  /** The screen's one `ResolvedCard` — the image is rasterised from it (I-5). */
  resolved: ResolvedCard;
  /** Injected for tests. Omit to detect from the browser. */
  ios?: boolean;
}

export function WalletActions({ cardId, resolved, ios: iosProp }: WalletActionsProps) {
  /* `null` until the browser has been asked — the server render and first paint are identical. */
  const [detected, setDetected] = useState<boolean | null>(null);
  const [availability, setAvailability] = useState<
    { cardId: string; value: WalletPassAvailability } | null
  >(null);
  const noteId = useId();

  useEffect(() => {
    // Detection is a read of the browser, not derived state; it can only happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetected(iosProp ?? detectIOS(navigator));
  }, [iosProp]);

  const ios = iosProp ?? detected;

  useEffect(() => {
    if (ios !== true) return;
    let current = true;
    void checkWalletPass(cardId).then((value) => {
      if (current) setAvailability({ cardId, value });
    });
    return () => {
      current = false;
    };
  }, [ios, cardId]);

  /* Keyed to the card, so switching cards never shows the previous card's answer. */
  const state: "pending" | "ready" | "not-ios" | "unavailable" =
    ios === null
      ? "pending"
      : ios === false
        ? "not-ios"
        : availability === null || availability.cardId !== cardId
          ? "pending"
          : availability.value === "ready"
            ? "ready"
            : "unavailable";

  const note =
    state === "not-ios" ? WALLET_NOT_IOS_NOTE : state === "unavailable" ? WALLET_UNAVAILABLE_NOTE : null;

  return (
    <section
      data-wallet-actions=""
      data-wallet-enabled={state === "ready" ? "true" : "false"}
      data-wallet-state={state}
      aria-labelledby="wallet-actions-heading"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 id="wallet-actions-heading" className="text-overline uppercase text-ink-3">
        Wallet
      </h2>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
        {state === "ready" ? (
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
            aria-describedby={note === null ? undefined : noteId}
            loading={state === "pending"}
            className="justify-start"
          >
            <Wallet aria-hidden="true" size={16} strokeWidth={1.75} />
            Add to Apple Wallet
          </Button>
        )}

        <Button
          variant="secondary"
          data-wallet-add="google"
          disabled
          aria-describedby={`${noteId}-google`}
          className="justify-start"
        >
          <Wallet aria-hidden="true" size={16} strokeWidth={1.75} />
          Add to Google Wallet
        </Button>
      </div>

      {note === null ? null : (
        <p id={noteId} data-wallet-off-note="" className="text-sm text-ink-3">
          {note}
        </p>
      )}
      <p id={`${noteId}-google`} data-wallet-google-note="" className="text-sm text-ink-3">
        {GOOGLE_SOON_NOTE}
      </p>

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
