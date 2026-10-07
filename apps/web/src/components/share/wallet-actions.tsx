"use client";

import { Wallet } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button, buttonClassName } from "@/components/primitives/button";
import { cards } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/errors";
import { browserApiBase } from "@/lib/api/mode";

/**
 * **Add to Apple Wallet** and **Add to Google Wallet** — the Share panel of Profile & Cards and
 * the `/cards/[cardId]` screen, next to the QR. (Both Google Wallet and Save QR to phone were
 * removed 2026-10-06, "client wanted Apple Wallet only". Google Wallet came back 2026-10-07, this
 * time functional. Save QR to phone did not.)
 *
 * The two buttons look alike and work in opposite ways — Apple is a link that must never be a
 * `fetch`, Google is a `fetch` that then navigates. The Google half is documented at
 * {@link GoogleWalletButton}; everything from here to there is Apple.
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
export const WALLET_UNAVAILABLE_NOTE = "Apple Wallet isn't available yet.";

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

/* ── Google Wallet ───────────────────────────────────────────────────────────────────── */

/** Shown when the server has no Google Wallet credentials (`409 GOOGLE_WALLET_NOT_CONFIGURED`). */
export const GOOGLE_WALLET_NOT_CONFIGURED_NOTE = "Google Wallet isn't set up on this server yet.";
/** Shown when the link could not be fetched — the button stays live, so pressing again retries. */
export const GOOGLE_WALLET_ERROR_NOTE = "Couldn't open Google Wallet. Try again.";
/** Only reachable with {@link GOOGLE_WALLET_ON_DESKTOP} off: the desktop, Android-only state. */
export const GOOGLE_WALLET_NOT_ANDROID_NOTE =
  "Add to Google Wallet works on Android. Open this page on your phone.";

/**
 * ⚠ **A DELIBERATE DEVIATION FROM THE BUILD GUIDE — and the one line to change to undo it.**
 *
 * The guide (`.claude/skills/contactbook-google-wallet`, §2.1) says the button is live on Android
 * only. It is also live on desktop browsers here, for two reasons: the owner asked to test the
 * feature from the dashboard, which they use on a laptop; and Google's save link genuinely works
 * in a desktop browser signed in to a Google account (the pass lands in that account's Wallet).
 *
 * Set this to `false` and desktop falls back to the guide's behaviour: the button stays visible
 * but disabled, saying it works on Android. iPhone and iPad are unaffected either way — they
 * never show a Google button.
 */
export const GOOGLE_WALLET_ON_DESKTOP: boolean = true;

/** An Android browser. Unlike iPadOS, Android has never hidden itself behind another platform's UA. */
export function detectAndroid(nav: Pick<Navigator, "userAgent">): boolean {
  return /Android/i.test(nav.userAgent);
}

/**
 * Whether a string is one of Google's own save links, and nothing else.
 *
 * The browser is about to be sent wherever the response says. That response should only ever be
 * `https://pay.google.com/gp/v/save/<jwt>`, so anything else — a different host, plain `http`, a
 * `javascript:` URL from a response that is not what it claims — is treated as a failed call
 * rather than followed.
 */
export function isGoogleSaveUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname === "pay.google.com" && url.pathname.startsWith("/gp/v/save/")
    );
  } catch {
    return false;
  }
}

type GoogleWalletPhase = "idle" | "loading" | "not-configured" | "error";

/**
 * **Add to Google Wallet** — a `fetch`, then a navigation. The opposite of the Apple link above.
 *
 * `GET /cards/{id}/google-wallet-pass` makes the API create or refresh the pass on Google's side
 * and answer `{ url }`, Google's own "Save to Google Wallet" link. The browser then goes there.
 * The pass carries the owner's name, the card name, the headline and the card's QR link — no
 * field values, no phone numbers — and the API keeps a saved pass in step with later edits.
 *
 * Nothing is asked of the server until the button is pressed: the call creates the pass, so it is
 * not something to fire as a probe on every page view (which is what the Apple side can afford to
 * do, because its endpoint only builds a file).
 *
 * ### What each answer becomes
 *
 * · **200** — navigate to the link (after {@link isGoogleSaveUrl} has confirmed it is Google's).
 * · **409 `GOOGLE_WALLET_NOT_CONFIGURED`** — the server has no Google credentials. The button
 *   goes disabled with one line saying so, and stays that way: pressing again cannot help.
 *   Never a toast.
 * · **401** — `cb()` has already tried its one refresh-and-retry. What is left is a dead session,
 *   so it takes the same exit the app's layouts take: `/api/session/end`, which clears the
 *   cookies and lands on sign-in, carrying this page as `next`.
 * · **404, a network failure, anything else** — one quiet line, and the button is live again.
 *
 * ⚠ Google's brand guidelines require the official "Add to Google Wallet" button artwork on a
 * production control (developers.google.com/wallet/generic/resources/brand-guidelines). It is not
 * in the repo yet. When it is, put it in `apps/web/public/` and replace the icon-and-text inside
 * this button with it (unaltered, at least 48dp high) — the behaviour around it does not change.
 */
