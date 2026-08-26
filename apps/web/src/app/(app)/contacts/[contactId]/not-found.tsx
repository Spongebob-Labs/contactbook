"use client";

import { NotFoundPanel } from "@/components/data/not-found-panel";

/**
 * `/contacts/[contactId]` with an id that resolves to nothing (spec §8D.3, §6.10, and the
 * §11 E-36 shape one route over).
 *
 * **A dedicated panel, never a raw 404 and never an empty state.** "You have no contacts" is
 * a different sentence from "that contact is not there", and the reader here has followed a
 * stale link or a mistyped id — a status code tells them nothing they can act on, so no code
 * appears in the copy and no stack trace appears anywhere. Why the response is a `200` with
 * Next's injected `<meta name="robots" content="noindex">` rather than a `404` status is
 * measured and explained on the `notFound()` call in `page.tsx`: §6.1 R-15's `loading.tsx`
 * starts the response streaming before the guard is reached.
 *
 * There is deliberately no "Try again": retrying an id that does not resolve fails again.
 * `NotFoundPanel` has no `onRetry` prop at all, which is T10's way of making that
 * unavailable rather than merely discouraged. The one affordance is a way back to the list.
 *
 * No `<main>` — this renders inside `(app)/layout.tsx`, and `AppShell` owns the single
 * `<main id="main">` (AC-25 `landmark-unique`).
 *
 * ── WHY `"use client"` ON A FILE THAT LOOKS LIKE A SERVER COMPONENT ──────────────────
 * T10's `not-found-panel.tsx` carries no directive of its own but calls `buttonClassName()`,
 * which lives in a `"use client"` module. Imported by a *server* module the panel compiles
 * into the server graph, so that call hits a client reference and React throws before a byte
 * is rendered:
 *
 *     Error: Attempted to call buttonClassName() from the server but buttonClassName
 *       is on the client.   at NotFoundPanel (src/components/data/not-found-panel.tsx:60)
 *
 * T14 hit this on the root `not-found.tsx` and T18 verified the workaround on `/c/[slug]`;
 * this file follows it. A one-word `"use client"` at the top of `not-found-panel.tsx` would
 * let every `not-found.tsx` in the product go back to being a server component — but that
 * file belongs to T10, so it is logged rather than edited from here.
 */
export default function ContactNotFound() {
  return (
    <div className="py-12">
      <NotFoundPanel
        headingLevel={1}
        overline="Not found"
        title="We couldn't find that contact"
        detail="It may have been removed, or the link may be wrong. Everyone you have saved is on your contacts list."
        backHref="/contacts"
        backLabel="Go to contacts"
      />
    </div>
  );
}
