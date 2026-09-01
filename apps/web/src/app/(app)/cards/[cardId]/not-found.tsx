"use client";

import { NotFoundPanel } from "@/components/data";

/**
 * `/cards/[cardId]` with an id that resolves to nothing — spec §11 E-36, §8D.3, §6.10.
 *
 * **The dedicated not-found panel. Not an empty state, and not a raw 404.** §8D.3 makes the
 * distinction explicit for this screen and it is worth restating: "you have no cards" is a
 * different sentence from "that card is gone", and offering "Create your first card" to
 * someone who has nine of them is a bug, not a nicety. There is also deliberately no "Try
 * again" — retrying a URL that does not resolve fails again — and `NotFoundPanel` has no
 * `onRetry` prop at all, which is T10's way of making that unavailable rather than merely
 * discouraged.
 *
 * The status code is absent from the copy on purpose: "404" tells a person nothing they can
 * act on. Why the response is a `noindex` rather than a `404` status is measured and
 * explained on the `notFound()` call in `page.tsx` — §6.1 R-12's `loading.tsx` starts the
 * response streaming before the guard is reached.
 *
 * ⚠ **No `<main>`.** `AppShell` owns the one `<main id="main">` for the `(app)` group, and
 * it keeps rendering around this panel: a bad id costs the reader the card, never their
 * navigation.
 *
 * ── WHY `"use client"` ON A FILE THAT LOOKS LIKE A SERVER COMPONENT ───────────────────
 * T10's `not-found-panel.tsx` carries no directive of its own but calls `buttonClassName()`,
 * which lives in a `"use client"` module. Imported by a *server* module the panel compiles
 * into the server graph, so that call hits a client reference and React throws before a byte
 * is rendered:
 *
 *     Error: Attempted to call buttonClassName() from the server but buttonClassName
 *       is on the client.   at NotFoundPanel (src/components/data/not-found-panel.tsx:60)
 *
 * T14 hit this on the root `not-found.tsx` and verified the workaround; T18 followed it and
 * so does this file. Pulling the panel into the client graph is the only fix available from
 * inside this track — `not-found-panel.tsx` belongs to T10, and a one-word `"use client"` at
 * the top of *that* file would let every `not-found.tsx` in the product go back to being a
 * server component. Already logged as a fix-round item; not fixed here, because it is not
 * mine.
 */
export default function CardDetailNotFound() {
  return (
    <div className="py-12">
      <NotFoundPanel
        headingLevel={1}
        overline="Not found"
        title="We couldn't find that card"
        detail="It may have been deleted, or the link may be wrong. Your other cards are all still here."
        backHref="/cards"
        backLabel="Go to cards"
      />
    </div>
  );
}
