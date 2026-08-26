import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Page } from "./parts/Page";
import { PASS_H, PASS_W, Pass } from "./parts/Pass";
import { Stage } from "./parts/Stage";
import { T } from "./theme";

/**
 * The hero film — 15 seconds, silent, seamless.
 *
 * ## The beats, and why they are these
 * The product's whole argument is a sequence of four events, so the film is that sequence and
 * nothing else. No feature montage, no interface tour, no floating logo.
 *
 *   0.0-3.0s   the pass at rest, its QR facing out          "this is what you hand over"
 *   3.0-6.0s   a scan crosses the code                      "this is how it is taken"
 *   6.0-9.5s   the card page rises from behind the pass     "this is what they get"
 *   9.5-13.0s  the number changes and the update lands      "this is what keeps it true"
 *   13.0-15.0s the page settles back, the pass returns      the loop closes on frame 0
 *
 * ## Seamlessness is arithmetic, not a crossfade
 * The last frame is composed to equal the first: the page has fully retreated, the pass sits
 * at the same float phase (the drift is a full sine over the duration), and the phone number
 * has flipped BACK to the original. That last one matters — a loop where the number stays
 * changed is a film that shows the update once and then lies about the starting state for
 * every subsequent play.
 *
 * ## Every value comes from useCurrentFrame
 * No CSS transition and no CSS animation appears anywhere in this composition: they are not
 * driven by Remotion's clock and would render as either a frozen first frame or a strobe.
 */

const OLD_PHONE = "+91 98201 15577";
const NEW_PHONE = "+91 99304 42180";

