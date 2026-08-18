import type {
  CardBackground,
  CardFontPair,
  CardTheme,
} from "@/lib/card-schema";

/**
 * The theme library.
 *
 * This is the whole trick behind "tremendous customizability": layouts are
 * code, themes are data. A new theme is an object literal in the array below —
 * no component, no migration, no release coupling. Linktree's ~40 templates are
 * really one layout crossed with many themes, and this is that mechanism.
 *
 * Anything visual that a user can change belongs here or in `CardTheme`. If you
 * find yourself adding a `layout === "x"` branch to express a *look*, it should
 * probably have been a theme token instead.
 */

export type CardThemePreset = CardTheme & { label: string };

/* ------------------------------------------------------------------ colour */

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

/** Same hue at a chosen alpha — used for muted text, hairlines and soft fills. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** WCAG relative luminance, so contrast decisions are measured rather than guessed. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * The luminance at which white and black text are equally legible.
 *
 * Solve (1.05)/(L+0.05) = (L+0.05)/0.05 → L = √0.0525 − 0.05 ≈ 0.179. Guessing
 * a higher threshold (0.45 is a tempting round number) puts white text on
 * mid-tone fills like brass or amber, which lands around 2.3:1.
 */
const TEXT_FLIP_LUMINANCE = 0.179;

/** Black or white, whichever is legible on the given fill. */
export function readableOn(hex: string): string {
  return relativeLuminance(hex) > TEXT_FLIP_LUMINANCE ? "#111111" : "#FFFFFF";
}

/* ------------------------------------------------------------------- fonts */

/**
 * Only Inter ships with the app today, so the rest resolve to system stacks
 * that carry the right *character*. Dropping real webfonts in later is a change
 * to this map alone — published cards reference the pairing id, not a typeface.
 */
const FONT_STACKS: Record<CardFontPair, { heading: string; body: string }> = {
  sans: {
    heading: '"Inter", system-ui, -apple-system, sans-serif',
    body: '"Inter", system-ui, -apple-system, sans-serif',
  },
  "serif-display": {
    heading: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    body: '"Inter", system-ui, -apple-system, sans-serif',
  },
  serif: {
    heading: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    body: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  },
  geometric: {
    heading: '"Avenir Next", "Century Gothic", "Inter", system-ui, sans-serif',
    body: '"Avenir Next", "Century Gothic", "Inter", system-ui, sans-serif',
  },
  humanist: {
    heading: '"Optima", "Gill Sans", "Inter", system-ui, sans-serif',
    body: '"Optima", "Gill Sans", "Inter", system-ui, sans-serif',
  },
  mono: {
    heading: '"SF Mono", "JetBrains Mono", ui-monospace, monospace',
    body: '"SF Mono", "JetBrains Mono", ui-monospace, monospace',
  },
};

/* ----------------------------------------------------------------- corners */

const CORNER_RADII = {
  sharp: "0px",
  soft: "8px",
  round: "16px",
  pill: "999px",
} as const;

/* -------------------------------------------------------------- background */

export function backgroundCss(background: CardBackground): string {
  if (background.kind === "solid") {
    return background.color;
  }
  if (background.kind === "gradient") {
    return `linear-gradient(${background.angle}deg, ${background.from} 0%, ${background.to} 100%)`;
  }
  return `url(${background.url}) center / cover no-repeat`;
}

/** Representative flat colour of a background — what "is this dark?" resolves against. */
export function backgroundBaseColor(background: CardBackground): string {
  if (background.kind === "solid") {
    return background.color;
  }
  if (background.kind === "gradient") {
    return background.from;
  }
  // An image's average brightness is unknowable here, so assume dark: the
  // overlay scrim exists precisely to make that assumption safe.
  return "#111111";
}

/* ------------------------------------------------------------------ tokens */

