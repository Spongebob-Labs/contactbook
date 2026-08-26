"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data";

/**
 * The `(auth)` group boundary — one of the four §13.1 levels, rendering the §6.10 panel.
 *
 * It sits **inside** `(auth)/layout.tsx`, so the shell, the progress indicator and Back all
 * survive the failure: someone whose step throws keeps their way back to the step that
 * worked, and the answers they already gave are still in the provider above.
 *
 * ── `error.message` is never rendered ────────────────────────────────────────────────
 * `boundaryErrorPanelProps()` is the one sanctioned adapter from a thrown object to panel
 * copy: it keeps `digest` and discards `message`, `stack`, `cause` and `name`. That is not
 * tidiness. A throw on these six screens can carry a phone number or an email address in
 * its message, and §7.3 / §13.1 forbid PII on any surface, so `[data-error-digest]` — muted
 * and selectable — is the only trace that reaches the DOM. T30 greps for violations.
 *
 * The structured line goes through `logBoundaryError`, which carries `scope` / `route` /
 * `name` / `digest` and omits `message` for the same reason: §13.1 prints the key in its
 * sample and forbids PII in the same sentence, and the rule outranks the sample. One helper,
 * thirteen boundaries — see the argument recorded on it.
 *
 * ── `retry` vs `reset` ───────────────────────────────────────────────────────────────
 * Next 16.3 stabilised `retry()`, which re-fetches *and* re-renders the segment; `reset()`
 * only clears the boundary. The runtime passes both and the installed docs
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`)
 * document `retry`, so `retry` is preferred and `reset` is the fallback. Both are optional:
 * the panel degrades to a link-only surface rather than throwing if a runtime drops one.
 * Matches T09 and T14.
 *
 * "Go home", never "Go to dashboard" — nobody on these screens is signed in (§7.1).
 */

export interface AuthGroupErrorProps {
  error: Error & { digest?: string };
  /** Next 16.3+. Re-fetches and re-renders the segment. Preferred. */
  retry?: () => void;
  /** The older name, still passed by the runtime. Used when `retry` is absent. */
  reset?: () => void;
}

export default function AuthGroupError({ error, retry, reset }: AuthGroupErrorProps) {
  const route = usePathname();

  useEffect(() => {
    logBoundaryError(error, { scope: "auth", route });
  }, [error, route]);

  return (
    <ErrorPanel
      {...boundaryErrorPanelProps(error)}
      headingLevel={1}
      onRetry={retry ?? reset}
      homeHref="/"
      homeLabel="Go home"
    />
  );
}
