"use client";

import { NotFoundPanel } from "@/components/data/not-found-panel";

/**
 * `/c/[slug]` with a slug that resolves to nothing — spec §11 E-37, §8D.5, §6.10.
 *
 * **"This card doesn't exist or was removed." Never a raw 404.** The reader almost
 * certainly scanned a printed QR code: the card was deleted, the slug was mistyped into a
 * badge, or the code came off a business card that has since been reissued. A status code
 * tells that person nothing they can act on, so no code appears in the copy and no stack
 * trace appears anywhere. The response carries Next's injected
 * `<meta name="robots" content="noindex">` — the crawler's half of the answer, and the one
 * that keeps a dead card out of search results. Why it is a `noindex` rather than a `404`
 * status is measured and explained on the `notFound()` call in `page.tsx`: §6.1 R-18's
 * `loading.tsx` starts the response streaming before the guard is reached.
 *
 * There is deliberately no "Try again": retrying a URL that does not resolve fails again.
 * `NotFoundPanel` has no `onRetry` prop at all, which is T10's way of making that
 * unavailable rather than merely discouraged. The one affordance is a way somewhere real.
 *
 * ── WHY `"use client"` ON A FILE THAT LOOKS LIKE A SERVER COMPONENT ──────────────────
 * T10's `not-found-panel.tsx` carries no directive of its own but calls `buttonClassName()`,
 * which lives in a `"use client"` module. Imported by a *server* module the panel compiles
 * into the server graph, so that call hits a client reference and React throws before a
 * byte is rendered:
 *
 *     Error: Attempted to call buttonClassName() from the server but buttonClassName
 *       is on the client.   at NotFoundPanel (src/components/data/not-found-panel.tsx:60)
 *
 * T14 hit this on the root `not-found.tsx` and verified the workaround; this file follows
 * it. Pulling the panel into the client graph is the only fix available from inside this
 * track — `not-found-panel.tsx` belongs to T10, and a one-word `"use client"` at the top of
 * *that* file would let every `not-found.tsx` in the product go back to being a server
 * component. Already logged as a fix-round item; not fixed here, because it is not mine.
 */
export default function PublicCardNotFound() {
  return (
    <main
      id="main"
      className="flex min-h-full flex-1 items-center justify-center bg-canvas px-4 py-20"
    >
      <NotFoundPanel
        headingLevel={1}
        overline="Not found"
        title="This card doesn't exist or was removed"
        detail="The link may be wrong, or whoever shared it may have taken the card down. Ask them for a new one."
        backHref="/"
        backLabel="Go home"
      />
    </main>
  );
}
