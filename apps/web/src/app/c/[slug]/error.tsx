"use client";

import { useEffect } from "react";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data/error-panel";

/**
 * The `/c/[slug]` error boundary — the fifth of §13.1's five levels, and the only one that
 * can be reached by someone with no session, no history in this product and no idea what
 * "Contact Book" is. They scanned a QR code.
 *
 * That single fact decides everything here: the way out is **"Go home"**, never "Go to
 * dashboard"; the copy explains rather than reports; and nothing on this surface implies
 * the reader did anything wrong.
 *
 * ── The rule this file exists to keep ────────────────────────────────────────────────
 * **The thrown message is never rendered and never logged.** An `Error` raised anywhere in
 * this product can carry a field value — an email, a phone number, an account name — and
 * §7.3 / §13.1 forbid PII in anything a user or a log ever sees. This screen is the one
 * where that is most acute, because the values on a public card belong to someone who is
 * not the reader. `boundaryErrorPanelProps()` keeps the `digest` and drops `message`,
 * `stack`, `cause` and `name`, so `[data-error-digest]` is the only trace that survives —
 * muted and selectable, so a screenshot is enough to locate the failure.
 *
 * The structured `console.error` follows §13.1's shape with `message` omitted for the same
 * reason: §13.1 prints the key in its sample and forbids PII in the same sentence, and the
 * rule outranks the sample. T08, T09 and T14 all made the same call.
 */

type BoundaryProps = {
  error: Error & { digest?: string };
  /**
   * Next 16 hands boundaries **both** callbacks: `retry()` refreshes the router and then
   * clears the boundary, `reset()` only clears it. `retry` is what the installed docs
   * document (`node_modules/next/dist/docs/…/file-conventions/error.md`) and the older
   * `reset` is still passed, so both are accepted and `retry` wins. Neither is assumed
   * present — `ErrorPanel` drops the button when there is nothing to call.
   */
  reset?: () => void;
  retry?: () => void;
};

export default function PublicCardError({ error, reset, retry }: BoundaryProps) {
  useEffect(() => {
    logBoundaryError(error, {
      scope: "public-card",
      route: "/c/[slug]",
    });
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-full flex-1 items-center justify-center bg-canvas px-4 py-20"
    >
      <ErrorPanel
        {...boundaryErrorPanelProps(error)}
        headingLevel={1}
        onRetry={retry ?? reset}
        homeHref="/"
        homeLabel="Go home"
      />
    </main>
  );
}
