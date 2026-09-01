"use client";

import { useEffect } from "react";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data/error-panel";

/**
 * The `(marketing)` group boundary (spec §13.1) — one of the five levels, and the one
 * that catches `/` (T26) and `/templates` (T19).
 *
 * It renders *inside* `(marketing)/layout.tsx`, so the pill bar and the footer survive
 * the failure and the reader keeps their way out of the page. That is the whole reason
 * the chrome is a separate track: a boundary that also had to redraw the navigation would
 * be a second copy of it.
 *
 * Same discipline as the root boundary: the panel comes from `boundaryErrorPanelProps()`,
 * which keeps the digest and discards the thrown message, so nothing a throw carries can
 * reach the DOM or the console (§13.1). "Go home", never "Go to dashboard" — nobody on
 * these two routes is signed in.
 */

type BoundaryProps = {
  error: Error & { digest?: string };
  /** Next 16 passes both; `retry()` refreshes the router, `reset()` only clears state. */
  reset?: () => void;
  retry?: () => void;
};

export default function MarketingError({ error, reset, retry }: BoundaryProps) {
  useEffect(() => {
    logBoundaryError(error, {
      scope: "marketing",
      route: window.location.pathname,
    });
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[var(--content-max)] px-5 py-20 md:px-8 md:py-24">
      <ErrorPanel
        {...boundaryErrorPanelProps(error)}
        headingLevel={1}
        onRetry={retry ?? reset}
        homeHref="/"
        homeLabel="Go home"
      />
    </div>
  );
}