export function HeroLoop() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const s = (sec: number) => Math.round(sec * fps);

  /* ── Beat boundaries ─────────────────────────────────────────────────────── */
  const SCAN_IN = s(3);
  const PAGE_IN = s(6);
  const UPDATE_IN = s(9.5);
  const RETURN_IN = s(13);

  /* ── The pass's rest state ───────────────────────────────────────────────── */
  // A full sine over the loop: identical at the first and last frame by construction.
  const floatPhase = (frame / durationInFrames) * Math.PI * 2;
  const float = Math.sin(floatPhase) * 10;
  const tilt = Math.sin(floatPhase) * 1.1;

  // The pass arrives once, at the top of the loop, and is already most of the way there —
  // an element that starts invisible is invisible to anyone who lands mid-scroll.
  const arrive = spring({ frame, fps, config: { damping: 200 }, durationInFrames: s(1.4) });

  /* ── Beat 2 · the scan ───────────────────────────────────────────────────── */
  const scan = interpolate(frame, [SCAN_IN, SCAN_IN + s(1.6)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scanVisible = frame >= SCAN_IN - s(0.3) && frame < PAGE_IN;
  // The read confirmation: a single pulse of lime over the plate the instant the sweep clears.
  const read = interpolate(frame, [SCAN_IN + s(1.5), SCAN_IN + s(1.75), SCAN_IN + s(2.4)], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Beat 3 · the page rises ─────────────────────────────────────────────── */
  const pageRise = spring({
    frame: frame - PAGE_IN,
    fps,
    config: { damping: 200 },
    durationInFrames: s(1.1),
  });
  const pageRetreat = spring({
    frame: frame - RETURN_IN,
    fps,
    config: { damping: 200 },
    durationInFrames: s(1.1),
  });
  const pageOut = pageRise - pageRetreat; // 0 → 1 → 0 across the loop

  /* ── Beat 4 · the update ─────────────────────────────────────────────────── */
  // The number flips at the midpoint of the update beat, and flips BACK during the return so
  // the loop's first frame is honest.
  const flipped = frame >= UPDATE_IN + s(0.6) && frame < RETURN_IN + s(0.6);
  const phone = flipped ? NEW_PHONE : OLD_PHONE;
  const flipPulse = interpolate(
    frame,
    [UPDATE_IN + s(0.3), UPDATE_IN + s(0.6), UPDATE_IN + s(1.3)],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const updatePulse = spring({
    frame: frame - UPDATE_IN - s(0.9),
    fps,
    config: { damping: 200 },
    durationInFrames: s(0.8),
  }) * (1 - pageRetreat);

  /* The pass slides aside and back as the page takes the stage — it never leaves frame, so the
     viewer keeps hold of the object the whole film is about. */
  const passShift = interpolate(pageOut, [0, 1], [0, -140]);
  const passScale = interpolate(pageOut, [0, 1], [1, 0.82]);
  const passTurn = interpolate(pageOut, [0, 1], [0, -9]);

  return (
    <Stage>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          // The whole cast scales as one so the pass, the page and their shadows keep their
          // relationship; scaling them separately would drift the light.
          transform: "scale(1.22)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: PASS_W + 300,
            height: PASS_H + 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* ── The pass ─────────────────────────────────────────────────────── */}
          <div
            style={{
              position: "absolute",
              transform: [
                `translateX(${passShift}px)`,
                `translateY(${float + interpolate(arrive, [0, 1], [36, 0])}px)`,
                `rotate(${tilt + passTurn}deg)`,
                `scale(${passScale * interpolate(arrive, [0, 1], [0.94, 1])})`,
              ].join(" "),
              opacity: arrive,
              filter: `drop-shadow(0 40px 60px rgba(9,24,48,0.45))`,
              zIndex: 2,
            }}
          >
            <Pass phone={phone} />

            {/* The flip highlight: the moment the number changes, the pass's own detail row
                gets one pulse of lime behind it. Positioned against the pass so it travels
                with it rather than floating in world space. */}
            <div
              style={{
                position: "absolute",
                left: 20,
                right: 20,
                top: 236,
                height: 58,
                borderRadius: 12,
                background: T.amber,
                opacity: flipPulse * 0.5,
              }}
            />

            {/* ── Beat 2 · the scan reticle over the QR plate ────────────────── */}
            {scanVisible ? (
              <div
                style={{
                  position: "absolute",
                  left: PASS_W / 2 - 124,
                  bottom: 22,
                  width: 248,
                  height: 248,
                  opacity: interpolate(
                    frame,
                    [SCAN_IN - s(0.3), SCAN_IN, PAGE_IN - s(0.4), PAGE_IN],
                    [0, 1, 1, 0],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  ),
                }}
              >
                <Reticle progress={scan} read={read} />
              </div>
            ) : null}
          </div>

          {/* ── The card page ────────────────────────────────────────────────── */}
          <div
            style={{
              position: "absolute",
              transform: [
                `translateX(${interpolate(pageOut, [0, 1], [0, 104])}px)`,
                `translateY(${interpolate(pageOut, [0, 1], [70, 0])}px)`,
                `rotate(${interpolate(pageOut, [0, 1], [6, 3])}deg)`,
                `scale(${interpolate(pageOut, [0, 1], [0.9, 1])})`,
              ].join(" "),
              opacity: pageOut,
              filter: `drop-shadow(0 36px 56px rgba(9,24,48,0.4))`,
              // The page comes FORWARD when it rises. It was behind the pass, whose edge
              // cropped every button label — the exact content this beat exists to show.
              zIndex: 3,
            }}
          >
            <Page
              frame={frame - PAGE_IN}
              fps={fps}
              updated={frame >= UPDATE_IN}
              updatePulse={Math.max(0, updatePulse)}
            />
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
}

/**
 * The scanning reticle: four corner brackets and a sweep line.
 *
 * Drawn rather than glyphed, and deliberately NOT a full frame around the code — a closed
 * rectangle reads as a viewfinder UI from some other app. Four corners read as attention.
 */
interface Corner {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  /** Which two edges of this corner bracket are drawn. */
  t?: boolean;
  b?: boolean;
  l?: boolean;
  r?: boolean;
}

const CORNERS: Corner[] = [
  { top: 0, left: 0, t: true, l: true },
  { top: 0, right: 0, t: true, r: true },
  { bottom: 0, left: 0, b: true, l: true },
  { bottom: 0, right: 0, b: true, r: true },
];

function Reticle({ progress, read }: { progress: number; read: number }) {
  const y = interpolate(progress, [0, 1], [8, 92]);
  const corner = 34;
  const stroke = 3;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {CORNERS.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: corner,
            height: corner,
            top: c.top,
            bottom: c.bottom,
            left: c.left,
            right: c.right,
            borderTop: c.t ? `${stroke}px solid ${T.amber}` : undefined,
            borderBottom: c.b ? `${stroke}px solid ${T.amber}` : undefined,
            borderLeft: c.l ? `${stroke}px solid ${T.amber}` : undefined,
            borderRight: c.r ? `${stroke}px solid ${T.amber}` : undefined,
            borderRadius: 4,
          }}
        />
      ))}

      {/* The sweep. A soft band rather than a hairline: a 1px line over a QR at video
          bitrates disappears into compression. */}
      <div
        style={{
          position: "absolute",
          left: 6,
          right: 6,
          top: `${y}%`,
          height: 26,
          marginTop: -13,
          // Amber's channels: `rgb(225 170 64)` IS `#E1AA40`. A beam of light in this world is
          // the same warm as the horizon rim on the page's hero and the fill on its CTA.
          background: `linear-gradient(180deg, rgba(225,170,64,0) 0%, rgba(225,170,64,0.55) 50%, rgba(225,170,64,0) 100%)`,
        }}
      />

      {/* The read confirmation — the whole plate flashes amber once. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: T.amber,
          opacity: read * 0.24,
          borderRadius: 10,
        }}
      />
    </div>
  );
}
