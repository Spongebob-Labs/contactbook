import type { ReactElement } from "react";

/**
 * THE SOCIAL MARKS — one glyph per platform `parseSocialLink` recognises, and a fallback.
 *
 * ## Why this file exists
 *
 * `lucide-react` shipped brand icons once and does not any more: the installed 1.34.0 carries
 * 4,070 icons and not one of them is a logo. So every `SOCIAL_LINK` on the card rendered the
 * same generic `@`, and a strip of six identical circles tells a reader nothing about which one
 * is LinkedIn. These are the marks that strip needs.
 *
 * ## ⚠ Keyed by the PLATFORM NAME, not by hostname
 *
 * `SOCIAL_PLATFORMS` in `src/lib/format.ts` maps hosts to names — `x.com` AND `twitter.com` both
 * resolve to `"X"` — and `parseSocialLink` returns that name. Keying on the name rather than on
 * the host means the two spellings of X share one glyph by construction, and adding a new host
 * for an existing platform needs no change here at all.
 *
 * An unknown host keeps its bare hostname as its `platform`, misses this table, and gets
 * {@link GENERIC_GLYPH}. That is the E-23 path and it is deliberately not an error: a card
 * carrying a link to a niche network still shows a circle in the strip rather than a hole.
 *
 * ## Why these are line art and not the official filled logos
 *
 * Every other icon on the card page comes from lucide — 1.75px monoline on a 24 grid. Dropping
 * fourteen solid-filled brand logos into that strip would put two icon languages on one card,
 * and the filled marks would read two weights heavier than the field rows directly above them.
 * These are drawn to lucide's own metrics so the strip belongs to the card.
 *
 * They are also, deliberately, constructed from primitives — rects, circles and short paths —
 * rather than transcribed logo outlines. A mistyped coordinate in a 700-character logo path
 * fails silently as a blank circle; a mistyped circle is visible the moment it is drawn.
 */

/** lucide's own drawing metrics, so the strip matches the icons in the field rows. */
const STROKE = 1.75;

function frame(children: ReactElement): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="100%"
      height="100%"
    >
      {children}
    </svg>
  );
}

/** Anything we do not recognise. Never null — the strip must not grow a hole (E-23). */
export const GENERIC_GLYPH: ReactElement = frame(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
  </>,
);

/**
 * The marks, keyed by `SocialLinkParts.platform`.
 *
 * ⚠ Every key here must be a VALUE in `SOCIAL_PLATFORMS` (`src/lib/format.ts`), and
 * `tests/contract/social-glyphs.test.ts` asserts exactly that in both directions — a platform
 * the parser names and this table misses would silently fall back to the generic mark, and a key
 * here that no host maps to is dead code nothing can reach.
 */
