"use client";

import { Check, Copy, ExternalLink, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useToast } from "@/components/overlay";
import { Button, buttonClassName, type ButtonVariant } from "@/components/primitives/button";
import { CONTROL_HEIGHT } from "@/components/primitives/label";
import { whatsappAnyChatHref } from "@/components/share/share-sheet";
import { cn } from "@/lib/cn";
import { CARD_LINK_PENDING } from "@/lib/format";

/**
 * **The card's link, with Copy right beside it** — `/cards/[cardId]`, block (c).
 *
 * Client review, 2026-09-28: *"Prominent copy button next to the URL."* The URL used to be a
 * plain underlined link in a metadata line, with "Copy link" as a small text-link inside a
 * dialog. Now it is a read-only field and a full-height Copy button joined to it, and the button
 * says "Copied" for a moment after it worked, so the owner does not have to paste to find out.
 *
 * ## Which link this is
 * `card.publicUrl` — the card's own one-to-many link, the same string the QR encodes (§8A.6).
 * **Not** a per-recipient `ShareLink`: those are minted by "Send to a phone number" and shown in
 * its result. Printing, pasting into a group, or a social bio all want this one, because
 * revoking any single recipient never breaks it.
 *
 * ## The other two ways out
 * · **Share on WhatsApp** — `wa.me/?text=`, no number, so WhatsApp opens its own chat picker.
 * · **Share via…** — the platform share sheet, only where the browser has one.
 */

/** How long "Copied" stays on the button before it reads "Copy" again. */
export const COPIED_FOR_MS = 2000;

/**
 * Whether this browser has a platform share sheet.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: the server has no `navigator`, so
 * reading it during render is a hydration mismatch, and writing it from an effect is a
 * render-then-correct that `react-hooks/set-state-in-effect` rejects. `getServerSnapshot`
 * declares the disagreement instead of papering over it. The capability never changes within a
 * page's life, so `subscribe` registers nothing — but it must be a stable module-scope reference.
 */
export function useCanNativeShare(): boolean {
  return useSyncExternalStore(subscribeToNothing, hasNativeShare, () => false);
}

const subscribeToNothing = () => () => {};
const hasNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

export interface CopyButtonProps {
  /** The exact string written to the clipboard. */
  value: string;
  variant?: ButtonVariant;
  className?: string;
  /** Called when the clipboard refused, so the caller can select the text for a manual copy. */
  onCopyFailed?: () => void;
}

/**
 * Copy, with a visible and an announced "Copied" state.
 *
 * The confirmation is on the button itself rather than in a toast: the eye is already on the
 * button, and a toast arriving at the other edge of the screen is easy to miss on a phone. The
 * polite live region carries the same fact to a screen reader, because a label change on a
 * focused button is not reliably announced.
 */
export function CopyButton({ value, variant = "primary", className, onCopyFailed }: CopyButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function copy() {
    const done = () => {
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setCopied(false);
      }, COPIED_FOR_MS);
    };
    const failed = () => {
      onCopyFailed?.();
      toast({
        title: "Couldn't copy the link",
        description: "Select it and copy it by hand.",
        tone: "danger",
      });
    };

    if (typeof navigator === "undefined" || navigator.clipboard === undefined) {
      failed();
      return;
    }
    void navigator.clipboard.writeText(value).then(done, failed);
  }

  return (
    <>
      <Button
        variant={variant}
        data-copy-link=""
        data-copied={copied ? "true" : undefined}
        onClick={copy}
        className={cn("shrink-0", className)}
      >
        {copied ? (
          <Check aria-hidden="true" size={16} strokeWidth={2} />
        ) : (
          <Copy aria-hidden="true" size={16} strokeWidth={1.75} />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </>
  );
}

export interface LinkFieldProps {
  url: string;
  /** Accessible name of the read-only field. */
  label: string;
  /** Button style for Copy — the page's card link is primary, a result's link is secondary. */
  copyVariant?: ButtonVariant;
  className?: string;
}

/**
 * A read-only URL field with Copy joined to its right edge.
 *
 * An `<input readOnly>` rather than a paragraph, for one reason: a focused input selects its
 * whole value in one tap, so when the clipboard is refused (an embedded browser, an old WebView)
 * the manual fallback is "long-press, Copy" instead of dragging selection handles along a URL.
 */
export function LinkField({ url, label, copyVariant = "primary", className }: LinkFieldProps) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div data-link-field="" className={cn("flex min-w-0 items-stretch gap-2", className)}>
      <input
        ref={input}
        readOnly
        value={url}
        aria-label={label}
        data-link-field-value=""
        onFocus={(event) => event.currentTarget.select()}
        className={cn(
          CONTROL_HEIGHT,
          "text-machine min-w-0 flex-1 truncate rounded-sm border border-line-control bg-surface px-3 text-sm text-ink",
        )}
      />
      <CopyButton
        value={url}
        variant={copyVariant}
        onCopyFailed={() => {
          input.current?.focus();
          input.current?.select();
        }}
      />
    </div>
  );
}

export interface CardLinkBlockProps {
  /** `resolved.qrPayload` — the card's own public URL, or `null` for an unsaved card. */
  url: string | null;
  cardName: string;
}

export function CardLinkBlock({ url, cardName }: CardLinkBlockProps) {
  const canNativeShare = useCanNativeShare();

  return (
    <section
      data-card-link=""
      aria-labelledby="card-link-heading"
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="card-link-heading" className="text-overline uppercase text-ink-3">
          Card link
        </h2>
        {url === null ? null : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-card-link-open=""
            className={buttonClassName({ variant: "text-link", className: "text-sm" })}
          >
            Open card
            <ExternalLink aria-hidden="true" size={14} strokeWidth={1.75} />
          </a>
        )}
      </div>

      {url === null ? (
        /* No server row yet, so no token and no URL. Stated, not rendered as a dead field. */
        <p data-card-link-pending="" className="text-sm text-ink-3">
          {CARD_LINK_PENDING}
        </p>
      ) : (
        <>
          <LinkField url={url} label="Card link" />

          <div className="flex flex-wrap gap-2">
            <a
              href={whatsappAnyChatHref(cardName, url)}
              target="_blank"
              rel="noopener noreferrer"
              data-share-whatsapp-any=""
              className={buttonClassName({ variant: "secondary" })}
            >
              <MessageCircle aria-hidden="true" size={16} strokeWidth={1.75} />
              Share on WhatsApp
            </a>

            {canNativeShare ? (
              <Button
                variant="secondary"
                data-share-native=""
                onClick={() => {
                  /* A cancelled share sheet rejects with `AbortError` — a person changing their
                     mind, not a failure, so it is swallowed rather than reported. */
                  void navigator.share?.({ title: cardName, url }).catch(() => {});
                }}
              >
                <Share2 aria-hidden="true" size={16} strokeWidth={1.75} />
                Share via…
              </Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
