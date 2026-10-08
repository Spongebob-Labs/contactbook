import type { ReactElement } from "react";

import type { HeroPhoneIcon, HeroPhoneSocial } from "@/fixtures/marketing";

/**
 * The hero phone card's glyphs — redrawn off the client's reference, not taken from a set.
 *
 * Each was rendered at the reference's size beside a 6× crop of the reference and iterated
 * until the two overlaid (ink centroids within ~0.3px). Only the chevron matched a library icon
 * (lucide `ChevronRight`, used directly in `hero-card.tsx`); every lucide candidate for the rest
 * failed on a visible detail — `Phone` is a boxy outline where the reference draws a filled
 * handset, `Mail` has no lower folds, `MapPin` is too squat, `Building2` has wings, `Link` is
 * two open arcs, and `ArrowRight`'s head is too big.
 *
 * ⚠ THE SET MIXES STYLES ON PURPOSE. Phone and pin are FILLED; envelope, building and link are
 * OUTLINE — the way SF Symbols mixes them, and the way the reference draws them. Drawing all
 * five in one monoline weight is exactly what made the previous card's rows read flat. The two
 * styles carry two inks in the stylesheet (`--mk-phone-icon` / `--mk-phone-icon-line`) because
 * the reference's filled glyphs measure lighter than its outline ones.
 *
 * ⚠ THE SOCIAL MARKS ARE THE FILLED BRAND MARKS, NOT `card/social-glyphs.tsx`. The product's
 * own set is line art (LinkedIn in a box, an outlined YouTube); the reference prints the real
 * filled marks — bare "in", the official X, filled YouTube. LinkedIn and YouTube are Simple
 * Icons paths (CC0), the YouTube one scaled 0.79 about its centre; X is the official logo path.
 *
 * All glyphs are `viewBox="0 0 24 24"` and paint in `currentColor`; size and colour live in
 * `marketing-hero.css`. Every one is decorative — the card is `inert` and captioned.
 */

type Glyph = ReactElement;

function frame(className: string, body: ReactElement): Glyph {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}

export const ROW_GLYPHS: Readonly<Record<HeroPhoneIcon, Glyph>> = {
  /* A classic tilted handset, symmetric about x+y=24 — bulbous cups, thin spine. */
  phone: frame(
    "mk-hc-glyph mk-hc-glyph--fill",
    <path d="M6.10 2.85C7.19 2.88 9.02 5.36 9.55 6.60C10.08 7.84 9.04 9.25 9.30 10.30C9.56 11.35 10.37 12.17 11.10 12.90C11.83 13.63 12.65 14.44 13.70 14.70C14.75 14.96 16.16 13.92 17.40 14.45C18.64 14.98 21.12 16.81 21.15 17.90C21.18 18.99 18.96 20.71 17.60 21.00C16.24 21.29 14.64 20.44 13.00 19.65C11.36 18.86 9.19 17.69 7.75 16.25C6.31 14.81 5.14 12.64 4.35 11.00C3.56 9.36 2.71 7.76 3.00 6.40C3.29 5.04 5.01 2.82 6.10 2.85Z" />,
  ),
  /* A flat 1.36:1 envelope; the flap meets 58% down and the lower folds run to its arms. */
  /* Drawn in the FILLED glyphs' lighter gold, not the outline ink: the reference's envelope
     is a mid-gold line (measured 1.33× too heavy and ΔE 17.9 too dark when it shared the
     building's ink). */
  mail: frame(
    "mk-hc-glyph mk-hc-glyph--line mk-hc-glyph--light",
    <>
      <rect x="3.1" y="6.0" width="18.2" height="12.9" rx="1" strokeWidth="1.25" />
      <path d="m3.6 6.55 8.6 7 8.6-7" strokeWidth="1.1" />
      <path d="m3.6 18.35 6.3-6.2M20.8 18.35l-6.3-6.2" strokeWidth="1.1" />
    </>,
  ),
  /* A teardrop with a hole — and the hole is BRIGHTER than the disc in the reference, a
     highlight rather than a window, so it is its own shape. */
  pin: frame(
    "mk-hc-glyph mk-hc-glyph--fill",
    <>
      <path
        fillRule="evenodd"
        d="M12 1.8a7.27 7.27 0 0 0-7.27 7.27c0 5.2 7.27 13.13 7.27 13.13s7.27-7.93 7.27-13.13A7.27 7.27 0 0 0 12 1.8Zm0 4.32A2.75 2.75 0 1 1 12 11.82 2.75 2.75 0 0 1 12 6.12Z"
      />
      <circle className="mk-hc-glyph__hole" cx="12" cy="8.97" r="2.75" />
    </>,
  ),
  /* A tower with two thin columns, a short annex and a heavy ground line — square joins. */
  building: frame(
    "mk-hc-glyph mk-hc-glyph--line mk-hc-glyph--square",
    <>
      <path d="M2.5 20.05h19" strokeWidth="2.7" />
      <path d="M5.95 19V3.5h10.2V19" strokeWidth="2" />
      <path d="M16.15 8.1h3.2V19" strokeWidth="2" />
      <path d="M8.8 6.6V19M12.55 6.6V19" strokeWidth="1.35" />
    </>,
  ),
  /* Two closed pills at −48°, overlapping only at their tips. */
  link: frame(
    "mk-hc-glyph mk-hc-glyph--line",
    <>
      <rect
        x="-5.94"
        y="-3.855"
        width="11.88"
        height="7.71"
        rx="3.855"
        transform="translate(14.84 8.71) rotate(-48)"
        strokeWidth="1.8"
      />
      <rect
        x="-5.94"
        y="-3.855"
        width="11.88"
        height="7.71"
        rx="3.855"
        transform="translate(9.16 15.29) rotate(-48)"
        strokeWidth="1.8"
      />
    </>,
  ),
  /* 2026-10-06 — two glyphs the reference never drew, for the brand card's other uses (the
     Solution deck and the How-it-works panels carry a birthday, a job title and experience).
     Same construction as `link` and `building`: outline ink, ~1.8px strokes, 24-unit box. */
  /* A wall calendar: a rounded sheet, a header rule and two binding rings. */
  calendar: frame(
    "mk-hc-glyph mk-hc-glyph--line",
    <>
      <rect x="3.6" y="5.2" width="16.8" height="15.2" rx="2.2" strokeWidth="1.8" />
      <path d="M3.6 10h16.8" strokeWidth="1.6" />
      <path d="M8.2 3.2v3.8M15.8 3.2v3.8" strokeWidth="1.8" />
    </>,
  ),
  /* A briefcase: a body, a handle and the clasp line across the middle. */
  briefcase: frame(
    "mk-hc-glyph mk-hc-glyph--line",
    <>
      <rect x="3.2" y="7.2" width="17.6" height="12.6" rx="2" strokeWidth="1.8" />
      <path d="M9 7.2V5.4a1.4 1.4 0 0 1 1.4-1.4h3.2A1.4 1.4 0 0 1 15 5.4v1.8" strokeWidth="1.7" />
      <path d="M3.2 12.6h17.6" strokeWidth="1.5" />
    </>,
  ),
  /* A document: a sheet with a folded corner and two text lines — the CV card's row. */
  document: frame(
    "mk-hc-glyph mk-hc-glyph--line",
    <>
      <path d="M6.2 3h7.6l4.4 4.4V19.6a1.4 1.4 0 0 1-1.4 1.4H6.2a1.4 1.4 0 0 1-1.4-1.4V4.4A1.4 1.4 0 0 1 6.2 3Z" strokeWidth="1.8" />
      <path d="M13.6 3.2v4.4h4.4" strokeWidth="1.5" />
      <path d="M8.2 12.4h7.6M8.2 15.9h5.2" strokeWidth="1.5" />
    </>,
  ),
};

