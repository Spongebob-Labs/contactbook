"use client";

import { useEffect, useLayoutEffect, useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

/**
 * The below-the-fold arrival — **the vocabulary entry the page did not have.**
 *
 * ## Why this exists when `Reveal` already did
 *
 * `mk-motion-live.tsx`'s `Reveal` is correct and unusable here, for two reasons both agents on
 * this page arrived at independently:
 *
 * 1. **It writes the hidden state into the server HTML.** `motion`'s `initial={{ opacity: 0 }}`
 *    is serialised into the markup and only hydration undoes it — so the section is *absent* for
 *    a crawler, for a reader whose script fails, and for every screenshot the e2e harness takes
 *    with durations zeroed. A marketing page whose content depends on JavaScript to become
 *    visible is a marketing page that is sometimes blank.
 * 2. **One import costs 135 KB.** Turbopack cannot tree-shake a client reference, so importing
 *    anything from the runtime module links `motion/react` into `/`. The homepage currently
 *    ships **no** animation library; that is worth keeping for five keyframes.
 *
 * `Arrival` solves both with CSS, but it is load-triggered and documented "do not use below the
 * fold" — it would fire on sections nobody has scrolled to yet. So this is the third entry:
 * scroll-triggered, CSS-animated, no library.
 *
 * ## ⚠ How the final state stays the default
 *
 * The element renders **at rest, fully visible, with no attribute**. That is the no-JavaScript
 * rendering and it is the correct one.
 *
 * `arm()` then runs in `useLayoutEffect` — *before the browser paints* — and sets
 * `data-mk-reveal="armed"`, which CSS turns into the displaced state. Because it lands before
 * paint, there is no flash of visible-then-hidden. The observer swaps it to `"in"` on first
 * intersection and the keyframe plays.
 *
 * Three consequences, all deliberate:
 *
 * ⚠ **It animates TRANSFORM ONLY, never opacity** — see the rule in `marketing.css`. The first
 * version faded in and the suite caught every un-scrolled cell rendering invisible.
 *
 * · **No JS** → no attribute → the plain element. Visible.
 * · **Durations zeroed** (the harness) → the animation completes instantly on its final keyframe,
 *   which *is* the plain element. Visible.
 * · **`prefers-reduced-motion`** → `arm()` never runs, so the attribute is never set. Visible,
 *   and no travel. Reduced motion removes movement, never content.
 *
 * ## Why an IntersectionObserver and not `animation-timeline: view()`
 *
 * The pure-CSS scroll-driven form is genuinely nicer and is not shipped in Safari or Firefox —
 * which between them are most of the phones this page is read on. An observer is ~20 lines and
 * works everywhere; `once` means it detaches after firing, so this is not a scroll handler.
 */

/**
 * Which move this element makes. See the scroll-vocabulary block at the foot of `marketing.css`
 * for why there are two rather than one, and why neither of them touches opacity.
 */
export type MkRevealMove = "rise" | "deal";

export interface MkRevealProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  move?: MkRevealMove;
  /**
   * Stagger position within a group. Multiplied by 70ms and **capped at 6** by the CSS, so an
   * eight-cell grid does not finish arriving after the reader has already looked at the last one.
   */
  index?: number;
}

/**
 * ⚠ **`threshold: 0` with a bottom `rootMargin`, NOT a fraction of the element.**
 *
 * A threshold is a fraction of the TARGET, so `0.15` on a bento cell fires almost immediately
 * and on a 1500px-tall pass it waits for 225px — the same number produces two completely
 * different moments depending on how big the thing is. Since the deck's passes are the tallest
 * elements on the page, that reads as the big sections arriving late and the small ones early.
 *
 * A bottom margin of -12% is a fraction of the VIEWPORT instead, so every element fires when its
 * top edge has come the same distance up the screen, whatever its height.
 */
const WATCH: IntersectionObserverInit = { threshold: 0, rootMargin: "0px 0px -12% 0px" };

/**
 * ⚠ **Twelve seconds, and it was two — which was a BUG, not a conservative choice.**
 *
 * This is a backstop for an observer that never fires. At 2s it was also firing on every normal
 * page load: a reader who spends three seconds on the hero before scrolling had already had
 * every pass below the fold released, so the scroll move the client asked for never played once.
 * It looked correct in a snapshot and was broken in use.
 *
 * The number can be this large because the moves are transform-only. Nothing is ever hidden, so
 * the worst case of a stuck observer is a section sitting 40px low for a few seconds — not a
 * blank page. That asymmetry is what buys the long window; if any move here ever touched
 * opacity, this number would have to come back down and the move would be the thing to change.
 */
const FAILSAFE_MS = 12_000;

