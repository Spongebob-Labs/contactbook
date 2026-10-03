/**
 * Palette id → background hex. Mirrors apps/web/src/card/template-palettes.ts —
 * keep both in sync when palettes change.
 */
const PALETTE_HEX: Record<string, string> = {
  onyx: '#1a1a1a',
  sapphire: '#1B4F72',
  emerald: '#1E8449',
  oxblood: '#7B241C',
  rust: '#A04000',
  amber: '#D4AC0D',
  clay: '#C0392B',
  pistachio: '#58D68D',
  periwinkle: '#5D6D7E',
  mint: '#76D7C4',
  ivory: '#F9F6EE',
};

const TEMPLATE_DEFAULT_HEX: Record<string, string> = {
  meridian: '#1a1a1a',
  marigold: '#D4AC0D',
};

/** Resolves background hex in precedence order: groundHex > paletteId > templateId > fallback. */
export function resolveBackgroundHex(
  groundHex: string | null | undefined,
  paletteId: string | null | undefined,
  templateId: string | null | undefined,
): string {
  if (groundHex) return groundHex;
  if (paletteId && PALETTE_HEX[paletteId]) return PALETTE_HEX[paletteId];
  if (templateId && TEMPLATE_DEFAULT_HEX[templateId])
    return TEMPLATE_DEFAULT_HEX[templateId];
  return '#1a1a1a';
}

/** Converts #RRGGBB to {r,g,b}. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/** Relative luminance per WCAG 2.1. */
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hexToRgb(hex1));
  const l2 = luminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Returns `"rgb(r, g, b)"` string as Apple's pass.json expects. */
export function toPassRgb(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Returns foreground and label colours that meet WCAG AA (≥4.5:1) contrast
 * against the background hex. Always returns white or black.
 */
export function resolvePassColors(backgroundHex: string): {
  foregroundColor: string;
  labelColor: string;
} {
  const whiteContrast = contrastRatio(backgroundHex, '#ffffff');
  const fg = whiteContrast >= 4.5 ? '#ffffff' : '#000000';
  return {
    foregroundColor: toPassRgb(fg),
    labelColor: toPassRgb(fg),
  };
}
