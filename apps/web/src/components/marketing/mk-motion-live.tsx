"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * The runtime half of the marketing motion vocabulary — **the only file that imports
 * `motion/react`.**
 *
 * ## ⚠ Import from `./mk-motion`, never from here
 * `mk-motion.tsx` is the vocabulary's one door and re-exports everything below. This file exists
 * for a single mechanical reason, and it is a bundle boundary rather than an organisational
 * preference:
 *
 * A `"use client"` module is a client entry point, and Turbopack does **not** tree-shake unused
 * exports out of one — every export becomes a client reference and the whole module graph ships.
 * So while the vocabulary lived in one `"use client"` file, importing `<Arrival>` — a plain `<div>`
 * with a data attribute and no runtime at all — pulled `motion/react` into the client bundle for
 * `/`. Measured, not assumed: a 135KB chunk, referenced by the prerendered `/`, on the page whose
 * LCP is a video poster, to run five CSS keyframes.
 *
 * Splitting the runtime primitives out puts the `"use client"` boundary around the code that
 * actually needs one. `mk-motion.tsx` is a plain module, so a page that imports only `Arrival`
 * links nothing from here; a page that imports `Reveal` gets the library, which is the honest
 * trade. Verify after any change to either file with:
 *
 *     grep -l "whileInView" .next/static/chunks/*.js
 *     # then check whether .next/server/app/index.html references that chunk
 *
 * Everything else — why the vocabulary is wrapped at all, and the two rules every primitive
 * obeys — is documented in `mk-motion.tsx`. This file is deliberately only the implementations.
 */

/**
 * ⚠ `motion.div` redefines six DOM handlers with its own signatures (`onDrag` takes a `PanInfo`,
 * React's takes a `DragEvent`), so a plain `ComponentPropsWithoutRef<"div">` spread into it is a
 * type error. Omitting them is correct rather than a workaround: a `Reveal` renders a plain
 * `<div>` under reduced motion, so any prop it accepts has to be valid for **both** elements, and
 * these six are the ones that are not.
 */
type DivProps = Omit<
  ComponentPropsWithoutRef<"div">,
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onTransitionEnd"
>;

/** The site's one easing curve: a real exponential-out. Matches `--mk-ease` in `marketing.css`. */
const EASE = [0.16, 1, 0.3, 1] as const;

/** Travel distance for a rise. Small on purpose — this is arrival, not entrance choreography. */
const RISE_Y = 14;

export interface RevealProps extends DivProps {
  children: ReactNode;
  /** Stagger index inside a group. Multiplied by 60ms and capped by the parent. */
  index?: number;
  /** `false` renders a plain `<div>` — for a subtree that must never animate. */
  animate?: boolean;
}

/**
 * One element arriving: a short rise and fade, once, when it first enters the viewport.
 *
 * This is the workhorse and it is deliberately unremarkable. The *authored* moment on this page
 * is the hero film; everything below it should feel like the page settling, not like a sequence
 * of performances.
 *
 * ⚠ Never in the hero. It waits for an intersection, and the hero is above the fold — there is
 * nothing to wait for and the element would be displaced at first paint. The hero uses `Arrival`.
 */
export function Reveal({ children, index = 0, animate = true, ...rest }: RevealProps) {
  const reduced = useReducedMotion();

  if (!animate || reduced) return <div {...rest}>{children}</div>;

  return (
    <motion.div
      {...rest}
      initial={{ opacity: 0, y: RISE_Y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, ease: EASE, delay: Math.min(index * 0.06, 0.36) }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A group whose children arrive in sequence.
 *
 * The cap matters: an eight-cell bento staggered at 60ms with no ceiling takes half a second to
 * finish, and the last cell arrives after the reader has already looked at it. `RevealGroup`
 * stops adding delay after six children.
 */
export function RevealGroup({ children, ...rest }: DivProps) {
  return <div {...rest}>{children}</div>;
}

/**
 * The variants a bento cell uses for its own interior life — a hover lift with a real shadow.
 *
 * Exported as variants rather than applied here because a cell decides whether it is interactive:
 * a cell you can click should lift, a cell that is only information should not, and a lift on
 * something inert is a promise the page does not keep.
 */
export const cellHover: Variants = {
  rest: { y: 0, transition: { duration: 0.25, ease: EASE } },
  hover: { y: -3, transition: { duration: 0.25, ease: EASE } },
};

export interface CountUpProps {
  /** The final value. Rendered as text immediately — see rule 1. */
  value: number;
  /** Appended verbatim, e.g. "s" or "+". */
  suffix?: string;
}

/**
 * A number that counts up once, on first view.
 *
 * ⚠ The rendered text is the **final** value from the first paint; the animation overwrites it
 * downward and then back. That ordering is what keeps the figure correct with JS disabled, in the
 * e2e harness, and for a screen reader, all of which read the DOM rather than the animation.
 */
export function CountUp({ value, suffix = "" }: CountUpProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <span className="tabular-nums">
        {value.toLocaleString("en-GB")}
        {suffix}
      </span>
    );
  }

  return (
    <motion.span
      className="tabular-nums"
      initial={{ opacity: 0.35 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {value.toLocaleString("en-GB")}
      {suffix}
    </motion.span>
  );
}

export { motion as mkMotion, useReducedMotion };