/** Matches the guard in `marketing.css`; `arm()` must not run when the reader asked for stillness. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * ⚠ **Never arm something the reader can already see. This is the safety rule, not an
 * optimisation.**
 *
 * `armed` displaces an element and only an intersection puts it back, so arming something that
 * is already on screen means the reader watches it jump — and, worse, anything at the top of
 * the document is armed for one frame during hydration on every single load. Above-the-fold
 * content has no arrival to replay: it was there when the page opened.
 *
 * It is also what keeps a screenshot harness honest. A run that never scrolls only ever sees
 * unarmed elements in the first viewport, so a stuck observer can never present as "the hero is
 * missing" — the worst it can produce is something slightly low further down the page.
 */
function isOnScreen(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.top < window.innerHeight && r.bottom > 0;
}

export function MkReveal({ children, index = 0, move = "rise", style, ...rest }: MkRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  /* Before paint: displace it. After paint would be a visible flash of the final state. */
  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null || prefersReducedMotion() || isOnScreen(node)) return;
    node.dataset.mkReveal = "armed";
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (node === null || prefersReducedMotion()) return;

    /* Already on screen at mount — a reader who landed mid-page, or a short page. Release it
       immediately rather than waiting for a scroll that may never come. */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-mk-reveal", "in");
          observer.unobserve(entry.target);
        }
      },
      WATCH,
    );

    observer.observe(node);

    /* ⚠ Failsafe, same argument as the group's: the armed state is applied by script and
       removed by an observer, so any path where the observer never fires would leave the
       element displaced forever. */
    const failsafe = window.setTimeout(() => {
      if (node.dataset.mkReveal === "armed") node.dataset.mkReveal = "in";
    }, FAILSAFE_MS);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
      /* Unmounting mid-flight must not leave the element displaced — the attribute is the only
         thing hiding it, so it goes with the observer. */
      node.removeAttribute("data-mk-reveal");
    };
  }, []);

  return (
    <div
      ref={ref}
      data-mk-reveal-move={move}
      style={{ ...style, ["--mk-reveal-i" as string]: index }}
      {...rest}
    >
      {children}
    </div>
  );
}


export interface MkRevealGroupProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  /** Which descendants to stage. Defaults to the bento's own cells. */
  selector?: string;
  move?: MkRevealMove;
  /**
   * Stagger the members. Off for a group of one — the deck's passes are staged one per section,
   * and a delay on a single element is a pause, not a stagger.
   */
  stagger?: boolean;
}

/**
 * Stages a whole group from **one** observer, without making its children client components.
 *
 * ## Why this exists alongside `MkReveal`
 *
 * A bento cell *is* a grid item — its column span lives on the cell itself — so wrapping each
 * one in a `MkReveal` div would put a non-grid element between the grid and its tracks and
 * destroy the placement. And making `BentoCell` a client component to give it a ref would pull
 * the entire bento, and the live card objects inside it, into the client bundle to run a
 * fourteen-pixel slide.
 *
 * So the group is the client component and the cells stay server-rendered. It wraps them in
 * **`display: contents`**, which makes the wrapper generate no box at all — the grid still sees
 * the cells as its own direct children — and stamps the same two attributes `MkReveal` uses.
 *
 * Every rule from `MkReveal` holds unchanged: children render finished with no attribute, the
 * displaced state is applied before paint, reduced motion never arms, and one observer serves
 * the whole group and detaches per element as it fires.
 */
export function MkRevealGroup({
  children,
  selector = "[data-bento-cell]",
  move = "rise",
  stagger = true,
  ...rest
}: MkRevealGroupProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (root === null || prefersReducedMotion()) return;

    root.querySelectorAll<HTMLElement>(selector).forEach((el, i) => {
      el.dataset.mkRevealMove = move;
      if (isOnScreen(el)) return;
      el.dataset.mkReveal = "armed";
      el.style.setProperty("--mk-reveal-i", String(stagger ? i : 0));
    });
  }, [selector, move, stagger]);

  useEffect(() => {
    const root = ref.current;
    if (root === null || prefersReducedMotion()) return;

    const targets = [...root.querySelectorAll<HTMLElement>(selector)].filter(
      (el) => el.dataset.mkReveal === "armed",
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-mk-reveal", "in");
          observer.unobserve(entry.target);
        }
      },
      WATCH,
    );

    targets.forEach((el) => observer.observe(el));

    /* ⚠ Failsafe. The armed state is applied by script and removed by an observer, so any path
       where the observer never fires — a detached subtree, a browser that throttles callbacks in
       a background tab, a bug here — would leave cells 18px low forever. `FAILSAFE_MS` after
       mount everything is released regardless. It costs nothing when the observer works,
       because the attribute it would set is already `in`. */
    const failsafe = window.setTimeout(() => {
      targets.forEach((el) => {
        if (el.dataset.mkReveal === "armed") el.dataset.mkReveal = "in";
      });
    }, FAILSAFE_MS);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
      targets.forEach((el) => el.removeAttribute("data-mk-reveal"));
    };
  }, [selector, move, stagger]);

  return (
    <div ref={ref} style={{ display: "contents" }} {...rest}>
      {children}
    </div>
  );
}
