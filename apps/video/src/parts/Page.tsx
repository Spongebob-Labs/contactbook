import { interpolate, spring } from "remotion";

import { T } from "../theme";

export const PAGE_W = 420;

/**
 * The card page — what a scan actually lands on.
 *
 * The product's real model: a stack of action buttons, one per field, each naming its ACTION
 * rather than showing its value. That distinction is the product's most contested design
 * decision, so the film shows it rather than quietly rendering a tidy list of values that
 * would be easier to read and would not be the product.
 */
/*
 * The four tints were azure / teal / coral / amber — the marketing layer's own invented
 * marker set. They are four of the product's nine card grounds now, matching
 * `assistant.tsx`'s node rings on the page: Sapphire, Emerald, Oxblood, Rust. Deep swatches on
 * a paper row read as material samples rather than as status lights, which is what a row of
 * saturated dots on white always ends up looking like.
 */
const ROWS = [
  { label: "Call", tint: T.sapphire },
  { label: "WhatsApp", tint: T.emerald },
  { label: "Email", tint: T.oxblood },
  { label: "Save to contacts", tint: T.rust },
] as const;

export function Page({
  frame,
  fps,
  updated,
  updatePulse,
}: {
  frame: number;
  fps: number;
  updated: boolean;
  updatePulse: number;
}) {
  return (
    <div
      style={{
        width: PAGE_W,
        borderRadius: 34,
        background: T.white,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* The palette band the real page carries at its head. */}
      <div
        style={{
          background: `linear-gradient(160deg, ${T.cardGround}, ${T.cardGroundTo})`,
          padding: "30px 28px 26px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: "50%",
            background: "linear-gradient(160deg,#e8dcc4,#b9a888)",
            border: "3px solid rgba(255,255,255,0.4)",
          }}
        />
        <div style={{ color: T.white, fontSize: 27, fontWeight: 600, marginTop: 12 }}>
          Priyanka Raghunathan
        </div>
        <div style={{ color: T.cardInkSoft, fontSize: 16, marginTop: 4 }}>
          Head of Partnerships
        </div>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {ROWS.map((row, i) => {
          // Each row arrives on its own spring, 3 frames apart. Staggered, not simultaneous:
          // four buttons appearing at once reads as one block sliding, which loses the
          // "one per field you added" idea the stack is there to communicate.
          const enter = spring({
            frame: frame - 6 - i * 3,
            fps,
            config: { damping: 200 },
          });
          return (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: T.paper,
                border: `1px solid ${T.hairline}`,
                borderRadius: 14,
                padding: "15px 18px",
                opacity: enter,
                transform: `translateY(${interpolate(enter, [0, 1], [16, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: row.tint,
                  flexShrink: 0,
                }}
              />
              <div style={{ color: T.ink, fontSize: 19, fontWeight: 500 }}>{row.label}</div>
            </div>
          );
        })}

        {/* The update landing. It was a lime chip carrying near-black at 12.25:1; it is the
            action colour now — Amber with Amber's own button ink, the pair every Amber card
            ships, measured at 6.98:1. Still a filled chip with dark type on it rather than
            white text on a green pill nobody can read at 400px wide. */}
        <div
          style={{
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: T.amber,
            borderRadius: 12,
            padding: "12px 16px",
            opacity: updated ? updatePulse : 0,
            transform: `scale(${interpolate(updatePulse, [0, 1], [0.94, 1])})`,
          }}
        >
          <Tick />
          <div style={{ color: T.amberDeep, fontSize: 17, fontWeight: 600 }}>
            New number saved
          </div>
        </div>
      </div>
    </div>
  );
}

/** Drawn, not a glyph — a unicode check standing in for an icon is a costume. */
function Tick() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <path
        d="M4 10.5L8 14.5L16 5.5"
        stroke={T.ink}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
