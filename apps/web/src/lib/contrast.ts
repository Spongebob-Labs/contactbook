/**
 * WCAG 2.x contrast maths — pure, dependency-free.
 *
 * This module gates the palette (AC-13) and the per-template pixel audit (AC-14), so it
 * is deliberately the simplest possible transcription of the specification rather than a
 * clever one. See https://www.w3.org/TR/WCAG22/#dfn-relative-luminance and
 * https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio.
 */

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Three- or six-digit hex → `[0-255, 0-255, 0-255]`. */
export function parseHex(hex: string): [number, number, number] {
  const trimmed = hex.trim();
  if (!HEX.test(trimmed)) {
    throw new Error(`Not a #RGB or #RRGGBB colour: "${hex}"`);
  }

  const digits =
    trimmed.length === 4
      ? trimmed
          .slice(1)
          .split("")
          .map((d) => d + d)
          .join("")
      : trimmed.slice(1);

  return [
    Number.parseInt(digits.slice(0, 2), 16),
    Number.parseInt(digits.slice(2, 4), 16),
    Number.parseInt(digits.slice(4, 6), 16),
  ];
}

/** sRGB 8-bit channel → linear-light channel. */
export function linearise(channel8Bit: number): number {
  const c = channel8Bit / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of an sRGB colour, in `[0, 1]`. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearise);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between two colours, in `[1, 21]`. Order-independent: the lighter
 * colour is always the numerator.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.2 AA thresholds this design system is held to (spec §8.3, AC-13). */
export const AA_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;
export const AA_NON_TEXT = 3;

/** `true` when `ink` clears AA for body text on `ground`. */
export function meetsBodyText(ink: string, ground: string): boolean {
  return contrastRatio(ink, ground) >= AA_TEXT;
}

/** `true` when a boundary/graphic clears the 1.4.11 non-text bar on `ground`. */
export function meetsNonText(mark: string, ground: string): boolean {
  return contrastRatio(mark, ground) >= AA_NON_TEXT;
}