export const SOCIAL_MARKS: Readonly<Record<HeroPhoneSocial, Glyph>> = {
  linkedin: frame(
    "mk-hc-mark",
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />,
  ),
  instagram: frame(
    "mk-hc-mark mk-hc-mark--line",
    <>
      <rect x="3.96" y="3.96" width="16.08" height="16.08" rx="3.88" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.68" strokeWidth="1.6" />
      <circle className="mk-hc-mark__dot" cx="16.79" cy="7.33" r="0.96" />
    </>,
  ),
  /* The official X path, with a 0.45u stroke that matches the reference's heavier weight. */
  x: frame(
    "mk-hc-mark mk-hc-mark--x",
    <path d="M13.555 10.721 19.638 3.65h-1.442l-5.282 6.14L8.695 3.65H3.83l6.379 9.285L3.83 20.35h1.441l5.578-6.484 4.456 6.484h4.865zm-1.975 2.295-.646-.924-5.143-7.357h2.214l4.15 5.937.647.925 5.395 7.717h-2.214z" />,
  ),
  youtube: frame(
    "mk-hc-mark",
    <path
      fillRule="evenodd"
      d="M21.103 7.397a2.388 2.388 0 0 0-1.68-1.691C17.941 5.306 12 5.306 12 5.306s-5.941 0-7.423.4A2.388 2.388 0 0 0 2.897 7.397C2.5 8.889 2.5 12 2.5 12s0 3.111.397 4.603a2.388 2.388 0 0 0 1.68 1.691c1.481.4 7.423.4 7.423.4s5.941 0 7.423-.4a2.387 2.387 0 0 0 1.68-1.691C21.5 15.111 21.5 12 21.5 12s0-3.111-.397-4.603zM10.056 14.825V9.175L15.023 12z"
    />,
  ),
};

/**
 * The button's leading glyph — a phone outline with its right wall broken where an arrow
 * leaves, plus the earpiece dash and home dot. Not lucide `Smartphone` + an arrow: the break in
 * the wall is the drawing.
 */
export const SEND_GLYPH: Glyph = (
  <svg className="mk-hc-action__send" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M15.4 7.84V3.05a1.89 1.89 0 0 0-1.89-1.89H4.86a1.89 1.89 0 0 0-1.89 1.89v17.9a1.89 1.89 0 0 0 1.89 1.89h8.65a1.89 1.89 0 0 0 1.89-1.89V16.5" strokeWidth="1.41" />
    <path d="M12.09 12.1h9.41M18.05 8.65l3.45 3.45-3.45 3.45" strokeWidth="1.25" />
    <path d="M8.9 3.4h.46" strokeWidth="0.9" />
    <circle className="mk-hc-action__dot" cx="9.13" cy="20.27" r="0.86" />
  </svg>
);

/** The button's trailing arrow — its head is 0.44× the shaft, where lucide's is 0.5×. */
export const ARROW_GLYPH: Glyph = (
  <svg className="mk-hc-action__arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5.4 12h13.7M13.6 6l5.5 6-5.5 6" strokeWidth="1.45" />
  </svg>
);
