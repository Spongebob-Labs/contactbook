/**
 * The card palettes, copied from `apps/web/src/card/template-palettes.ts` (`ground`, `ink`,
 * `inkSoft`, plus the two gradient stops `from` / `to`). The pass must be the same colours as the
 * card on screen, so keep both in sync when a palette changes. `ground` is the midpoint of the
 * web's two-stop gradient and is what Wallet falls back to; the gradient itself is painted by the
 * pass's background image (see `pass-images.ts`).
 */
const PALETTES: Record<
  string,
  { ground: string; from: string; to: string; ink: string; inkSoft: string }
> = {
  onyx: {
    ground: '#181A1F',
    from: '#23262C',
    to: '#0D0E11',
    ink: '#FFFFFF',
    inkSoft: '#8D8E90',
  },
  sapphire: {
    ground: '#142C63',
    from: '#1B3B80',
    to: '#0C1D45',
    ink: '#FFFFFF',
    inkSoft: '#A2ABC1',
  },
  emerald: {
    ground: '#0D3C2E',
    from: '#12513E',
    to: '#07271E',
    ink: '#FFFFFF',
    inkSoft: '#AABBB6',
  },
  oxblood: {
    ground: '#5B1626',
    from: '#761D31',
    to: '#3F0F1B',
    ink: '#FFFFFF',
    inkSoft: '#BFA5AB',
  },
  rust: {
    ground: '#80371C',
    from: '#933E22',
    to: '#6D2F16',
    ink: '#FFFFFF',
    inkSoft: '#DFCDC6',
  },
  amber: {
    ground: '#E1AA40',
    from: '#EFBE55',
    to: '#D2952A',
    ink: '#0F1114',
    inkSoft: '#41351E',
  },
  clay: {
    ground: '#E3A28A',
    from: '#F0B7A2',
    to: '#D68C72',
    ink: '#0F1114',
    inkSoft: '#3E312E',
  },
  pistachio: {
    ground: '#BFD48C',
    from: '#D2E3A2',
    to: '#ACC576',
    ink: '#0F1114',
    inkSoft: '#464D39',
  },
  periwinkle: {
    ground: '#B4C1EC',
    from: '#C9D3F5',
    to: '#9FAFE2',
    ink: '#0F1114',
    inkSoft: '#3D4250',
  },
  mint: {
    ground: '#BFF6EC',
    from: '#EEFDFA',
    to: '#90F0DD',
    ink: '#0F1114',
    inkSoft: '#3C6B62',
  },
  ivory: {
    ground: '#E7D6BA',
    from: '#F2E7D3',
    to: '#DCC6A0',
    ink: '#0F1114',
    inkSoft: '#4F4229',
  },
};

/** The palette each template starts from (`apps/web/src/card/templates.ts`). */
const TEMPLATE_PALETTE: Record<string, string> = {
  meridian: 'sapphire',
  marigold: 'amber',
};

const FALLBACK_PALETTE = 'sapphire';

/**
 * Resolves the card's ground colour. Precedence matches the web
 * (`card-palette.ts`): `groundHex` (free colour) → `paletteId` → the template's palette.
 */
export function resolveBackgroundHex(
  groundHex: string | null | undefined,
  paletteId: string | null | undefined,
  templateId: string | null | undefined,
): string {
  if (groundHex) return groundHex;
  return PALETTES[resolvePaletteId(paletteId, templateId)].ground;
}

function resolvePaletteId(
  paletteId: string | null | undefined,
  templateId: string | null | undefined,
): string {
  if (paletteId && PALETTES[paletteId]) return paletteId;
  const fromTemplate = templateId ? TEMPLATE_PALETTE[templateId] : undefined;
  return fromTemplate && PALETTES[fromTemplate]
    ? fromTemplate
    : FALLBACK_PALETTE;
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

/** Linear blend of two hex colours, `t` = share of `b` (0..1). Returns `#RRGGBB`. */
function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const ch = (m: number, n: number) => Math.round(m + (n - m) * t);
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(ch(x.r, y.r))}${hex(ch(x.g, y.g))}${hex(ch(x.b, y.b))}`;
}

export interface PassTheme {
  /** `#RRGGBB` — the card ground (the gradient's midpoint). */
  backgroundHex: string;
  /** `#RRGGBB` — the gradient's two stops, light-to-deep along the card's raking light. */
  gradientFromHex: string;
  gradientToHex: string;
  /** `#RRGGBB` — primary text (the name). */
  inkHex: string;
  /** `#RRGGBB` — the muted second ink (the headline, labels). */
  inkSoftHex: string;
  /** The same three as Wallet's `rgb(r, g, b)` strings. */
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
}

/**
 * Everything the pass needs to look like the card: ground, primary ink and the muted ink.
 *
 * A named palette uses the web's own ink pair, so the two-tone type matches the card. A free
 * `groundHex` has no authored ink, so it gets black or white by WCAG contrast, and a muted ink
 * mixed 30% toward the ground — falling back to the full ink if that would drop under 4.5:1.
 */
export function resolvePassTheme(
  groundHex: string | null | undefined,
  paletteId: string | null | undefined,
  templateId: string | null | undefined,
): PassTheme {
  let backgroundHex: string;
  let gradientFromHex: string;
  let gradientToHex: string;
  let inkHex: string;
  let inkSoftHex: string;

  if (groundHex) {
    backgroundHex = groundHex;
    // No authored stops for a free colour: a touch lighter and a touch deeper, like the palettes.
    gradientFromHex = mixHex(groundHex, '#FFFFFF', 0.08);
    gradientToHex = mixHex(groundHex, '#000000', 0.18);
    inkHex = contrastRatio(groundHex, '#ffffff') >= 4.5 ? '#FFFFFF' : '#0F1114';
    const soft = mixHex(inkHex, groundHex, 0.3);
    inkSoftHex = contrastRatio(groundHex, soft) >= 4.5 ? soft : inkHex;
  } else {
    const palette = PALETTES[resolvePaletteId(paletteId, templateId)];
    backgroundHex = palette.ground;
    gradientFromHex = palette.from;
    gradientToHex = palette.to;
    inkHex = palette.ink;
    inkSoftHex = palette.inkSoft;
  }

  return {
    backgroundHex,
    gradientFromHex,
    gradientToHex,
    inkHex,
    inkSoftHex,
    backgroundColor: toPassRgb(backgroundHex),
    foregroundColor: toPassRgb(inkHex),
    labelColor: toPassRgb(inkSoftHex),
  };
}
