import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { SKY, T } from "../theme";

/**
 * The world the film happens in: a sunrise sky over a meadow, with a horizon between them.
 *
 * This is the same composition the page's hero uses, which is the point — the film is not a
 * separate piece of art dropped into a page, it is the page's own first viewport with time
 * added. The horizon sits at 62% of the frame in both.
 *
 * The sky drifts a few percent over the loop. It is deliberately below the threshold at which
 * a viewer notices motion: what they notice is that the frame does not feel frozen while the
 * card is at rest, which is the difference between a loop and a held image.
 */
export function Stage({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // A full sine over the loop, so the value at the last frame equals the value at the first
  // and the seam is mathematically invisible rather than approximately so.
  const t = (frame / durationInFrames) * Math.PI * 2;
  const drift = Math.sin(t) * 1.6;

  return (
    <AbsoluteFill style={{ backgroundColor: T.skyZenith, overflow: "hidden" }}>
      {/* The card's own backdrop: the sky's vertical ramp, and nothing else.

          ⚠ THIS FILM CARRIES NO LANDSCAPE, AND THAT IS THE POINT. It first shipped with its
          own sky, meadow, horizon and sun — which looked right in isolation and wrong the
          moment it was placed, because the page's hero IS a sunrise over a meadow and the
          film sat inside it as a second, smaller landscape with its own horizon a few hundred
          pixels below the real one. Two horizons in one viewport reads as a mistake.

          So the page owns the world and the film owns the object. What is left here is the
          same vertical ramp the page's sky uses, which lets the framed film sit on that sky
          as a lit product shot rather than as a window into a different afternoon. */}
      <AbsoluteFill
        style={{
          backgroundImage: SKY,
          transform: `translateY(${drift}px) scale(1.06)`,
        }}
      />

      {/* One soft key light behind the card, drifting with it. It is what keeps a flat ramp
          from reading as a solid fill, and it gives the card's shadow a direction to agree
          with. */}
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: "58%",
            top: "42%",
            width: 1100,
            height: 1100,
            marginLeft: -550,
            marginTop: -550,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,246,220,0.42) 0%, rgba(190,225,255,0.16) 40%, rgba(190,225,255,0) 70%)",
            transform: `translateY(${drift * 2}px)`,
          }}
        />
      </AbsoluteFill>

      {/* A vignette, so the frame's edges fall away instead of ending. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 46%, rgba(6,20,44,0) 42%, rgba(6,20,44,0.34) 100%)",
        }}
      />

      {children}
    </AbsoluteFill>
  );
}

/** Fades the very first and last frames to nothing-changed, so a hard loop has no visible cut. */
export function useLoopSafeOpacity() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(
    frame,
    [0, 6, durationInFrames - 6, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}
