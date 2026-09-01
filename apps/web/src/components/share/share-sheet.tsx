"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { VCARD_MIME_TYPE, vcfFileName } from "@/card/build-vcf";
import Link from "next/link";

import { Button, buttonClassName } from "@/components/primitives/button";
import { Dialog, DialogClose, useToast } from "@/components/overlay";
import type { MintedLink } from "@/components/share/card-sharing";
import { whatsappHref } from "@/lib/format";
import type { ResolvedCard } from "@/types/domain";

/**
 * The share panel of `/cards/[cardId]` (spec §6.4, §6.9, §8D.3, plan T22).
 *
 * ## ⚠ This panel shares a **link**, and nothing else
 * §4.2's promise is that the recipient gets a link, not a file: the page they open resolves
 * from live data, so an owner's edit reaches them without anything being re-sent and a
 * revoked field disappears immediately. A downloaded `.vcf` is the opposite of that — a
 * frozen copy that stops tracking the moment it lands.
 *
 * So this panel used to carry a `.vcf` preview under the heading *"What people receive"* and
 * a **Download .vcf** control beside Close. Both are gone. The heading was simply false —
 * nobody on the receiving end of this dialog ever got that file — and the button offered the
 * owner a download of their own contact details, which answers no question they had.
 *
 * The vCard itself is still the product's (`CLAUDE.md` non-negotiable #2), on the two
 * surfaces where somebody actually wants it: the public card's **Save to contacts**, pressed
 * by the recipient, and its mirror on the owner's own card preview. Both write their file
 * through `useVcfDownload` below, from the one `ResolvedCard` the screen resolved — the I-5
 * seam moved with them, it was not dropped.
 *
 * ## `sharesNothing` is not a rendering detail
 * It is `canBuildVcf(resolved) === false` as decided by the screen — the single definition of
 * an empty card (T11), never an inline field count. Such a card has a link like any other,
 * but the link opens on a name and nothing else, so the panel says that plainly instead of
 * pretending the share is complete (§11 E-01/E-02, §11.6).
 *
 * ## The link is either live or a local guess, and the panel must say which
 * `GET /public/links/{token}` resolves a minted link (INTEGRATION ask #1, since resolved), so a
 * real link genuinely opens. What the API has **no** endpoint for is minting one *without a
 * recipient*: `ShareCardDto` requires a `contactId`, and probing staging confirms no anonymous
 * spelling exists — `/cards/{id}/link`, `/public-link` and `/share-link` all answer `Cannot GET`.
 *
 * So until this card has been minted for somebody, `qrPayload` is `${NEXT_PUBLIC_SITE_URL}/c/{slug}`
 * — a local guess that resolves to nothing. `linkIsLive` is the screen's own answer to which of the
 * two is on screen, passed down rather than sniffed from the string: the owner of that fact is
 * `card-detail-client.tsx`, which knows whether it handed `resolveCard` an API-minted URL. An
 * earlier version compared `qrPayload` against `window.location.origin`, which is both a render-
 * time read of `window` and wrong the moment the API is served from this origin.
 *
 * ## Copy, WhatsApp, Share — the link has to leave the panel somehow
 * A live URL printed as text is not a shared card. `CARD_SHARE_TEMPLATE_NOT_CONFIGURED` means the
 * server-side WhatsApp send is switched off, so **the owner is the delivery mechanism** — hence a
 * copy control, a `wa.me` deep link aimed at the recipient the link was just minted for, and the
 * platform share sheet where the browser has one.
 */

/* ── the vCard download, used by the two "Save to contacts" controls ────────────────── */

/**
 * ⚠ `<ShareSheet>` below does **not** use this hook — see the module note. It lives in this
 * file because both callers (`/c/{slug}` and `/cards/{id}`) already import from here, and a
 * new module for one hook would be the more disruptive change, not the tidier one.
 */

/** §6.9: the object URL is released well after the browser has taken the file. */
export const VCF_REVOKE_AFTER_MS = 30_000;

/**
 * How long a second press of a download control is ignored for (§11 E-43's shape).
 *
 * Writing a vCard is synchronous, so without a lock "in flight" would be a state nobody
 * could observe and a double tap — the ordinary way a thumb presses a button — would hand
 * the browser two identical files.
 */
export const VCF_LOCK_MS = 600;

export interface VcfDownload {
  /** Drives `aria-busy` on whichever control the screen wired to the download. */
  savePending: boolean;
  /**
   * §6.9, step by step: `Blob` → object URL → an anchor carrying `download` → click →
   * revoke after 30 s. Revoking sooner cancels the transfer; never revoking pins the whole
   * card in memory for the life of the tab.
   *
   * It takes the already-written `vcf` rather than writing one, for the reason in the module
   * note. `null` is a no-op — the backstop for a card that shares nothing.
   */
  downloadVcf: (resolved: ResolvedCard, vcf: string | null) => void;
}

