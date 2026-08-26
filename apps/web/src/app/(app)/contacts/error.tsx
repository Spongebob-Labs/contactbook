"use client";

import { useEffect } from "react";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data/error-panel";

/**
 * The `/contacts` error boundary (spec §6.1 R-14, §6.10, §13.1).
 *
 * It replaces the route's content while the shell — rail, bottom bar, `<main>` — keeps
 * rendering around it, so a failure here never costs the reader their navigation.
 *
 * ── The rule this file exists to keep ────────────────────────────────────────────────
 * **`error.message` is never rendered.** A thrown `Error` on this screen can carry a saved
 * contact's phone number, email or account label in its message, and those values belong to
 * someone who is not the reader — §7.3 and §13.1 forbid PII on any surface a user or a log
 * ever sees. `boundaryErrorPanelProps()` is the one sanctioned adapter: it keeps the
 * `digest` and discards `message`, `stack`, `cause` and `name`. `[data-error-digest]` —
 * muted and selectable — is the only trace that survives, and it is enough to locate the
 * failure from a screenshot.
 *
 * The structured `console.error` follows §13.1's shape with `message` omitted for the same
 * reason: §13.1 prints the key in its sample and forbids PII in the same sentence, and the
 * rule outranks the sample. T14, T16 and T18 all made the same call.
 *
 * ── `retry` vs `reset` ───────────────────────────────────────────────────────────────
 * Next 16.3 stabilised `retry()`, which re-fetches *and* re-renders the segment; `reset()`
 * only clears the boundary. The runtime passes **both**. "Try again" means "fetch it again",
 * so `retry` is preferred and `reset` is the fallback; neither is assumed present, and
 * `ErrorPanel` drops the button when there is nothing to call.
 */

export interface ContactsErrorProps {
  error: Error & { digest?: string };
  /** Next 16.3+. Re-fetches and re-renders the segment. Preferred. */
  retry?: () => void;
  /** The older name, still passed by the runtime. Used when `retry` is absent. */
  reset?: () => void;
}

export default function ContactsError({ error, retry, reset }: ContactsErrorProps) {
  useEffect(() => {
    logBoundaryError(error, {
      scope: "app",
      route: "/contacts",
    });
  }, [error]);

  return (
    <div className="py-12">
      <ErrorPanel
        {...boundaryErrorPanelProps(error)}
        title="We couldn't load your contacts"
        headingLevel={1}
        onRetry={retry ?? reset}
        homeHref="/dashboard"
        homeLabel="Go to dashboard"
      />
    </div>
  );
}
