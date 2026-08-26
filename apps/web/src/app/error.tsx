"use client";

import { useEffect } from "react";

import {
  ErrorPanel,
  boundaryErrorPanelProps,
  boundaryScopeForPath,
  logBoundaryError,
} from "@/components/data/error-panel";

/**
 * The root error boundary (spec §13.1 — the outermost of the five levels, §6.10 for the
 * shape it renders).
 *
 * What actually reaches this file is narrower than it looks and worth stating, because it
 * decides the copy: `(app)`, `(auth)`, `(marketing)` and `/c/[slug]` all carry their own
 * boundary, and a boundary never catches the layout it sits beside. So this one handles
 * two things — a route with no group of its own, and a throw inside one of those group
 * *layouts*. Both are public-facing and neither can assume a session, which is why the
 * only navigation offered is "Go home".
 *
 * ── The one rule this file exists to keep ────────────────────────────────────────────
 * **A thrown message is never rendered, and never logged by a build that ships.** An
 * `Error` raised in this product can carry a field value — an email, a phone number, an
 * account name — and §13.1 forbids PII in anything a user or a production log ever sees.
 * `boundaryErrorPanelProps()` keeps the digest and drops `message`, `stack`, `cause` and
 * `name`, so `[data-error-digest]` is the only trace that survives into the DOM. It is
 * muted and selectable precisely so a screenshot from Vansh is enough to find the failure.
 *
 * The console line goes through `logBoundaryError`, which carries `scope` / `route` / `name` /
 * `digest` and **nothing a thrown object supplied**. A `NODE_ENV`-gated `message` was tried and
 * reverted; the argument, and the `[contactbook] {}` that started it, is recorded on the helper
 * in one place rather than thirteen.
 */

type BoundaryProps = {
  error: Error & { digest?: string };
  /**
   * Next 16 hands boundaries **both** callbacks: `retry()` refreshes the router and then
   * clears the boundary, `reset()` only clears it. `retry` is what the installed docs
   * document (`node_modules/next/dist/docs/…/file-conventions/error.md`) and the older
   * `reset` is still passed, so both are accepted here and `retry` wins. Neither is
   * assumed present — `ErrorPanel` simply drops the button when there is nothing to call.
   */
  reset?: () => void;
  retry?: () => void;
};

export default function RootError({ error, reset, retry }: BoundaryProps) {
  useEffect(() => {
    const route = window.location.pathname;

    // "as appropriate" per the plan: this boundary backstops both public surfaces, and the
    // path is the only thing that can tell them apart at the root. The mapping is a pure,
    // table-tested function — see `boundaryScopeForPath`.
    logBoundaryError(error, { scope: boundaryScopeForPath(route), route });
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20">
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
