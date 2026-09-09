"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { FACE_HEIGHT, FACE_WIDTH } from "@/card/share-face";

import { mkcn } from "./mk-cn";

/**
 * The hero's card, with two faces: the real wallet pass on the front and the live card on the
 * back. It flips.
 *
 * ## What the two faces are for, which is the whole reason to flip rather than to show one
 * The product is two objects and a reader has to understand both:
 *   · **the front** is a real `<ShareFace>` — the 336×500 wallet pass with the QR, the thing
 *     you hand over, rendered by the product's own component at the product's own size.
 *   · **the back** is the card that QR opens, with the fields on it, updating themselves.
 *
 * Shown side by side those are two unrelated pictures. Shown as two faces of one object, the
 * relationship is the animation: *this* is what you hand over, and *this* is what they see.
 *
 * ## ⚠ THE AUTO-CYCLE STOPS THE MOMENT A READER TOUCHES IT, AND THAT IS NOT A NICETY
 * A QR is a scanning target. A code that vanishes after four seconds cannot be scanned by
 * somebody reaching for their phone, so the first interaction hands control over permanently:
 * click or press and the card flips and stays. The automatic flip exists to *demonstrate* that
 * there are two faces; once the reader knows, it stops deciding for them.
 *
 * It is a real `<button>` for the same reason — this is an interactive control, not decoration,
 * so it has to be reachable by keyboard and announce what it does. The faces themselves are
 * `aria-hidden`: a screen reader gets the label and the caption, not two card renders read out
 * in sequence, one of which rewrites itself every two seconds.
 *
 * ## ⚠ THE GEOMETRY IS THE FACE'S OWN, IMPORTED, NEVER RETYPED
 * `FACE_WIDTH` / `FACE_HEIGHT` come from `share-face.tsx`, where they are *derived* — 336
 * because the face is rigid and must fit a 360px viewport with the card screen's 12px padding,
 * and 500 because it is the sum of the format's parts. A literal here would silently disagree
 * with the front face the day either is re-derived, and the back would either crop it or float
 * inside it.
 *
 * ## ⚠ AND THE QR SURVIVES THE FLIP, WHICH TOOK CARE
 * DESIGN.md is explicit that the symbol has ONE pixel of clearance over the 140px scannable
 * floor and that any transform on an ancestor spends headroom that does not exist. A 3D flip
 * is such a transform — so:
 *   · **no scale, ever.** The flip is `rotateY` alone. At rest either face sits at an
 *     identity-equivalent transform, so the resting symbol is exactly the size it was authored.
 *   · **no `will-change` left on at rest**, which is what would otherwise pin a cached raster
 *     of a mid-flight frame and leave a soft QR on a card nobody is touching.
 * `marketing.spec.ts` measures the symbol at rest, on both faces, for exactly this reason.
 */

/** Milliseconds each face is held before the automatic cycle turns it. */
const HOLD = { front: 4200, back: 11400 } as const;

export function FlipCard({
  front,
  back,
  frontLabel,
  backLabel,
  caption,
  className,
  onFaceChange,
}: {
  /** A real `<ShareFace>`, resolved on the server and passed in as an element. */
  front: ReactNode;
  back: ReactNode;
  /** Announced on the control, describing what a press will reveal. */
  frontLabel: string;
  backLabel: string;
  caption: string;
  className?: string;
  /** Lets the back's own animation run only while the back is showing. */
  onFaceChange?: (face: "front" | "back") => void;
}) {
  const [face, setFace] = useState<"front" | "back">("front");
  /** Set on the first press, and never unset. See the note above. */
  const [manual, setManual] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const frame = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onFaceChange?.(face);
  }, [face, onFaceChange]);

  /**
   * The visibility watch. Mount-only.
   *
   * ⚠ A NON-RENDERED PAGE NEVER DELIVERS AN ENTRY — measured, not theorised — so in a
   * background tab this never fires, `onScreen` stays false, and the card holds its front face.
   * The failure mode is the resting state, which is also what the server renders and what
   * reduced motion keeps.
   */
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(Boolean(entry?.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* The cycle. Off once a reader has taken control, and off while the card is off screen. */
  useEffect(() => {
    if (manual || !onScreen) return;
    const timer = setTimeout(
      () => setFace((f) => (f === "front" ? "back" : "front")),
      HOLD[face],
    );
    return () => clearTimeout(timer);
  }, [face, manual, onScreen]);

  return (
    <figure className={mkcn("mk-flip", className)}>
      <button
        ref={frame}
        type="button"
        data-hero-card=""
        data-face={face}
        data-manual={manual ? "" : undefined}
        aria-label={face === "front" ? frontLabel : backLabel}
        onClick={() => {
          setManual(true);
          setFace((f) => (f === "front" ? "back" : "front"));
        }}
        className="mk-flip-button"
        style={{ width: FACE_WIDTH, height: FACE_HEIGHT }}
      >
        <span className="mk-flip-inner">
          {/* Both faces are in the DOM at all times: the back is a server-rendered card and
              mounting it on first flip would show an empty rectangle for a frame. */}
          <span className="mk-flip-face" data-side="front" aria-hidden="true">
            {front}
          </span>
          <span className="mk-flip-face" data-side="back" aria-hidden="true">
            {back}
          </span>
        </span>
      </button>

      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}
