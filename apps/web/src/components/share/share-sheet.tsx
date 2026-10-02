"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { VCARD_MIME_TYPE, vcfFileName } from "@/card/build-vcf";
import { whatsappHref } from "@/lib/format";
import type { ResolvedCard } from "@/types/domain";

/**
 * The share helpers that outlived the share **dialog**.
 *
 * ## ⚠ There is no `<ShareSheet>` any more, on purpose
 * `/cards/[cardId]` used to hide sharing behind a "Share" button that opened a dialog repeating
 * the card's link and a contact picker. Client review, 2026-09-28: *"Sharing view needs a
 * redesign: core function is sharing, not showing fields again."* The share controls now live
 * on the page itself (`send-to-phone.tsx`, `card-link-block.tsx`, `wallet-actions.tsx`), and the
 * header's Share button focuses the phone field instead of opening a second copy of them. One
 * share UI, not two.
 *
 * What stayed here is what other screens import: the WhatsApp deep links, and the vCard download
 * hook `/c/{slug}`'s "Save to contacts" uses. The file keeps its name because `/c/{slug}` already
 * imports from it, and moving a hook for tidiness is the more disruptive change.
 *
 * ## ⚠ This panel shares a **link**, and nothing else
 * §4.2's promise is that the recipient gets a link, not a file: the page they open resolves from
 * live data, so an owner's edit reaches them without anything being re-sent. The owner's screen
 * therefore offers no `.vcf` of their own card — `tests/e2e/card-detail.spec.ts` guards that.
 */

/* ── the vCard download, used by "Save to contacts" on /c/{slug} ─────────────────────── */

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
   * It takes the already-written `vcf` rather than writing one (I-5). `null` is a no-op — the
   * backstop for a card that shares nothing.
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

/* ── the WhatsApp deep links ────────────────────────────────────────────────────────── */

/**
 * The message a WhatsApp share pre-fills, in the owner's voice. One definition, so the "any chat"
 * link, the one aimed at a typed number and the platform share sheet cannot drift apart.
 */
export function cardShareMessage(cardName: string, url: string): string {
  return `Here's my ${cardName} card. It always shows my latest details: ${url}`;
}

/**
 * WhatsApp's own deep link, aimed at one number, with the message already written.
 *
 * ⚠ Built on `whatsappHref` from `@/lib/format` rather than re-deriving the host and the digit
 * stripping: that function is §6.9's definition of how a phone number becomes a `wa.me` URL.
 *
 * `encodeURIComponent` is not decorative: a card named `R&D` or `#2` would otherwise end the
 * query string at that character and send a truncated message.
 */
export function whatsappShareHref(phoneE164: string, cardName: string, url: string): string {
  return `${whatsappHref(phoneE164)}?text=${encodeURIComponent(cardShareMessage(cardName, url))}`;
}

/**
 * The same message with **no** number: `wa.me/?text=` opens WhatsApp's own chat picker, so the
 * owner chooses who gets it — any chat, a group, themselves.
 */
export function whatsappAnyChatHref(cardName: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(cardShareMessage(cardName, url))}`;
}