export type CardTokens = {
  background: string;
  /** Scrim over an image background so text stays legible. */
  overlay: string | null;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  hairline: string;
  /** Panel fill for layouts that float a surface over the background. */
  surface: string;
  surfaceBorder: string;
  radius: string;
  /** Avatars and social chips stay circular regardless of the corner setting. */
  button: {
    background: string;
    color: string;
    border: string;
    shadow: string;
  };
  fontHeading: string;
  fontBody: string;
  isDark: boolean;
};

export function resolveCardTokens(theme: CardTheme): CardTokens {
  const base = backgroundBaseColor(theme.background);
  const isDark = relativeLuminance(base) < 0.45;
  const fonts = FONT_STACKS[theme.fontPair];

  return {
    background: backgroundCss(theme.background),
    overlay:
      theme.background.kind === "image" && theme.background.overlay > 0
        ? `rgba(0, 0, 0, ${theme.background.overlay})`
        : null,
    text: theme.textColor,
    textMuted: withAlpha(theme.textColor, 0.72),
    textFaint: withAlpha(theme.textColor, 0.5),
    accent: theme.accent,
    hairline: withAlpha(theme.textColor, 0.16),
    surface: isDark
      ? withAlpha("#FFFFFF", 0.08)
      : withAlpha("#FFFFFF", 0.82),
    surfaceBorder: withAlpha(theme.textColor, 0.12),
    radius: CORNER_RADII[theme.corners],
    button: resolveButton(theme),
    fontHeading: fonts.heading,
    fontBody: fonts.body,
    isDark,
  };
}

function resolveButton(theme: CardTheme): CardTokens["button"] {
  switch (theme.buttonStyle) {
    case "outline":
      return {
        background: "transparent",
        color: theme.textColor,
        border: `1px solid ${withAlpha(theme.textColor, 0.38)}`,
        shadow: "none",
      };
    case "soft":
      return {
        background: withAlpha(theme.accent, 0.18),
        color: theme.textColor,
        border: "1px solid transparent",
        shadow: "none",
      };
    case "shadow":
      return {
        background: theme.accent,
        color: readableOn(theme.accent),
        border: `1px solid ${theme.textColor}`,
        // Hard offset, no blur — the brutalist look depends on the crisp edge.
        shadow: `4px 4px 0 0 ${theme.textColor}`,
      };
    case "filled":
    default:
      return {
        background: theme.accent,
        color: readableOn(theme.accent),
        border: "1px solid transparent",
        shadow: "none",
      };
  }
}

/* ------------------------------------------------------------------ presets */

const solid = (color: string): CardBackground => ({ kind: "solid", color });
const gradient = (
  from: string,
  to: string,
  angle = 160,
): CardBackground => ({ kind: "gradient", from, to, angle });

