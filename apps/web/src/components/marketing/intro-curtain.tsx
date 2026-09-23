import { Fragment, type ReactElement } from "react";

import { hero } from "@/fixtures/marketing";

/**
 * The intro curtain — the deck's cover slide, performed, then lifted off the hero.
 *
 * ## What this is, and the one thing it must never become
 *
 * A cream panel covering the first viewport for ~2.2s on a visitor's first load of `/`, on the
 * client's own brief: *"before the whole website loads or the hero section loads, there will be
 * a creamish-coloured screen… a 2- or 3-second animation… after that we will be welcoming the
 * user to the main hero section."*
 *
 * It must never become a **loading indicator**, because it is not one. Nothing is being waited
 * for: this page is static, prerendered, and its one image is already `preload`ed by `hero.tsx`.
 * The curtain is a title card on a fixed clock, and the page underneath is complete the whole
 * time it is up — which is also why there is no spinner, no percentage and no "loading" text
 * anywhere in it. Drawing a progress bar for work that is not happening is a lie told in UI.
 *
 * ## ⚠ THE HONEST COST, STATED ONCE
 *
 * A splash screen is a real cost, not a free flourish: it is 2.2s between a visitor arriving and
 * a visitor reading, and the industry measures that. Three things keep it defensible rather than
 * merely shipped, and all three are load-bearing — do not remove one without re-reading this:
 *
 *   1. **Once per browser session.** The gate lives in `app/layout.tsx` as a blocking inline
 *      script that reads `sessionStorage` before first paint. A splash a reader sees on every
 *      reload stops being a title card and becomes a toll.
 *   2. **The content underneath is never delayed, deferred or hidden from a crawler.** This is a
 *      `position: fixed` sibling that paints OVER a hero which has already rendered. Nothing is
 *      conditionally mounted, nothing waits on hydration, and `curl` sees the same DOM it always
 *      did. That is the difference between a curtain and a loading screen, and it is why this is
 *      not a Next.js `loading.tsx` — `tests/e2e/marketing.spec.ts` asserts `/` ships none ("it is
 *      the one static route") and that assertion stays true.
 *   3. **It is text, not an image.** No request is added to the critical path, so the curtain
 *      cannot itself be the thing that makes the page slow to paint.
 *
 * ## The mechanism: CSS on a fixed clock, never a timer
 *
 * There is no `"use client"`, no `useEffect`, no `setTimeout` and no state. The whole thing is
 * one stylesheet (`marketing-intro.css`) and the browser's own animation clock, which matters
 * for three failure modes a JS-driven splash gets wrong:
 *
 *   · **It cannot get stuck.** A curtain whose exit depends on a script is a blank page forever
 *     if that script throws, is blocked, or never hydrates. This one lifts because a CSS
 *     animation ended, which nothing in userland can prevent.
 *   · **It starts on the first frame.** A React-mounted splash appears *after* hydration, so a
 *     visitor sees hero → splash → hero, which is worse than no splash at all.
 *   · **`prefers-reduced-motion: reduce` gets no curtain whatsoever**, not a faster one. The
 *     panel's default state is `display: none`; it is only shown inside the
 *     `no-preference` guard. That follows the same contract every other motion file on this page
 *     keeps — the final state IS the default — and here it also means the accessible path is the
 *     fast path, which is the right way round.
 *
 * ## The composition, and why each beat is this beat
 *
 * The deck's cover is the wordmark over "Never Lose Contact". That is what this shows, so the
 * curtain is the brand's own title card rather than a new object invented for a loading screen —
 * and it lifts into a hero whose headline is the same line, which reads as the page arriving at
 * the thing it just announced rather than as a repeat.
 *
 *   1. **The mark assembles.** Two rings drift in from opposite sides and interlock. The shape is
 *      `public/marketing/logo-mark.svg`'s own geometry (two circles, r=54, 14-wide stroke, 56
 *      apart on a 256 grid), redrawn inline so it can be animated and so the curtain adds no
 *      request. That file's own header explains the shape — "two parties, one link between
 *      them" — which is exactly the thing worth animating: the rings are apart, and then they
 *      are not.
 *   2. **The wordmark fades up**, letterspaced, in the eyebrow's register.
 *   3. **The line turns over, word by word.** `hero.headline` split on spaces — derived, never
 *      retyped, so the fixture stays the single source of the brand's own sentence. The flip is
 *      the same `rotateX` idiom `marketing-solution.css` uses for a value changing in place; it
 *      is here because the client asked for "some flipping kind of things", and it costs one
 *      keyframe.
 *   4. **The curtain lifts on the card's own wave.** Its bottom edge is `<SheetCurve>`'s exact
 *      path from `@/card/card-page`, mirrored to fill upward. The curtain leaves the way a card's
 *      sheet rises over its cover — so the exit is the product's signature shape rather than a
 *      generic fade, and it is the one beat that ties the splash to what the site sells.
 *
 * ## Why `aria-hidden`, and why that is not a shortcut
 *
 * Every word here is already on the page underneath — `hero.eyebrow` and `hero.headline` are the
 * hero's own eyebrow and `<h1>`. Announcing them twice would make a screen reader read the page's
 * title, then read it again. There is nothing focusable inside, and `pointer-events: none` is set
 * unconditionally, so the curtain can never intercept a click even in the frames where it is
 * fully opaque.
 */
