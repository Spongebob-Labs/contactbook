import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

/**
 * The marketing site's motion vocabulary — **the one door. Sections import from here.**
 *
 * ## Why the vocabulary is a module and not an import in every section
 *
 * DESIGN.md's motion rule is *one authored moment, and nothing else moves on its own*, and its
 * stated failure mode is exact: scattered scroll reveals "read as a template with a plugin
 * attached, they leave a mid-page visitor looking at nothing, and they make every section behave
 * identically." A library imported directly into eight section files becomes that within a week,
 * because each section then makes its own decision.
 *
 * So the library is wrapped, the vocabulary is small and named, and a section chooses from it
 * rather than authoring animation. Five primitives, and adding a sixth should require an argument.
 * **`motion/react` is imported by exactly one file in this repository** — `mk-motion-live.tsx`,
 * which this module re-exports in full. A `motion.div` anywhere else is a bug.
 *
 * ## ⚠ The two rules every primitive here obeys
 *
 * 1. **The final state is the default.** Every element is fully painted, in position, at rest,
 *    with no JavaScript and no animation. Motion only ever *replays the arrival*. The e2e harness
 *    injects a stylesheet that zeroes every duration and the suite screenshots the result — a
 *    component that is invisible until an animation runs fails every one of those, and worse, is
 *    invisible to a real reader whose JS never loads.
 * 2. **Reduced motion gates travel, not visibility.** Reduced motion gets the same page with no
 *    movement, never a page with missing content.
 *
 * ## Two entrances, and which to reach for
 *
 * | import from | fires on | use for | costs |
 * |---|---|---|---|
 * | `./mk-motion` — `Arrival` | load | the hero, above the fold | nothing. A data attribute. |
 * | `./mk-motion-live` — `Reveal`, `CountUp` | first intersection | a section scrolled to | `motion/react` |
 *
 * They are not interchangeable in either direction. `Reveal` in the hero waits for an
 * intersection that already happened and leaves the headline displaced at first paint; `Arrival`
 * in section six finishes before anybody scrolls to it.
 *
 * ## ⚠ WHY THIS FILE IS NOT `"use client"`, AND WHY THAT IS LOAD-BEARING
 *
 * It used to be, with everything in it. A `"use client"` module is a client entry point and
 * Turbopack does not tree-shake unused exports out of one, so importing `<Arrival>` — a plain
 * `<div>` with a data attribute and no runtime — pulled `motion/react` into the client bundle for
 * `/`. Measured on the built output: a 135KB chunk, referenced by the prerendered `/`, on the page
 * whose LCP is a video poster, in order to run five CSS keyframes.
 *
 * The split puts the `"use client"` boundary around the code that needs one. This module stays a
 * plain one, so a page importing only `Arrival` links nothing from the runtime file. Anything
 * added here that needs a hook or the library goes in `mk-motion-live.tsx` and is re-exported at
 * the bottom — not added to this file.
 */

/* ── The arrival — the hero, and nowhere else ─────────────────────────────────────────────── */

/**
 * What is arriving, which is the only knob worth having.
 *
 * `copy` rises 14px and fades. `object` rises 26px, fades, and scales up from 0.972 — because a
 * physical thing arriving toward the reader changes size and a line of text does not. Both curves,
 * both distances and both durations are in `marketing.css` under `[data-mk-arrive]`; they are not
 * repeated here, so there is one place to tune the moment and it is next to the keyframes.
 */
export type ArrivalVariant = "copy" | "object" | "line";

/*  `copy`   a line of text rising 14px. The default, and the quiet one.
    `object` a physical thing arriving toward the reader: further, slower, and scaling.
    `line`   ⚠ the signature move — a clause WIPED up from behind a clip, so the headline
             appears to be written onto the ruled sheet. It is the one move on the page that
             hides content while it runs, which is legal only because it is a pure CSS load
             animation with `both` fill: zeroed durations land on the finished state and a
             failed script never starts it. Do not reach for this on scroll; see the scroll
             vocabulary at the foot of `marketing.css` for why. */

export interface ArrivalProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  /**
   * The element to render. `span` exists for `variant="line"`, which stages the clauses of a
   * heading — and a `<div>` inside an `<h1>` is invalid HTML, so the vocabulary has to be able
   * to produce an inline element rather than every caller hand-rolling the data attribute and
   * bypassing this module.
   */
  as?: "div" | "span";
  /**
   * Position in the sequence. Multiplied by the 70ms step in CSS.
   *
   * ⚠ It is an ORDINAL, not a delay in milliseconds. Passing 300 here does not mean 300ms, it
   * means twenty-one seconds, and the element is invisible for all of them.
   */
  index?: number;
  variant?: ArrivalVariant;
}

/**
 * One element arriving on load: a short rise, once, as part of the hero's sequence.
 *
 * ## ⚠ This renders a plain `<div>` and runs on a stylesheet, deliberately
 * Three defects it avoids, and the first two are the rules above:
 *
 * 1. `initial={{ opacity: 0 }}` on a `motion` component is baked into the server HTML and only
 *    hydration removes it, so a JS arrival is a hero that is *missing* — for a crawler, for a
 *    reader whose script fails, and for every screenshot the e2e harness takes with durations
 *    zeroed. A CSS animation with `animation-fill-mode: both` and a zeroed duration lands on its
 *    final keyframe instantly, and that keyframe IS the element's ordinary rendering. Delete the
 *    stylesheet block and the hero is unchanged apart from being still.
 * 2. One `prefers-reduced-motion` rule drops the animation and nothing else, so the reader who
 *    asked for less movement gets the same page without it.
 * 3. It costs no bundle. See the module header for the 135KB this is worth.
 *
 * That is not licence to reimplement the others in CSS. `Reveal` and `CountUp` need to know when
 * an element entered the viewport, which is a runtime question; `Arrival` fires on load, which is
 * a question a stylesheet can answer on its own.
 */
export function Arrival({
  children,
  index = 0,
  variant = "copy",
  as: As = "div",
  style,
  ...rest
}: ArrivalProps) {
  return (
    <As
      {...rest}
      data-mk-arrive={variant}
      style={{ ...style, "--mk-arrive-index": index } as CSSProperties}
    >
      {children}
    </As>
  );
}

/* ── The scroll vocabulary lives in `./mk-motion-live` and IS NOT RE-EXPORTED HERE ─────────
   Only the types are, because types are erased and cost nothing.

   ⚠ This is the second half of the bundle fix and it is the counter-intuitive half. Re-exporting
   `Reveal` from this module was tried first and did not work: a re-export keeps the client module
   reachable from every page that imports anything here, so `/` still linked the 135KB chunk while
   using none of it. Turbopack cannot drop a client reference on the grounds that the export is
   unused, because a client reference is not a value it can trace.

   So the door is two doors, and the split is not clerical — **the import line names the price**:

     import { Arrival } from "./mk-motion";        // free. A data attribute and a keyframe.
     import { Reveal } from "./mk-motion-live";    // links motion/react into this route.

   A section reaching for `Reveal` should have to write the word `live`, and a reviewer should be
   able to grep one string to find every route that pays for an animation runtime. `motion/react`
   is still imported by exactly one file; this module is still where the vocabulary is documented
   and decided. */

export type { CountUpProps, RevealProps } from "./mk-motion-live";