export const SOCIAL_GLYPHS: Readonly<Record<string, ReactElement>> = {
  LinkedIn: frame(
    <>
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" />
      <path d="M7 10.5v7" />
      <circle cx="7" cy="7.2" r="0.9" fill="currentColor" stroke="none" />
      <path d="M11.5 17.5v-7M11.5 13.2a2.7 2.7 0 0 1 5.4 0v4.3" />
    </>,
  ),

  X: frame(
    <>
      <path d="M4 3h3.6l4.7 6.3L17.9 3H21l-7.1 8.1L21.4 21h-3.6l-5-6.7L6.7 21H3.6l7.4-8.5z" />
    </>,
  ),

  Instagram: frame(
    <>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </>,
  ),

  GitHub: frame(
    <>
      <path d="M9 19.5c-4.6 1.4-4.6-2.4-6.5-3m13 6v-3.6a3.2 3.2 0 0 0-.9-2.4c3-.3 6.2-1.5 6.2-6.7a5.2 5.2 0 0 0-1.4-3.6 4.9 4.9 0 0 0-.1-3.6s-1.1-.3-3.8 1.4a13 13 0 0 0-6.8 0C6 2.2 4.9 2.5 4.9 2.5a4.9 4.9 0 0 0-.1 3.6A5.2 5.2 0 0 0 3.4 9.8c0 5.2 3.2 6.4 6.2 6.7a3.2 3.2 0 0 0-.9 2.4V22" />
    </>,
  ),

  Facebook: frame(
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M15 8.2h-1.6a1.9 1.9 0 0 0-1.9 1.9V21.4M9.6 13.4h5.2" />
    </>,
  ),

  YouTube: frame(
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.3 9.6l5 2.4-5 2.4z" fill="currentColor" stroke="none" />
    </>,
  ),

  /* The ring is deliberately OPEN at the upper right — that gap is what separates this mark
     from the generic `@` fallback at 20px, where both reduce to a circle with something in it. */
  Threads: frame(
    <>
      <path d="M17.6 4.4A8.8 8.8 0 1 0 14.6 20.9" />
      <path d="M9.3 14.3c.3 1.6 1.8 2.5 3.5 2.4 2.3-.1 3.8-1.7 4-4.7.2-2.9-1.5-4.5-4-4.5-1.7 0-3 .7-3.7 1.7" />
      <path d="M16.8 12c2.2.5 3.5 1.9 3.5 3.9 0 3.4-2.9 5.6-7.4 5.6" />
    </>,
  ),

  TikTok: frame(
    <>
      <path d="M14.5 2.5v12.2a4.2 4.2 0 1 1-4.2-4.2" />
      <path d="M14.5 2.5a5.3 5.3 0 0 0 5.3 5.3" />
    </>,
  ),

  WhatsApp: frame(
    <>
      <path d="M3 21l1.5-4.4A8.8 8.8 0 1 1 7.9 20z" />
      <path d="M8.6 9.1c0 3.2 2.6 5.8 5.8 5.8l1.3-1.6-2-1-1 1a5.5 5.5 0 0 1-2.5-2.5l1-1-1-2z" />
    </>,
  ),

  Telegram: frame(
    <>
      <path d="M21.5 3.6 2.9 10.8l5.1 1.8 1.9 6 2.9-3.4" />
      <path d="M8 12.6 21.5 3.6 18 20.4l-8.1-6" />
    </>,
  ),

  Medium: frame(
    <>
      <ellipse cx="7" cy="12" rx="4.5" ry="5.6" />
      <ellipse cx="16.1" cy="12" rx="1.9" ry="5.6" />
      <ellipse cx="21.2" cy="12" rx="0.8" ry="5.6" />
    </>,
  ),

  Substack: frame(
    <>
      <path d="M4.5 4.5h15M4.5 9.2h15" />
      <path d="M4.5 13.4h15v6.1L12 16l-7.5 3.5z" />
    </>,
  ),

  /* Three seams, and their endpoints matter more than their curvature: each one has to run OFF
     the ball rather than stop inside it, or the mark reads as a scribble in a circle. */
  Dribbble: frame(
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M19.1 5.1C15.2 9.1 10 10.4 2.3 10.9" />
      <path d="M21.8 12.8c-6.6-1.4-12.1 1-16.4 6.3" />
      <path d="M8.6 2.8c4.4 6 6 9.4 8 17.7" />
    </>,
  ),

  Behance: frame(
    <>
      <path d="M2.5 6.6h4.8a2.6 2.6 0 0 1 0 5.2H2.5zM2.5 11.8h5.3a2.8 2.8 0 0 1 0 5.6H2.5z" />
      <path d="M14 13.6h7.5a3.8 3.8 0 1 0-7.5 0 3.8 3.8 0 0 0 6.7 2.4" />
      <path d="M15.4 7.2h4.8" />
    </>,
  ),
};

/**
 * The glyph for a platform name, never null.
 *
 * Exact match only — no lowercasing, no fuzzy matching. `parseSocialLink` returns either a
 * value straight out of `SOCIAL_PLATFORMS` or a bare hostname, so a case-insensitive lookup
 * would only ever change behaviour for a hostname that happened to spell a brand, which is
 * the one case where guessing is actively wrong.
 */
export function socialGlyph(platform: string): ReactElement {
  return SOCIAL_GLYPHS[platform] ?? GENERIC_GLYPH;
}
