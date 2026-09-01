"use client";

import { useEffect } from "react";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data/error-panel";

/**
 * The `/templates` route boundary (spec §6.1 R-02, §13.1).
 *
 * It sits below `(marketing)/error.tsx`, so a throw in the gallery is caught here and the
 * pill bar, the footer and the rest of the group survive it. Same discipline as every other
 * boundary in the build, and both halves of it are deliberate:
 *
 * · **The copy comes from `boundaryErrorPanelProps()`**, which keeps the digest and
 *   discards `message`, `stack`, `cause` and `name`. A throw on this route can carry a
 *   field value out of the showcase card, and nothing a thrown object holds is safe to put
 *   in the DOM or the console (§13.1). The structured log is `scope` / `route` / `digest`
 *   and no more.
 * · **`scope: 'marketing'`**, not an invented one: §13.1 fixes the vocabulary at
 *   `app | auth | marketing | public-card`, and `/templates` lives in `(marketing)`. The
 *   `route` field is what distinguishes this boundary from the group's.
 *
 * "Go home", never "Go to dashboard" — nobody reading `/templates` is signed in.
 */

type BoundaryProps = {
  error: Error & { digest?: string };
  /** Next 16 passes both; `retry()` refreshes the router, `reset()` only clears state. */
  reset?: () => void;
  retry?: () => void;
};

export default function TemplatesError({ error, reset, retry }: BoundaryProps) {
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
