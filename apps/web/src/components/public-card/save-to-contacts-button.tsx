"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { VCARD_MIME_TYPE, buildVcf, canBuildVcf, vcfFileName } from "@/card/build-vcf";
import type { ResolvedCard } from "@/types/domain";

/**
 * The primary action of `/c/[slug]` — "Save to contacts" (spec §6.9, §11 E-02, AC-36).
 *
 * ## Why this file holds behaviour and not a button
 * `<ShareFace>` paints the control inside the card skeleton — the action row is part of
 * §8B.1's invariant anatomy and AC-20 counts exactly two controls per `full` card, so a
 * button rendered by this page would be a third. What the page owns is what happens when
 * that control is pressed, which it hands to the renderer through `onSaveToContacts` and
 * `savePending`.
 *
 * ## The one rule this file exists to keep: the card that shares nothing has no button
 * `buildVcf` **throws `EmptyCardError`** on a zero-field card, deliberately, because the old
 * build's alternative was a **73-byte** `.vcf` carrying `FN` and `N` and nothing else — a
 * file that looked like a successful save and gave the scanner no way to contact anyone
 * (§11.6). E-02 closes that path by not rendering the control at all, and the gate is
 * `canBuildVcf(resolved)` — **never** an inline field count, because a second definition of
 * "this card shares nothing" is how the preview and the payload start disagreeing again.
 *
 * The guard below is therefore a **backstop, not the mechanism**. Reaching it would already
 * mean the button was rendered on a card that has nothing to write.
 *
 * ## §6.9, step by step
 * `buildVcf(r)` → `Blob([…], { type: 'text/vcard;charset=utf-8' })` → object URL → an anchor
 * carrying `download="{fullName}.vcf"` → click → **revoke after 30 s**. The delay is not
 * superstition: revoking while the browser is still reading the blob cancels the download,
 * and a URL never revoked pins the whole card in memory for the life of the tab.
 *
 * ## It takes the resolved card, and never re-derives it
 * The handler is passed the same `ResolvedCard` reference the renderer drew (I-5). Resolving
 * a second time here is precisely the bug §6.4 exists to make impossible — the previewed
 * card and the saved file would be two objects that merely usually agree.
 */

/** §6.9: released well after the browser has taken the file. */
export const REVOKE_AFTER_MS = 30_000;

/**
 * How long a second press is ignored for (§11 E-43's shape, applied to the primary action).
 *
 * The work itself is synchronous, so "in flight" would otherwise be a state no one could
 * observe and a double-tap — the normal way a thumb presses a button on a phone, which is
 * the device this screen is reached from — would hand the browser two identical downloads.
 * The lock is what makes "exactly one file downloads" true, and it is what `savePending`
 * reports so the control can render itself busy.
 */
export const SAVE_LOCK_MS = 600;

export interface SaveToContactsAction {
  /** Passed to `<ShareFace savePending>`; drives `aria-busy` on the primary control. */
  savePending: boolean;
  /** Passed to `<ShareFace onSaveToContacts>`; replaces the renderer's built-in default. */
  onSaveToContacts: (resolved: ResolvedCard) => void;
}

export function useSaveToContacts(): SaveToContactsAction {
  const [savePending, setSavePending] = useState(false);
  const lockTimer = useRef<number | null>(null);
  /** timer id → the object URL it will revoke. Kept so unmount cannot leak either one. */
  const revokes = useRef(new Map<number, string>());

  useEffect(() => {
    const pending = revokes.current;
    return () => {
      if (lockTimer.current !== null) window.clearTimeout(lockTimer.current);
      // The click that created each URL was synchronous and has long since handed the
      // bytes to the browser's download machinery, so releasing them as the view goes
      // away is safe — and leaving them attached to a page that no longer exists is not.
      for (const [timer, url] of pending) {
        window.clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      pending.clear();
    };
  }, []);

  const onSaveToContacts = useCallback((resolved: ResolvedCard) => {
    // The lock, not a boolean read from state: `savePending` is a render-time value and a
    // second press can arrive before React has re-rendered.
    if (lockTimer.current !== null) return;

    // Backstop only — E-02 means this control is not on the page at all for such a card.
    if (!canBuildVcf(resolved)) return;

    const url = URL.createObjectURL(new Blob([buildVcf(resolved)], { type: VCARD_MIME_TYPE }));

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
    }, REVOKE_AFTER_MS);
    revokes.current.set(revoke, url);

    setSavePending(true);
    lockTimer.current = window.setTimeout(() => {
      lockTimer.current = null;
      setSavePending(false);
    }, SAVE_LOCK_MS);
  }, []);

  return { savePending, onSaveToContacts };
}
