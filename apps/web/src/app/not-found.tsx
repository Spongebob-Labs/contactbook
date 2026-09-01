"use client";

import { NotFoundPanel } from "@/components/data/not-found-panel";

/**
 * The application's last-resort 404 (route manifest R-19, panel shape §6.10).
 *
 * This file catches two different things and has to serve both: an explicit `notFound()`
 * thrown by a segment with no `not-found.tsx` of its own, and — more importantly — every
 * unmatched URL in the product. A stranger who mistypes the slug on a QR code lands here
 * with **no session, no fixture read and no assumptions available**, which is why it
 * renders no chrome at all: no sidebar, no pill bar, nothing that would need data or a
 * route group to exist.
 *
 * The copy carries no "404" and no status code. §6.10 is explicit that a code is never a
 * headline — "404" tells a person nothing they can act on, and the second sentence tells
 * a scanner the one thing that actually helps them.
 *
 * There is deliberately no "Try again" here: retrying a wrong URL fails again.
 * `NotFoundPanel` has no `onRetry` prop at all, which is T10's way of making that
 * unavailable rather than merely discouraged.
 *
 * ── WHY `"use client"` ON A FILE THE PLAN SAYS MAY BE A SERVER COMPONENT ─────────────
 * T10's `not-found-panel.tsx` carries no directive of its own but calls
 * `buttonClassName()`, which lives in a `"use client"` module. Imported by a *server*
 * module the panel compiles into the server graph, so that call hits a client reference
 * and React throws before a byte is rendered — verified, not assumed:
 *
 *     Error: Attempted to call buttonClassName() from the server but buttonClassName
 *       is on the client.   at NotFoundPanel (src/components/data/not-found-panel.tsx:60)
 *     GET /definitely-not-a-route 500
 *
 * Pulling the panel into the client graph is the only fix available from inside this
 * track — `not-found-panel.tsx` belongs to T10 and a one-word `"use client"` at the top
 * of *that* file would let every `not-found.tsx` in the product go back to being a server
 * component. Flagged in the run-log for T18/T22/T24/T25, who each own one.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20">
      <NotFoundPanel
        headingLevel={1}
        overline="Not found"
        title="We couldn't find that page"
        detail="The link may be wrong, or the page may have moved. If you scanned a QR code, ask whoever shared it for a new one."
        backHref="/"
        backLabel="Go home"
      />
    </div>
  );
}
