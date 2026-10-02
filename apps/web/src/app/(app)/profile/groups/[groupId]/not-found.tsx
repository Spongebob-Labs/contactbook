"use client";

import { NotFoundPanel } from "@/components/data/not-found-panel";

/**
 * `/profile/groups/[groupId]` with an id that resolves to nothing — spec §6.1 R-17,
 * §11 E-36's rule, §6.10.
 *
 * **A dedicated panel, never a raw 404 and never an empty state.** The distinction is the
 * one §8D.3 spells out: an unknown group id is not "this group has no fields", and it is
 * not an error worth retrying — retrying a wrong URL fails again. `NotFoundPanel` has no
 * `onRetry` prop at all, which is T10's way of making that unavailable rather than merely
 * discouraged. The one affordance is a way back to somewhere that exists.
 *
 * The status code is deliberately absent from the copy. "404" tells a person nothing;
 * "We couldn't find that field group" tells them everything. The response itself is a soft
 * 404 — 200 plus Next's injected `<meta name="robots" content="noindex">` — because
 * `loading.tsx` starts the response streaming before `page.tsx` reaches its guard. That
 * trade is measured and ruled on in the run log (D11) for R-18 and applies verbatim here.
 *
 * ── WHY `"use client"` ON A FILE THAT LOOKS LIKE A SERVER COMPONENT ──────────────────
 * T10's `not-found-panel.tsx` carries no directive of its own but calls
 * `buttonClassName()`, which lives in a `"use client"` module. Imported by a *server*
 * module the panel compiles into the server graph, so that call hits a client reference
 * and React throws before a byte is rendered. T14 hit this on the root `not-found.tsx`
 * and T18 verified the workaround on `/c/[slug]`; this file follows both. The real fix is
 * one word at the top of `not-found-panel.tsx`, which belongs to T10 — not to this track.
 */
export default function FieldGroupNotFound() {
  return (
    <div className="py-12">
      <NotFoundPanel
        headingLevel={1}
        overline="Not found"
        title="We couldn't find that field group"
        detail="This link doesn't match any of your groups."
        backHref="/profile"
        backLabel="Back to profile"
      />
    </div>
  );
}