function GoogleWalletButton({ cardId, offered }: { cardId: string; offered: boolean }) {
  const [phase, setPhase] = useState<GoogleWalletPhase>("idle");
  const noteId = useId();

  async function save() {
    setPhase("loading");
    try {
      const { url } = await cards.googleWalletPass(cardId);
      if (!isGoogleSaveUrl(url)) {
        setPhase("error");
        return;
      }
      /* Back to idle before leaving: a browser that restores this page from its back/forward
         cache must not show a button stuck on "Opening…". */
      setPhase("idle");
      window.location.assign(url);
    } catch (thrown) {
      if (isApiError(thrown) && thrown.code === "GOOGLE_WALLET_NOT_CONFIGURED") {
        setPhase("not-configured");
        return;
      }
      if (isApiError(thrown) && thrown.status === 401) {
        const here = `${window.location.pathname}${window.location.search}`;
        /* A hard navigation on purpose: `/api/session/end` is a Route Handler that has to clear
           the httpOnly session cookies, which a client-side `router.push()` would never reach. */
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/api/session/end?next=${encodeURIComponent(here)}`);
        return;
      }
      setPhase("error");
    }
  }

  const note = !offered
    ? GOOGLE_WALLET_NOT_ANDROID_NOTE
    : phase === "not-configured"
      ? GOOGLE_WALLET_NOT_CONFIGURED_NOTE
      : phase === "error"
        ? GOOGLE_WALLET_ERROR_NOTE
        : null;

  return (
    <>
      <Button
        variant="secondary"
        data-wallet-add="google"
        data-wallet-google-state={offered ? phase : "not-android"}
        disabled={!offered || phase === "not-configured"}
        loading={phase === "loading"}
        loadingLabel="Opening Google Wallet…"
        aria-describedby={note === null ? undefined : noteId}
        onClick={() => void save()}
        className="justify-start"
      >
        <Wallet aria-hidden="true" size={16} strokeWidth={1.75} />
        Add to Google Wallet
      </Button>
      {/* Always in the tree AND always rendered, so a line that appears after a press is
          announced: a live region that mounts (or leaves `display: none`) already holding its
          text is skipped by most screen readers. `basis-full` drops it under the buttons in the
          `sm` row; while empty it is zero-height, and `empty:-mt-2` takes back the flex gap it
          would otherwise leave. */}
      <p
        id={noteId}
        role="status"
        data-wallet-google-note=""
        className="basis-full text-sm text-ink-3 empty:-mt-2"
      >
        {note}
      </p>
    </>
  );
}

export interface WalletActionsProps {
  cardId: string;
  /** Injected for tests. Omit to detect from the browser. */
  ios?: boolean;
  /** Injected for tests. Omit to detect from the browser. Ignored when `ios` is true. */
  android?: boolean;
}

export function WalletActions({ cardId, ios: iosProp, android: androidProp }: WalletActionsProps) {
  /* `null` until the browser has been asked — the server render and first paint are identical. */
  const [detected, setDetected] = useState<boolean | null>(null);
  const [detectedAndroid, setDetectedAndroid] = useState<boolean | null>(null);
  const [availability, setAvailability] = useState<
    { cardId: string; value: WalletPassAvailability } | null
  >(null);
  const noteId = useId();

  useEffect(() => {
    // Detection is a read of the browser, not derived state; it can only happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetected(iosProp ?? detectIOS(navigator));
    setDetectedAndroid(androidProp ?? detectAndroid(navigator));
  }, [iosProp, androidProp]);

  const ios = iosProp ?? detected;
  const android = androidProp ?? detectedAndroid;

  /* Google Wallet: never on iPhone/iPad (no Google button there at all — Apple Wallet is the one
     that works), and not before the browser has been asked, so the server render and the first
     paint agree. Everywhere else it is shown; whether it is LIVE is the platform rule documented
     at `GOOGLE_WALLET_ON_DESKTOP`. */
  const showGoogle = ios === false && android !== null;
  const googleOffered = android === true || GOOGLE_WALLET_ON_DESKTOP;

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
        {/* Keyed to the card, so switching cards never shows the previous card's answer. */}
        {showGoogle ? <GoogleWalletButton key={cardId} cardId={cardId} offered={googleOffered} /> : null}
      </div>

      {note === null ? null : (
        <p id={noteId} data-wallet-off-note="" className="text-sm text-ink-3">
          {note}
        </p>
      )}
    </section>
  );
}