export const CARD_THEMES: CardThemePreset[] = [
  // Dark solids
  { id: "midnight", label: "Midnight", background: solid("#1B2430"), textColor: "#F8F7F4", accent: "#C4A882", fontPair: "sans", buttonStyle: "filled", corners: "round" },
  { id: "obsidian", label: "Obsidian", background: solid("#0B0B0C"), textColor: "#FAFAFA", accent: "#E5E5E5", fontPair: "geometric", buttonStyle: "outline", corners: "sharp" },
  { id: "forest", label: "Forest", background: solid("#14342A"), textColor: "#F1F6F2", accent: "#8FD3A8", fontPair: "sans", buttonStyle: "filled", corners: "round" },
  { id: "burgundy", label: "Burgundy", background: solid("#4A1F2B"), textColor: "#FBF3F4", accent: "#E0A2AE", fontPair: "serif-display", buttonStyle: "soft", corners: "soft" },
  { id: "navy", label: "Navy", background: solid("#14213D"), textColor: "#F6F7FB", accent: "#FCA311", fontPair: "sans", buttonStyle: "filled", corners: "soft" },
  { id: "slate", label: "Slate", background: solid("#2F3640"), textColor: "#F2F4F7", accent: "#A9B4C2", fontPair: "humanist", buttonStyle: "outline", corners: "round" },

  // Light and paper
  { id: "paper", label: "Paper", background: solid("#F7F5EF"), textColor: "#221F1A", accent: "#8A6A3B", fontPair: "serif", buttonStyle: "outline", corners: "sharp" },
  { id: "porcelain", label: "Porcelain", background: solid("#FFFFFF"), textColor: "#111111", accent: "#2563EB", fontPair: "sans", buttonStyle: "filled", corners: "round" },
  { id: "linen", label: "Linen", background: solid("#F2EDE4"), textColor: "#33302B", accent: "#A8632B", fontPair: "serif-display", buttonStyle: "soft", corners: "soft" },
  { id: "mist", label: "Mist", background: solid("#EEF2F6"), textColor: "#1E2A36", accent: "#0EA5E9", fontPair: "sans", buttonStyle: "soft", corners: "round" },
  { id: "bone", label: "Bone", background: solid("#EDE9E3"), textColor: "#26241F", accent: "#4B5563", fontPair: "humanist", buttonStyle: "outline", corners: "soft" },
  { id: "blush", label: "Blush", background: solid("#FBEFF0"), textColor: "#3A2226", accent: "#9F2B48", fontPair: "serif-display", buttonStyle: "filled", corners: "pill" },

  // Gradients
  { id: "dusk", label: "Dusk", background: gradient("#1E1B4B", "#4C1D95"), textColor: "#F5F3FF", accent: "#C4B5FD", fontPair: "geometric", buttonStyle: "soft", corners: "round" },
  { id: "ember", label: "Ember", background: gradient("#7C2D12", "#DC2626"), textColor: "#FFF7ED", accent: "#FED7AA", fontPair: "sans", buttonStyle: "filled", corners: "pill" },
  { id: "lagoon", label: "Lagoon", background: gradient("#0F766E", "#0E7490"), textColor: "#ECFEFF", accent: "#A5F3FC", fontPair: "sans", buttonStyle: "soft", corners: "round" },
  { id: "aurora", label: "Aurora", background: gradient("#312E81", "#BE185D"), textColor: "#FDF4FF", accent: "#F0ABFC", fontPair: "geometric", buttonStyle: "filled", corners: "pill" },
  { id: "sunrise", label: "Sunrise", background: gradient("#F59E0B", "#EF4444"), textColor: "#2A1200", accent: "#7C2D12", fontPair: "humanist", buttonStyle: "filled", corners: "round" },
  { id: "deepsea", label: "Deep sea", background: gradient("#0C4A6E", "#082F49"), textColor: "#E0F2FE", accent: "#38BDF8", fontPair: "sans", buttonStyle: "outline", corners: "soft" },

  // Bold and high contrast
  { id: "brutalist", label: "Brutalist", background: solid("#FFFFFF"), textColor: "#000000", accent: "#FFE600", fontPair: "mono", buttonStyle: "shadow", corners: "sharp" },
  { id: "citrus", label: "Citrus", background: solid("#FDE047"), textColor: "#1C1917", accent: "#FFFFFF", fontPair: "geometric", buttonStyle: "shadow", corners: "sharp" },
  { id: "mint", label: "Mint", background: solid("#A7F3D0"), textColor: "#064E3B", accent: "#FFFFFF", fontPair: "sans", buttonStyle: "shadow", corners: "round" },
  { id: "violet", label: "Violet", background: solid("#7C3AED"), textColor: "#FFFFFF", accent: "#FDE68A", fontPair: "geometric", buttonStyle: "filled", corners: "pill" },
  { id: "carbon", label: "Carbon", background: solid("#171717"), textColor: "#FAFAFA", accent: "#22C55E", fontPair: "mono", buttonStyle: "outline", corners: "sharp" },
  { id: "terracotta", label: "Terracotta", background: solid("#A94E2B"), textColor: "#FFF8F3", accent: "#FFE0CC", fontPair: "serif-display", buttonStyle: "soft", corners: "round" },
];

export function findCardTheme(id: string): CardThemePreset | undefined {
  return CARD_THEMES.find((theme) => theme.id === id);
}
