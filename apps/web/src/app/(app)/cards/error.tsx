"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data";

/**
 * The `/cards` segment boundary (spec §6.1 R-10, §6.10, §13.1).
 *
 * It sits below `(app)/error.tsx`, so a throw anywhere under `/cards` is caught here and
 * the shell — rail, bottom bar, `<main>` — keeps rendering around it. A failure never costs
 * the reader their navigation.
 *
 * ── The panel is imported, never rewritten ───────────────────────────────────────────
 * `boundaryErrorPanelProps` is the one sanctioned adapter from a thrown object to panel
 * copy: it keeps `digest` and discards `message`, `stack`, `cause` and `name`. That is not
 * tidiness. A throw on this route can carry a field value or an email out of a card, and
 * §13.1 forbids PII on any surface a user or a log ever sees. **`error.message` is never
 * rendered** — `[data-error-digest]`, a muted selectable caption, is the only thing shown,
 * and it is enough to locate the failure from a screenshot.
 *
 * ── `retry` vs `reset` ───────────────────────────────────────────────────────────────
 * Next 16.3 stabilised `retry()`, which re-fetches *and* re-renders the segment; `reset()`
 * only clears the boundary. The runtime passes both. "Try again" means "fetch it again",
 * so `retry` is preferred and `reset` is the fallback — both optional, so the panel
 * degrades to a link-only surface rather than throwing if a runtime drops one.
 *
 * ⚠ **This file also covers `/cards/new`**, which declares no boundary of its own (R-11 in
 * `ROUTES_WITH_INHERITED_ERROR_BOUNDARY`). So the copy stays generic and the home link goes
 * to the dashboard rather than back to a list the reader may not have come from. `route`
 * comes from `usePathname()` for that reason — a hard-coded `/cards` would report the wrong
 * screen for a throw in the create flow, which is the defect `[cardId]/error.tsx` records.
 */

export interface CardsErrorProps {
  error: Error & { digest?: string };
  /** Next 16.3+. Re-fetches and re-renders the segment. Preferred. */
  retry?: () => void;
  /** The older name, still passed by the runtime. Used when `retry` is absent. */
  reset?: () => void;
}

export default function CardsError({ error, retry, reset }: CardsErrorProps) {
  const route = usePathname();

  useEffect(() => {
    // §13.1's shape, via the one helper that decides what a shipped build may print.
    // Browser console only — this run has no telemetry (§13.3).
    logBoundaryError(error, { scope: "app", route });
  }, [error, route]);

  return (
    <div className="py-12">
      <ErrorPanel
        {...boundaryErrorPanelProps(error)}
        headingLevel={1}
        onRetry={retry ?? reset}
        homeHref="/dashboard"
        homeLabel="Go to dashboard"
      />
    </div>
  );
}
