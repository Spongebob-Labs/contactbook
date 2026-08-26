/**
 * The marketing palette, mirrored for Remotion.
 *
 * Remotion renders in a headless browser that never loads the web app's stylesheet, so these
 * values are duplicated rather than imported. They are duplicated DELIBERATELY and the
 * duplication is one-directional: `apps/web/src/styles/marketing.css` is the source of truth
 * and this file follows it. Every value below is copied from there, including the derived ones,
 * so a colour that was searched for to satisfy a contrast contract keeps that property here.
 *
 * ⚠ **A DUPLICATE IS A MIRROR ONLY WHILE SOMEBODY RE-RENDERS IT.** This file lagged the
 * stylesheet by exactly one redesign: marketing dropped its invented hues for the product's
 * nine card grounds, the sky went from azure→cyan to Sapphire→Onyx, and the already-rendered
 * `hero-loop.webm` kept painting the old sky — so the film sat on the page as a bright blue
 * rectangle inside a deep navy one. Editing these constants is HALF the change. The other half
 * is `pnpm render`, `pnpm render:webm` and `pnpm still`, and the page ships the mismatch until
 * all three have run.
 */

export const T = {
  /* The sky — SAPPHIRE to ONYX, two card grounds, matching `--mk-sky-zenith` /
     `--mk-sky-horizon`. It deepens as it descends, so white clears 13.37:1 at its lightest
     point; the old ramp brightened to a cyan horizon where white measured 2.37:1.

     `skyMid` is gone with the stylesheet's third stop: Sapphire and Onyx are one hue family
     two luminance steps apart, and a middle stop between them is a value the eye cannot
     find. It existed because the old ramp crossed from blue to cyan and needed steering. */
  skyZenith: "#142c63",
  skyHorizon: "#181a1f",

  /* The meadow beneath it — EMERALD's own two gradient stops, matching `--mk-field-near` /
     `--mk-field-far`. Unused by `Stage` (see its comment: the film carries no landscape,
     because the PAGE owns the world), and kept in step anyway so this file stays a mirror
     rather than a partial one. */
  fieldNear: "#12513e",
  fieldFar: "#07271e",

  ink: "#181a1f",
  paper: "#f5f5f5",
  white: "#ffffff",
  stone: "#766f65",
  pebble: "#72706f",
  hairline: "#e3e1de",

  /* The accents, from the same nine. `lime`, `azure`, `teal`, `coral` and `orchid` are gone
     with their tokens. */
  sapphire: "#142c63",
  emerald: "#0d3c2e",
  oxblood: "#5b1626",
  rust: "#80371c",
  amber: "#e1aa40",
  amberDeep: "#3a2408",

  /* The card's own palette — Sapphire, from the product's palette registry. A card in the
     hero must be a real card, and a real card wears one of the nine. */
  cardGround: "#12305e",
  cardGroundTo: "#1e4f96",
  cardInk: "#ffffff",
  cardInkSoft: "#b9cbe6",
  cardChipBg: "#c9dbf5",
  cardChipInk: "#12305e",
} as const;

export const SKY = `linear-gradient(180deg, ${T.skyZenith} 0%, ${T.skyHorizon} 100%)`;
export const FIELD = `linear-gradient(180deg, ${T.fieldNear} 0%, ${T.fieldFar} 100%)`;
export const CARD = `linear-gradient(155deg, ${T.cardGround} 0%, ${T.cardGroundTo} 100%)`;

/** The one shadow in the film, so nothing invents a second depth system. */
export const LIFT = "0 40px 80px -24px rgba(9, 24, 48, 0.55), 0 12px 24px -12px rgba(9, 24, 48, 0.4)";
