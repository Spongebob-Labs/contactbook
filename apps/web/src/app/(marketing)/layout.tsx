import { Suspense } from "react";

import { PillNav } from "@/components/marketing/pill-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SkinSwitch } from "@/components/marketing/skin-switch";
import { OverlayStyles } from "@/components/overlay";

/**
 * The `(marketing)` group shell (spec §8D.6) — the chrome `/` (T26) and `/templates`
 * (T19) both mount inside.
 *
 * It owns the nav, the footer and nothing else. That is the point of the split: §3.5 names
 * the marketing page the cut-first surface, and if the page owned its own chrome, cutting
 * it would take the gallery's navigation with it. Nothing in this file imports a section
 * component, so `(marketing)/page.tsx` can be deleted without touching `/templates`.
 *
 * ── `<OverlayStyles />` is load-bearing, not boilerplate ─────────────────────────────
 * T08 ships the `[data-elevation]` rule inside a React 19 hoisted `<style href precedence>`
 * that every overlay component renders. This group renders no overlay, so the rule would
 * never reach the page — and two things depend on it: `PillNav`'s `data-elevation="1"`,
 * which is the whole reason the bar reads as floating, and the menu T05's `<Select>`
 * portals when T19 renders a filter on `/templates`. Mounting it here is the single
 * manual step in that contract, documented in `components/overlay/index.ts`.
 *
 * ── The clearance under the bar belongs to this file ─────────────────────────────────
 * `PillNav` is fixed and therefore out of flow. `<main>` pads itself past it so that
 * neither T19's first row nor T26's hero starts underneath the bar, and so neither page
 * has to know how tall the bar is. **Pages must not add clearance of their own** — they
 * add their own section rhythm below it (§8D.6: `--space-20 / 24 / 32`).
 *
 * ── THIS FILE LOADS NO TYPEFACE, AND THAT IS THE CHANGE ─────────────────────────────
 *
 * It used to import `Fraunces` from `next/font/google` and hang `--font-fraunces` on the
 * wrapper below — a chunky editorial serif, route-scoped so no authenticated screen paid for
 * a display face it never set. The scoping was right. The second face was not.
 *
 * **Space Grotesk is already the product's display face.** `src/app/layout.tsx` loads it for
 * the whole app as `--font-space` and binds it to `.text-h1/2/3`, so a visitor who read a
 * Fraunces headline on `/` and then signed up landed on a Space Grotesk one two screens later.
 * Body copy was already metrically identical either side of that transition (Geist both
 * places); the headline was the one thing that changed voice, at exactly the moment a reader
 * is deciding whether these are the same product. `marketing.css` now points
 * `--mk-font-display` at `--font-space`.
 *
 * So this route now downloads NOTHING of its own — one fewer face than the "one font request,
 * not two" the old comment claimed as a win. The `--mk-*` layer is untouched: marketing still
 * has its own scale, its own tracking (negative now, and retuned per step — a grotesque does
 * not want a serif's letterspacing), its own measures and its own palette layer. A shared face
 * is not a merged system.
 *
 * NOTE: `--mk-font-display` stays declared on `[data-mk-root]` in `marketing.css` rather than
 * moving to `:root`, even though `--font-space` is now on `<html>` and `:root` would resolve.
 * That block documents a real substitution hazard that returns the instant any face is
 * route-scoped again; see the comment there before relocating it.
 */

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    /*
      `data-mk-skin` is stamped HERE, in the server HTML, so the default skin costs no
      JavaScript and cannot flash. THE DEFAULT IS `atelier` — warm off-white + gold — because
      the client rejected `verdant` (the mint-green deck) outright; see `marketing-skins.css`
      for the measured palette. `verdant` is not deleted: it stays reachable at `?skin=verdant`
      for comparison, which is `<SkinSwitch />` below's only job; see that file for why a
      layout cannot read the query param itself.

      NOTE - It must stay on the SAME element as `data-mk-root`. `marketing-skins.css` selects
      `[data-mk-root][data-mk-skin="…"]` as a compound, specifically so it outranks
      `marketing.css`'s single-attribute `[data-mk-root]` declarations without needing
      `!important`. Splitting them across two elements silently reverts every token.
    */
    <div
      data-mk-root=""
      data-mk-skin="atelier"
      className="flex min-h-full flex-1 flex-col bg-mk-paper"
    >
      {/*
        THESIS: a contact book is maintenance, not storage; this page is a stack of the
        product's own passes, and it refuses the flat hairline document the category ships.
        OWN-WORLD: the product's own nine card grounds, worn by the marketing layer rather
        than a second palette invented beside it — a deep sky (--mk-sky-zenith Sapphire to
        --mk-sky-horizon Onyx) over an Emerald meadow (--mk-field-near to --mk-field-far), on
        --mk-paper with --mk-ink (Onyx), Space Grotesk over Geist at negative display
        tracking, four card-ground washes (Clay, Pistachio, Periwinkle, Amber), --mk-amber as
        the only action colour and legal only on a dark ground, radii 8/14/18, passes riding
        --mk-pass-overlap over each other's lip on --mk-pass-shadow. Values live in
        `styles/marketing.css`; naming them here rather than restating hexes keeps one source
        of truth and keeps this file inside the chrome's no-colour-literal lock.
        STORY: their details rot in other people's phones; no app can fix that silently; this
        one sends an update they accept; so make the card.
        FIRST VIEWPORT: full-bleed deep sky over an emerald meadow, white 72px display
        headline clearing 13.37:1 at the worst point of the ramp, amber primary and glass
        secondary, and the product's own pass playing a 15s silent film across the horizon.
        FORM: The Wallet Deck, candidate 6 of 7, seed 142f0967 (surface scope, persuade).
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
        review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
      */}
      <OverlayStyles />
      {/*
        Suspense is REQUIRED, not defensive. `useSearchParams` in a prerendered route
        client-side-renders everything up to the nearest boundary — so without this, the
        nav, the footer and every section above would drop out of the prerender to serve a
        review-only query param.

        The docs also warn that dev renders on demand and therefore does NOT suspend, so
        the broken version looks completely fine locally and only shows up in a production
        build. `null` is the right fallback: the component renders nothing either way.
      */}
      <Suspense fallback={null}>
        <SkinSwitch />
      </Suspense>
      <PillNav />
      {/* `pt-16 md:pt-20` is the bar's own `h-16 md:h-20` — see `pill-nav.tsx`. The bar is
          fixed, opaque and the hero's own white, so it covers this padding exactly; any other
          number either hides the hero's top under the bar or leaves a strip of `mk-paper`
          between them. (2026-10-06: a `before:` white band used to paint this strip while the
          logo floated in it from `md`. The bar is solid at every width now, so it went.) */}
      <main id="main" className="flex-1 pt-16 md:pt-20">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
