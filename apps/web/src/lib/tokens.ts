/**
 * The app-chrome colour tokens, mirrored in TypeScript.
 *
 * `src/styles/tokens.css` is the source of truth for anything the browser paints;
 * this module exists because three things need the same values where no stylesheet
 * is available: the contrast contract tests (no DOM), the OpenGraph image route
 * (Satori, which resolves no custom properties), and the PNG exporter.
 *
 * `tests/contract/tokens.test.ts` fails the build the moment the two drift, in both
 * directions — every entry here must resolve to the same colour in the stylesheet, and
 * every colour literal declared in the stylesheet must appear here.
 *
 * ## Scope: app chrome only
 *
 * These are the white/near-monochrome tokens the product's furniture is built from.
 * Card colour is NOT here — it lives in `src/card/template-palettes.ts`, is per-card
 * data, and is validated by its own contract test. Do not add a template colour to this
 * file; the last build's mistake was putting both systems in one place, which forced
 * every template to be a variation on the app's own background.
 */

export type SurfaceToken = "canvas" | "surface" | "surface-sunk" | "surface-raised";
export type InkToken = "ink" | "ink-2" | "ink-3" | "ink-4" | "ink-inverse";
export type LineToken = "line" | "line-control";
export type AccentToken = "accent" | "accent-hover" | "accent-wash" | "accent-ink";
export type SignalToken =
  | "danger"
  | "danger-wash"
  | "warning-ink"
  | "warning-wash"
  | "success"
  | "success-wash";
export type QrToken = "qr-module" | "qr-plate";

export type ColourToken =
  | SurfaceToken
  | InkToken
  | LineToken
  | AccentToken
  | SignalToken
  | QrToken;

export type DesignTokens = Record<ColourToken, string>;

/**
 * Frozen so a consumer cannot mutate a shared token at runtime — the OpenGraph route and
 * the exporter both read this object on every request.
 *
 * `accent-ink` is the one alias: it is `--ink-inverse` by definition, not an independent
 * value, and the stylesheet declares it as `var(--ink-inverse)`. The drift test knows to
 * resolve one level of aliasing.
 */
export const TOKENS: DesignTokens = Object.freeze({
  /* Surfaces — Atelier (warm off-white + gold), the product-wide default since 2026-09-20.
     `canvas`/`surface-sunk` are `tokens.css`'s reuse of marketing's measured `--mk-paper` /
     `--mk-wash`; `surface-raised` mirrors `tokens.css`'s `var(--canvas)` alias verbatim, since
     this map only ever holds resolved colours. */
  canvas: "#FCFAF8",
  surface: "#F7F2ED",
  "surface-sunk": "#F2EAE1",
  "surface-raised": "#FCFAF8",

  /* Ink */
  ink: "#010103",
  "ink-2": "#3E3932",
  "ink-3": "#816544",
  "ink-4": "#A49F95",
  "ink-inverse": "#FFFFFF",

  /* Lines */
  line: "#E8E2DC",
  "line-control": "#897F73",

  /* Accent — dark axis (Atelier's `--mk-accent-deep`), never gold. See the hard-rule comment
     above `--accent` in tokens.css: gold under white text is the client reference's own
     illegal 2.27:1 control, and this product does not reproduce it. */
  accent: "#0D1C25",
  "accent-hover": "#050C10",
  "accent-wash": "#F2EAE1",
  "accent-ink": "#FFFFFF",

  /* Signals */
  danger: "#B42318",
  "danger-wash": "#FEF3F2",
  "warning-ink": "#7A4100",
  "warning-wash": "#FFFAEB",
  success: "#067647",
  "success-wash": "#ECFDF3",

  /* QR optical constants — identical on every template, never themed. */
  "qr-module": "#0B0B0B",
  "qr-plate": "#FFFFFF",
});

/** `cssVar('ink-3')` → `'var(--ink-3)'`. */
export function cssVar(name: ColourToken): string {
  return `var(--${name})`;
}

/** Inks permitted for body-sized text. `ink-4` is absent on purpose. */
export const BODY_TEXT_INKS: readonly InkToken[] = ["ink", "ink-2", "ink-3"];

/** Every ground body text is allowed to sit on. */
export const TEXT_GROUNDS: readonly SurfaceToken[] = [
  "canvas",
  "surface",
  "surface-sunk",
  "surface-raised",
];

/**
 * Never a text colour, at any size. `ink-4` is 2.53:1 on canvas and `line` is 1.24:1 —
 * both are for disabled states and decorative hairlines respectively, and
 * `tests/contract/contrast.test.ts` fails if either is asserted as body ink.
 */
export const DECORATIVE_ONLY: readonly ColourToken[] = ["ink-4", "line"];
