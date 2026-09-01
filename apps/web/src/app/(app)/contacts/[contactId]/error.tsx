"use client";

import { useEffect } from "react";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data/error-panel";

/**
 * The `/contacts/[contactId]` error boundary (spec §6.1 R-15, §6.10, §13.1).
 *
 * It replaces this segment's content while the shell keeps rendering around it, so a failure
 * never costs the reader their navigation.
 *
 * ── The rule this file exists to keep ────────────────────────────────────────────────
 * **`error.message` is never rendered.** This screen holds another person's phone number,
 * email and — for `contact_vikram` — a bank account label, any of which a thrown `Error` can
 * carry in its message. §7.3 and §13.1 forbid PII on every surface a user or a log ever
 * sees, and the values here belong to someone who is not the reader.
 * `boundaryErrorPanelProps()` is the one sanctioned adapter: it keeps the `digest` and drops
 * `message`, `stack`, `cause` and `name`. `[data-error-digest]` — muted and selectable — is
 * the only trace that survives, and it is enough to locate the failure from a screenshot.
 * The structured `console.error` omits `message` for the same reason (T14, T16, T18).
 *
 * ── `retry` vs `reset` ───────────────────────────────────────────────────────────────
 * Next 16.3 stabilised `retry()`, which re-fetches *and* re-renders the segment; `reset()`
 * only clears the boundary. The runtime passes both, "Try again" means "fetch it again", so
 * `retry` wins and `reset` is the fallback. Neither is assumed present.
 */

export interface ContactDetailErrorProps {
  error: Error & { digest?: string };
  /** Next 16.3+. Re-fetches and re-renders the segment. Preferred. */
  retry?: () => void;
  /** The older name, still passed by the runtime. Used when `retry` is absent. */
  reset?: () => void;
}

export default function ContactDetailError({ error, retry, reset }: ContactDetailErrorProps) {
  useEffect(() => {
    logBoundaryError(error, {
      scope: "app",
      route: "/contacts/[contactId]",
    });
  }, [error]);

  return (
    <div className="py-12">
      <ErrorPanel
        {...boundaryErrorPanelProps(error)}
        title="We couldn't load this contact"
        headingLevel={1}
        onRetry={retry ?? reset}
        homeHref="/contacts"
        homeLabel="Go to contacts"
      />
    </div>
  );
}
