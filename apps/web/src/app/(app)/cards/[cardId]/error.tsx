"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ErrorPanel, boundaryErrorPanelProps, logBoundaryError } from "@/components/data";

/**
 * The `/cards/[cardId]` error boundary (spec §6.10, §6.1 R-12, §13.1) — **and the nearest
 * boundary for `/cards/[cardId]/edit`, the card builder.**
 *
 * It replaces this segment's content while the shell — rail, bottom bar, `<main>` — keeps
 * rendering around it, so a failure on one card never costs the user their navigation. The
 * way out is `/cards` rather than `/dashboard`: whoever is reading this arrived from the
 * list, and the list is where the rest of their cards are.
 *
 * ── The two segments, and the defect that came of conflating them ─────────────────────
 * R-13 (`/cards/[cardId]/edit`) has no `error.tsx`: §6.1 marks the column ✓, no track in
 * the plan owns the file, and the arrangement is deliberate — see
 * `ROUTES_WITH_INHERITED_ERROR_BOUNDARY` in `tests/helpers/routes.ts`. Next therefore uses
 * *this* boundary to catch a throw in the builder, and this file used to log
 * `scope: 'card-detail', route: '/cards/[cardId]'` unconditionally. A builder crash was
 * filed against the detail screen and cost a reader half an hour on the wrong file.
 *
 * The route is now read from `usePathname()` and reported as the pattern it matched, so
 * the line names the segment that actually threw. The pattern rather than the live path
 * because §13.1's own sample logs `/cards/[cardId]`, because the pattern is what maps to a
 * directory under `src/app/**` — the thing the reader is about to open — and because the
 * card id in the path adds nothing a developer cannot read off their own URL bar. `scope`
 * goes back to `app`: §13.1 fixes that vocabulary at four values and `card-detail` was
 * never one of them, which is precisely why nothing caught the mislabelling sooner.
 *
 * ── The rule this file exists to keep ─────────────────────────────────────────────────
 * **The thrown message is never rendered.** An `Error` raised anywhere in this application
 * can carry a field value — an email, a phone number, an account number — and §7.3 / §13.1
 * forbid PII on any surface a user or a log ever sees. `boundaryErrorPanelProps()` keeps the
 * `digest` and drops `message`, `stack`, `cause` and `name`, so `[data-error-digest]` is the
 * only trace that survives: muted and selectable, so a screenshot is enough to locate the
 * failure. No stack traces, no raw messages, no error codes as headlines.
 *
 * ── `retry` vs `reset` ────────────────────────────────────────────────────────────────
 * Next 16.3.1 passes boundaries **both**: `retry()` refreshes the router and then clears the
 * boundary, `reset()` only clears it. "Try again" means "fetch it again", so `retry` wins and
 * `reset` is the fallback. Neither is assumed present — `ErrorPanel` drops the button when
 * there is nothing to call. T09, T14, T16 and T18 all landed on this shape.
 *
 * ⚠ **No `<main>`.** `AppShell` owns the one `<main id="main">` for the `(app)` group.
 */

export interface CardDetailErrorProps {
  error: Error & { digest?: string };
  /** Next 16.3+. Re-fetches and re-renders the segment. Preferred. */
  retry?: () => void;
  /** The older name, still passed by the runtime. Used when `retry` is absent. */
  reset?: () => void;
}

export default function CardDetailError({ error, retry, reset }: CardDetailErrorProps) {
  const pathname = usePathname();
  // `/cards/card_kestrel/edit` → the builder; anything else under `[cardId]` is the detail
  // screen. There is no third child segment (`find src/app/(app)/cards -type d`), so the
  // two-way split is exhaustive rather than a default with a gap in it.
  const route = pathname.endsWith("/edit") ? "/cards/[cardId]/edit" : "/cards/[cardId]";

  useEffect(() => {
    // §13.1's shape, and the production/development split, both live in `logBoundaryError`.
    logBoundaryError(error, { scope: "app", route });
  }, [error, route]);

  return (
    <div className="py-12">
      <ErrorPanel
        {...boundaryErrorPanelProps(error)}
        headingLevel={1}
        onRetry={retry ?? reset}
        homeHref="/cards"
        homeLabel="Go to cards"
      />
    </div>
  );
}
