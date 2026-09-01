"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data";

/**
 * The `(app)` error boundary (spec §6.10, §13.1). It replaces the route's content while
 * the shell — rail, bottom bar, `<main>` — keeps rendering around it, so a failure never
 * costs the user their navigation.
 *
 * ── The panel is imported, never rewritten ───────────────────────────────────────────
 * `ErrorPanel` is T10's, and `boundaryErrorPanelProps` is the one sanctioned adapter from
 * a thrown object to panel copy. It keeps the `digest` and discards `message`, `stack`,
 * `cause` and `name`. That is not tidiness: a thrown `Error` in this application can
 * carry a user's email or a field value in its message, and §13.1 forbids PII on any
 * surface. **`error.message` is never rendered.** `[data-error-digest]` — a muted,
 * selectable caption — is the only thing the user sees, and it is enough to locate the
 * failure from a screenshot.
 *
 * The one place `message` appears is the console line, and only under
 * `NODE_ENV !== 'production'`. That line goes to the browser console, not to the DOM and
 * not to any service — this run has no telemetry at all (§13.3) — so in `next dev` it is
 * read by exactly one person, on the machine the fixtures are already open on.
 * `logBoundaryError` owns that judgement and the `[contactbook] {}` that provoked it.
 *
 * ── `retry` vs `reset` ───────────────────────────────────────────────────────────────
 * Next 16.3 stabilised `retry()`, which re-fetches *and* re-renders the segment; `reset()`
 * only clears the boundary and re-renders what it already has. The runtime passes both.
 * "Try again" means "fetch it again", so `retry` is preferred and `reset` is the fallback
 * — both are optional here so the panel degrades to a link-only surface rather than
 * throwing if a future runtime drops one.
 */

export interface AppGroupErrorProps {
  error: Error & { digest?: string };
  /** Next 16.3+. Re-fetches and re-renders the segment. Preferred. */
  retry?: () => void;
  /** The older name, still passed by the runtime. Used when `retry` is absent. */
  reset?: () => void;
}

export default function AppGroupError({ error, retry, reset }: AppGroupErrorProps) {
  const route = usePathname();

  useEffect(() => {
    // §13.1's shape. Nothing here reaches the DOM, and nothing a throw authored survives
    // a production build — `logBoundaryError` draws that line once, for all thirteen.
    logBoundaryError(error, { scope: "app", route });
  }, [error, route]);

  const onRetry = retry ?? reset;

  return (
    <div className="py-12">
      <ErrorPanel
        {...boundaryErrorPanelProps(error)}
        headingLevel={1}
        onRetry={onRetry}
        homeHref="/dashboard"
        homeLabel="Go to dashboard"
      />
    </div>
  );
}
