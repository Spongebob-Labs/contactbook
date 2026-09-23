"use client";

import { useSearchParams } from "next/navigation";
import { useLayoutEffect } from "react";

/**
 * `?skin=atelier` — a REVIEW AFFORDANCE, not a product feature.
 *
 * The client is choosing between two palettes on one layout (`marketing-skins.css`).
 * Rather than build the page twice, or branch a deploy, this lets both be looked at on one
 * URL so the comparison is a query param instead of a meeting.
 *
 * ── WHY THIS IS A CLIENT COMPONENT AND NOT A LAYOUT PROP ────────────────────────────
 *
 * Layouts do not receive `searchParams` — that is a documented Next caveat, not an
 * oversight (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * layout.md`, "Query params"). A layout is not re-rendered on navigation, so a query
 * param it read once could go stale; the documented alternatives are the *page*'s
 * `searchParams` prop or `useSearchParams` in a client component.
 *
 * The `[data-mk-root]` wrapper belongs to the layout, because `/waitlist`, `/contact`
 * and `/templates` all need the skin too — moving it into the page to get `searchParams`
 * would give the homepage a skin and the other three routes none. So the wrapper stays in
 * the layout, ships `data-mk-skin="verdant"` in the server HTML, and this component
 * upgrades it.
 *
 * ── WHAT THIS COSTS, STATED PLAINLY ─────────────────────────────────────────────────
 *
 * On `?skin=atelier` there is one frame of verdant before the attribute flips. That is
 * the honest cost of reading a query param below the layout, and it is acceptable
 * precisely because this is a review URL that a reviewer loads deliberately.
 *
 * **The default path pays nothing.** With no query param the server HTML is already
 * correct, this effect finds nothing to change, and the page renders verdant with no
 * JavaScript involved in its appearance at all. An inline blocking script would remove
 * the flash on the review URL at the cost of a render-blocking script on every visit to
 * the real one — the wrong trade for an affordance only we use.
 *
 * ⚠ If atelier is ever chosen as the default, DO NOT reach for that inline script. The
 * fix is to change which skin the layout stamps, which is a one-word edit, and this
 * component keeps working as the toggle in the other direction.
 */

/** The skins `marketing-skins.css` defines. An unknown value is ignored, not applied. */
const SKINS = new Set(["verdant", "atelier"]);

export function SkinSwitch() {
  /* NOTE - `useSearchParams()` is typed as nullable and really does return null when there is
     no router context above it — a unit test rendering the layout in isolation is the case
     that found this, but a static render can hit it too. An unguarded `.get()` here threw and
     took the entire chrome down with it, which is a very poor trade for a review affordance:
     the nav, the footer and the page would all fail to render so that a query param could be
     read. The optional chain below means the worst case is that the toggle does nothing. */
  const searchParams = useSearchParams();
  const requested = searchParams?.get("skin") ?? null;

  useLayoutEffect(() => {
    if (requested === null || !SKINS.has(requested)) return;

    /* Scoped to the marketing root rather than `documentElement`, because that is the
       element `marketing-skins.css` selects and the one the app's own screens must never
       inherit from. */
    const root = document.querySelector("[data-mk-root]");
    if (root === null) return;

    const previous = root.getAttribute("data-mk-skin");
    root.setAttribute("data-mk-skin", requested);

    /* Restore on unmount. Without this, navigating from `/?skin=atelier` to a route that
       renders a fresh wrapper leaves the old attribute behind on a stale node in dev, and
       the two disagree about which skin is live. */
    return () => {
      if (previous === null) root.removeAttribute("data-mk-skin");
      else root.setAttribute("data-mk-skin", previous);
    };
  }, [requested]);

  return null;
}