export function IntroCurtain(): ReactElement {
  /* Derived from the fixture, never retyped. `hero.headline` is one of the two locked brand
     lines (see `fixtures/marketing.ts`: "a rewrite of either is a rewrite of the identity"), so
     splitting it here keeps the curtain and the hero's own `<h1>` incapable of disagreeing. */
  const words = hero.headline.split(" ");

  return (
    <div className="mk-intro" data-intro-curtain="" aria-hidden="true">
      <div className="mk-intro__inner">
        {/* The mark. Two rings, drawn rather than fetched — see the module note. The viewBox and
            geometry are `logo-mark.svg`'s; only the colour is a token rather than the file's
            baked hex, so the mark follows whichever skin the page is wearing. */}
        <svg className="mk-intro__mark" viewBox="0 0 256 256" focusable="false">
          <circle className="mk-intro__ring mk-intro__ring--a" cx="100" cy="128" r="54" />
          <circle className="mk-intro__ring mk-intro__ring--b" cx="156" cy="128" r="54" />
        </svg>

        <p className="mk-intro__wordmark">{hero.eyebrow}</p>

        <p className="mk-intro__line">
          {words.map((word, index) => (
            /* ⚠ THE SPACE IS A SIBLING OF THE SPAN, NEVER ITS LAST CHILD. A word has to be
               `display: inline-block` to have a box `rotateX` can turn — and an inline-block
               collapses its own trailing whitespace, so a space written inside the span simply
               is not rendered. The first cut of this read "Neverlosecontact." on screen while
               looking perfectly correct in the JSX. */
            <Fragment key={`${word}-${index}`}>
              <span
                className="mk-intro__word"
                /* The per-word stagger. An index custom property rather than a generated class
                   per word: the stylesheet owns the cadence, this file owns only the order. */
                style={{ ["--mk-intro-i" as string]: index }}
              >
                {word}
              </span>
              {index < words.length - 1 ? " " : null}
            </Fragment>
          ))}
        </p>

        {/* A hairline that draws itself across while the curtain is up. It is NOT a progress bar
            — nothing is loading — it is the beat that tells a reader this screen is going
            somewhere rather than stuck, which is the one thing a title card does owe them. */}
        <span className="mk-intro__rule">
          <span className="mk-intro__rule-fill" />
        </span>
      </div>

      {/* The exit edge. `SheetCurve`'s path (`@/card/card-page`) mirrored to fill UPWARD, parked
          just below the panel so that as the whole thing translates up, this wave is its trailing
          edge and sweeps the screen. The `d` is deliberately a copy rather than an import: that
          component is a private function inside a product file this page does not import from,
          and a marketing curtain reaching into `src/card/**` for a string is the coupling the
          card system's own notes warn against. If the card's wave is ever redrawn, this one wants
          redrawing with it — which is what this paragraph is for. */}
      <svg className="mk-intro__wave" viewBox="0 0 400 52" preserveAspectRatio="none" focusable="false">
        <path d="M0 34 C 62 34, 112 8, 190 7 C 278 6, 332 21, 400 29 L400 0 L0 0 Z" />
      </svg>
    </div>
  );
}