export function useVcfDownload(): VcfDownload {
  const [savePending, setSavePending] = useState(false);
  const lockTimer = useRef<number | null>(null);
  /** timer id → the object URL it will revoke, so unmount cannot leak either one. */
  const revokes = useRef(new Map<number, string>());

  useEffect(() => {
    const pending = revokes.current;
    return () => {
      if (lockTimer.current !== null) window.clearTimeout(lockTimer.current);
      for (const [timer, url] of pending) {
        window.clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      pending.clear();
    };
  }, []);

  const downloadVcf = useCallback((resolved: ResolvedCard, vcf: string | null) => {
    // The lock, not a boolean read from state: `savePending` is a render-time value and a
    // second press can arrive before React has re-rendered.
    if (lockTimer.current !== null) return;
    // Backstop only — E-01 means no control is rendered for such a card in the first place.
    if (vcf === null) return;

    const url = URL.createObjectURL(new Blob([vcf], { type: VCARD_MIME_TYPE }));

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = vcfFileName(resolved);
    anchor.rel = "noopener";
    anchor.style.display = "none";
    // Attached before the click: a detached anchor's activation behaviour is not something
    // every engine agrees on, and this is the one interaction the product cannot get wrong.
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    const revoke = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      revokes.current.delete(revoke);
    }, VCF_REVOKE_AFTER_MS);
    revokes.current.set(revoke, url);

    setSavePending(true);
    lockTimer.current = window.setTimeout(() => {
      lockTimer.current = null;
      setSavePending(false);
    }, VCF_LOCK_MS);
  }, []);

  return { savePending, downloadVcf };
}

/* ── the panel ──────────────────────────────────────────────────────────────────────── */

/** §11 E-01's consequence, in the owner's language — the count alone does not explain it. */
const EMPTY_SHARE_NOTE =
  "This card maps no profile fields yet, so anyone who opens the link sees your name and " +
  "nothing else. Add fields to it and they appear on the shared card.";

/**
 * WhatsApp's own deep link, with the message already written.
 *
 * ⚠ Built on `whatsappHref` from `@/lib/format` rather than re-deriving the host and the digit
 * stripping. That function is §6.9's definition of how a phone number becomes a `wa.me` URL and
 * the public card's own action already uses it; a second copy here would be two definitions of
 * one rule, and the copy would be the one nobody updates.
 *
 * What this adds is the message. `encodeURIComponent` is not decorative: a card named `R&D` or
 * `#2` would otherwise end the query string at that character and send a truncated message.
 */
export function whatsappShareHref(phoneE164: string, cardName: string, url: string): string {
  const text = `Here's my ${cardName} card — it always shows my current details: ${url}`;
  return `${whatsappHref(phoneE164)}?text=${encodeURIComponent(text)}`;
}

/**
 * Whether this browser has a platform share sheet.
 *
 * `useSyncExternalStore` rather than the obvious `useState` + `useEffect`: the server has no
 * `navigator`, so reading it during render is a hydration mismatch, and writing it from an effect
 * is a render-then-correct that `react-hooks/set-state-in-effect` rejects on sight. This hook is
 * the primitive for exactly this shape — a value the server and the client legitimately disagree
 * about — and `getServerSnapshot` is where that disagreement is declared rather than papered over.
 *
 * The capability never changes within a page's life, so `subscribe` registers nothing. It must
 * still be a stable module-scope reference: a fresh arrow each render re-subscribes forever.
 */
function useCanNativeShare(): boolean {
  return useSyncExternalStore(subscribeToNothing, hasNativeShare, () => false);
}

const subscribeToNothing = () => () => {};
const hasNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

export interface ShareSheetProps {
  /** The one `ResolvedCard` the card, the `.vcf` and the PNG all share (I-5). */
  resolved: ResolvedCard;
  /**
   * Whether `canBuildVcf` said this card maps no fields worth sharing.
   *
   * Passed as the screen's answer rather than recomputed here, for the same reason as
   * `linkIsLive`: one owner of the fact, so the meter, the card's own controls and this panel
   * cannot disagree about whether a card is empty.
   */
  sharesNothing: boolean;
  /** Rendered inside the dialog's trigger. The screen owns the button's own attributes. */
  trigger: ReactNode;
  /** Where "Add fields" goes for a card that shares nothing (E-01's action). */
  editHref: string;
  /**
   * Whether `resolved.qrPayload` is a link the API minted, or this app's local `/c/{slug}` guess.
   *
   * Passed rather than inferred — see the module note. It decides the heading, whether the copy
   * and share controls exist at all, and whether the warning below is shown.
   */
  linkIsLive: boolean;
  /**
   * The link minted in this session, if one was. Its only job here is to aim the WhatsApp deep
   * link at the right number and to surface `templateMissing`; the URL itself arrives through
   * `resolved.qrPayload`, so there is exactly one link string in this panel (§8A.6).
   */
  lastSent?: MintedLink;
  /**
   * The contact picker (`<SendToContact>`), rendered above the link.
   *
   * A slot rather than props, because sending is a Server Action round trip and this component is
   * otherwise entirely local — it writes a `.vcf` from a string it was handed and touches nothing
   * else. Keeping the network out of here is what lets the QR and the download keep working with
   * no API at all.
   *
   * Rendered **first**: sending to a contact is the primary way to share now. The public link and
   * the file below it are the offline fallbacks.
   */
  sendSlot?: ReactNode;
}

