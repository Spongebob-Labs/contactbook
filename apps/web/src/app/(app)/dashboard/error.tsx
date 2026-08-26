"use client";

import { useEffect } from "react";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data";

/**
 * The `/dashboard` route boundary (spec §6.1 R-09, §6.10, §13.1).
 *
 * It sits **below** `(app)/error.tsx`, so a throw in the dashboard is caught here and the
 * rail, the bottom bar and the content region around it all keep rendering — a failure on this
 * screen never costs the reader their navigation.
 *
 * ── What is never rendered, and why that is not a style note ─────────────────────────
 * The copy comes from `boundaryErrorPanelProps()`, T10's one sanctioned adapter: it keeps
 * `digest` and discards `message`, `stack`, `cause` and `name`. A throw on this route can
 * carry a profile field value or an address out of the featured card, and §13.1 forbids PII
 * on any surface a user or a log ever sees. `[data-error-digest]` — a muted, selectable
 * caption — is the only detail the reader gets, and it is enough to locate the failure from
 * a screenshot.
 *
 * The structured log goes through `logBoundaryError` — `scope` / `route` / `name` / `digest`,
 * and nothing a thrown object supplied. §13.1 fixes the scope
 * vocabulary at `app | auth | marketing | public-card`; the `route` field is what tells
 * this boundary apart from the group's.
 *
 * ── `retry` vs `reset` ──────────────────────────────────────────────────────────────
 * Next 16.3 stabilised `retry()`, which re-fetches *and* re-renders the segment; `reset()`
 * only clears the boundary. The runtime passes both, "Try again" means "fetch it again",
 * so `retry` is preferred and `reset` is the fallback. Both are optional so the panel
 * degrades to a link-only surface rather than throwing if a runtime drops one.
 *
 * "Go to your cards", not "Go to dashboard": the dashboard is the page that just failed.
 */

export interface DashboardErrorProps {
  error: Error & { digest?: string };
  /** Next 16.3+. Re-fetches and re-renders the segment. Preferred. */
  retry?: () => void;
  /** The older name, still passed by the runtime. Used when `retry` is absent. */
  reset?: () => void;
}

export default function DashboardError({ error, retry, reset }: DashboardErrorProps) {
  useEffect(() => {
    logBoundaryError(error, {
      scope: "app",
      route: "/dashboard",
    });
  }, [error]);

  return (
    <div className="py-12">
      <ErrorPanel
        {...boundaryErrorPanelProps(error)}
        headingLevel={1}
        onRetry={retry ?? reset}
        homeHref="/cards"
        homeLabel="Go to your cards"
      />
    </div>
  );
}
