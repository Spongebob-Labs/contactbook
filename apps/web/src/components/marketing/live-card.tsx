"use client";

import { useEffect, useRef, useState } from "react";

import { liveCard, type LiveCardBeat } from "@/fixtures/marketing";

import { ContactCard } from "./contact-card";
import { mkcn } from "./mk-cn";

/**
 * The hero's card, animated — a contact card that goes out of date and repairs itself.
 *
 * This file is the DRIVER and nothing else: it owns a beat index, a timer and a visibility
 * watch, and hands `<ContactCard>` the beat to draw. The card itself, its slot geometry and
 * its five row states live in `contact-card.tsx`; the beats, the values and the timing live in
 * `fixtures/marketing.ts` under `liveCard`. Read that fixture's header first — it explains what
 * the sequence is arguing.
 *
 * ## ⚠ THIS IS THE FIFTH OBJECT PUT IN THIS HERO. FOUR WERE REJECTED.
 * A gradient, a big tilted card, a silent film and a fan of three real `<ShareFace>` cards were
 * each built and each rejected, the last on sight. The rule written afterwards was "the hero is
 * type-only; do not put an object on that sheet." This overrides it, on the client's explicit
 * brief and with sign-off — and the reason it is a different proposition is worth stating,
 * because the rule was right about the other four: they were pictures of a card sitting in the
 * empty half of the screen. This one performs the product's only claim. **If it is rejected,
 * the lesson is NOT "try a sixth object".**
 *
 * ## The performance contract, which the client set as a requirement
 * *"There should be no lag across the whole website... zero latency."* Four properties, and all
 * four are asserted by `marketing.spec.ts`:
 *
 *   1. **The first paint needs no JavaScript.** Beat 0 renders on the server, complete and
 *      correct. The timer starts only after mount, so there is no flash and nothing to wait
 *      for; a reader whose script fails keeps a finished card.
 *   2. **Nothing that animates causes layout.** The stack is a fixed number of slots, and rows
 *      are positioned by `transform` only — never `top`, never `height`, never a margin.
 *   3. **No scaling and no filters.** Scaling a box scales its text, forcing the browser to
 *      re-rasterise glyphs mid-flight; a blur or shadow transition repaints. Only `transform`
 *      and `opacity` change.
 *   4. **It stops when nobody is looking**, so scrolling the rest of the page costs nothing and
 *      a background tab does no work at all.
 */
export function LiveCard({
  className,
  /**
   * Whether this card is the face a reader can currently see.
   *
   * On the hero it is the BACK of a flip, so for most of the cycle it is turned away — and a
   * field loop advancing behind a card nobody is looking at spends the reader's battery to
   * arrive at a beat they did not watch. Worse, it desynchronises: the flip would reveal the
   * card mid-edit rather than at its settled first beat.
   *
   * Defaults to `true` so a standalone `<LiveCard>` behaves as it always did.
   */
  active = true,
}: {
  className?: string;
  active?: boolean;
}) {
  const beats = liveCard.beats;
  /**
   * Beat 0 is what the server renders, what reduced motion keeps, and what the loop returns to.
   * See the fixture's header for why it may not carry a marker or an empty slot.
   */
  const [index, setIndex] = useState(0);
  /**
   * Whether the card is on screen. Not `useState(true)` — the card must not start its loop on
   * the assumption that it is visible, because on a page restored mid-scroll it is not.
   */
  const [onScreen, setOnScreen] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  /**
   * The visibility watch. Mount-only, and that is the point.
   *
   * ⚠ THIS USED TO SHARE AN EFFECT WITH THE TIMER, WITH `index` IN ITS DEPENDENCIES, so an
   * IntersectionObserver was disconnected and rebuilt on every beat — six times a lap, forever,
   * for a fact that changes only when the reader scrolls. Rebuilding an observer is exactly the
   * per-frame work that shows up as jank on a page whose requirement is that it has none.
   *
   * ⚠ A NON-RENDERED PAGE NEVER DELIVERS AN ENTRY, and the card is built around that rather
   * than in spite of it: in a background tab this callback never fires, `onScreen` stays false,
   * and the card holds beat 0 — a complete, correct card. The failure mode is the resting
   * state. DESIGN.md records the same property being measured for the scroll reveals.
   */
  useEffect(() => {
    const node = frame.current;
    if (!node) return;

    /* Reduced motion is answered by never observing at all, rather than by a zero duration.
       Nothing to disconnect, nothing to schedule, and the card keeps beat 0 forever. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(Boolean(entry?.isIntersecting)),
      /* No threshold fraction: a fraction of a 360px card and a fraction of a viewport-tall
         section are two different moments. Any pixel on screen is the trigger. */
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /**
   * The beat clock. One `setTimeout` per beat rather than an interval, because each beat holds
   * for its own length — `stale` is short and `settled` is long, and that unevenness is what
   * stops the loop reading as a carousel.
   */
  useEffect(() => {
    if (!onScreen || !active) return;
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % beats.length),
      beats[index]?.hold ?? 2000,
    );
    return () => clearTimeout(timer);
  }, [index, onScreen, active, beats]);


  /**
   * Turning away resets the loop to beat 0.
   *
   * Without it the card would be revealed wherever it happened to stop — mid-strike-through, or
   * with a row fading out — and a reader flipping to it would meet the story in the middle.
   * Beat 0 is the finished card, which is the right frame to be handed.
   *
   * ⚠ ADJUSTED DURING RENDER, NOT IN AN EFFECT. This was `useEffect(() => { if (!active)
   * setIndex(0) }, [active])`, which is a synchronous `setState` inside an effect: React renders
   * the stale beat, commits it, then immediately re-renders — a cascading render on the page
   * whose stated requirement is no perceptible lag, and the lint says so. Comparing the
   * previous prop during render is the pattern React documents for deriving state from a
   * changed prop; the extra render happens before anything is committed, so no stale frame is
   * ever painted.
   */
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setIndex(0);
  }

  const beat: LiveCardBeat = beats[index] ?? beats[0]!;

  return (
    <figure className={mkcn("mk-live", className)}>
      {/* The card is a demonstration, not content. A screen reader gets the caption below
          instead of four field rows that rewrite themselves every couple of seconds. */}
      <ContactCard
        ref={frame}
        aria-hidden="true"
        /* ⚠ NO `data-hero-card` HERE. It used to carry it, from when this card WAS the hero's
           object; it is now the back face of `<FlipCard>`, which owns that attribute on its
           button. Both having it made `[data-hero-card]` resolve to two elements and broke
           every locator that assumed one. The card is identified by `data-live-card`, which
           `<ContactCard>` sets for itself and which `problem` shares. */
        data-beat={beat.id}
        name={liveCard.name}
        role={liveCard.role}
        mark={liveCard.mark}
        rows={beat.rows}
        reset={beat.reset}
      />
      <figcaption className="sr-only">{liveCard.caption}</figcaption>
    </figure>
  );
}