export function ShareSheet({
  resolved,
  sharesNothing,
  trigger,
  editHref,
  sendSlot,
  linkIsLive,
  lastSent,
}: ShareSheetProps) {
  const { toast } = useToast();

  const canNativeShare = useCanNativeShare();

  function copyLink() {
    // Guarded rather than disabled-only: an unsaved card has no URL, and writing the string
    // "null" to the clipboard is the kind of thing nobody notices until they paste it.
    if (resolved.qrPayload === null) return;
    void navigator.clipboard
      ?.writeText(resolved.qrPayload)
      .then(() => toast({ title: "Link copied" }))
      .catch(() =>
        toast({
          title: "We couldn't copy that",
          description: "Select the link and copy it by hand.",
          tone: "danger",
        }),
      );
  }

  function nativeShare() {
    // A cancelled share sheet rejects with `AbortError` — a user changing their mind, not a
    // failure, so it is swallowed rather than reported.
    if (resolved.qrPayload === null) return;
    void navigator.share?.({ title: resolved.cardName, url: resolved.qrPayload }).catch(() => {});
  }

  return (
    <Dialog
      trigger={trigger}
      overline="Share"
      title="Share this card"
      description="Anyone with the link, or anyone who scans the QR code, opens this card."
      size="md"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
          {/* The only other thing this panel can offer is the fix for an empty card. There is
              no second control here on a card that shares fine — the link, and the ways to
              send it, are in the body. */}
          {sharesNothing ? (
            // §8D.7: an anchor wears the button skin rather than nesting a `<button>` inside
            // a link — that shape is invalid HTML and axe reports it as `nested-interactive`.
            <Link href={editHref} data-share-add-fields="" className={buttonClassName()}>
              Add fields
            </Link>
          ) : null}
        </>
      }
    >
      <div data-share-sheet="" className="flex flex-col gap-6">
        {sendSlot === undefined ? null : (
          <>
            {sendSlot}
            <hr className="border-line" />
          </>
        )}

        <div data-share-link="" className="flex flex-col gap-2">
          <p className="text-overline uppercase text-ink-3">
            {linkIsLive ? "Live link" : "Preview link"}
          </p>
          {/* The exact string the QR encodes (§8A.6), so what is printed on the card and what is
              copied out of this panel can never be two different URLs. */}
          <p data-share-link-value="" className="text-machine text-sm break-all text-ink">
            {resolved.qrPayload}
          </p>

          {linkIsLive ? (
            <div data-share-link-actions="" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Button variant="text-link" data-share-copy="" onClick={copyLink}>
                Copy link
              </Button>

              {/* Aimed at the number this link was minted for, with the message pre-filled — the
                  owner presses send. `wa.me` is WhatsApp's own deep link and opens the desktop app
                  or web client too, so this is not a mobile-only control. */}
              {lastSent === undefined ? null : (
                <a
                  data-share-whatsapp=""
                  href={whatsappShareHref(
                    lastSent.recipientPhoneE164,
                    resolved.cardName,
                    resolved.qrPayload ?? "",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClassName({ variant: "text-link" })}
                >
                  {`Send on WhatsApp to ${lastSent.recipientLabel}`}
                </a>
              )}

              {canNativeShare ? (
                <Button variant="text-link" data-share-native="" onClick={nativeShare}>
                  Share…
                </Button>
              ) : null}
            </div>
          ) : (
            /* ⚠ Said plainly rather than dressed up as a working link. A link exists only once
               this card has been minted for somebody: `ShareCardDto` requires a `contactId` and
               the API has no anonymous spelling. What is shown is a local guess built from
               NEXT_PUBLIC_SITE_URL — usually `http://localhost:3000`, which nobody else can open.
               The field above turns it into a real one. */
            <p data-share-link-preview-note="" className="text-sm text-warning-ink">
              This is a local preview, not a shareable address. Create a link above — enter a
              number, or pick a contact — and the real one appears here.
            </p>
          )}

          {/* Not an error. The link is live; only the automatic delivery is off. */}
          {lastSent?.templateMissing === true ? (
            <p data-share-template-missing="" className="text-sm text-warning-ink">
              WhatsApp sending is not switched on yet, so nothing was delivered automatically. The
              link above is live — copy it, or send it yourself.
            </p>
          ) : null}
        </div>

        {sharesNothing ? (
          <p data-share-empty-note="" className="text-sm text-warning-ink">
            {EMPTY_SHARE_NOTE}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
