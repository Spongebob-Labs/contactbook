import type {
  ContactCardFields,
  ContactCardTemplate,
  ContactCardTheme,
} from "@/lib/types";

export type CardThemePreset = {
  id: string;
  label: string;
  primary: string;
};

export type CardTemplateOption = {
  id: ContactCardTemplate;
  label: string;
  description: string;
};

/** Derived surface tokens for Connect + Scan craft. */
export type CardSurfaceTokens = {
  primary: string;
  /** Foreground on solid primary (CTAs, badges). */
  onPrimary: string;
  /** Accent ink on light/white surfaces (Connect links, brand). */
  ink: string;
  /** Muted brand label on Connect company row. */
  brandMuted: string;
  /** Scan hero name color. */
  heroInk: string;
  /** Scan contact values. */
  metaInk: string;
  /** Scan labels / muted text. */
  metaMuted: string;
  /** Connect page wash behind the white panel. */
  pageWash: string;
  /** Connect avatar fallback fill. */
  avatarBg: string;
  ctaBg: string;
  ctaFg: string;
  ctaSecondaryBg: string;
  ctaSecondaryFg: string;
  ctaSecondaryBorder: string;
  socialBg: string;
  socialFg: string;
  socialMutedBg: string;
  socialMutedFg: string;
  isLightPrimary: boolean;
};

export const CARD_TEMPLATE_OPTIONS: CardTemplateOption[] = [
  {
    id: "connect",
    label: "Connect",
    description: "Actions and socials",
  },
  {
    id: "scan",
    label: "Scan",
    description: "Brand mark and QR",
  },
];

export const DEFAULT_CARD_TEMPLATE: ContactCardTemplate = "connect";

export const CARD_THEME_PRESETS: CardThemePreset[] = [
  { id: "midnight", label: "Midnight", primary: "#1B2430" },
  { id: "ocean", label: "Ocean", primary: "#0F5F6B" },
  { id: "stealth", label: "Stealth", primary: "#2F4F7A" },
  { id: "forest", label: "Forest", primary: "#1F4A3A" },
  { id: "burgundy", label: "Burgundy", primary: "#6B2D3C" },
  { id: "slate", label: "Slate", primary: "#3D4654" },
  { id: "brass", label: "Brass", primary: "#C4A882" },
  { id: "copper", label: "Copper", primary: "#9A5B3C" },
];

export const DEFAULT_CARD_THEME: ContactCardTheme = {
  presetId: "midnight",
  primary: "#1B2430",
};

export const EMPTY_CARD_FIELDS: ContactCardFields = {
  displayName: "",
  title: "",
  countryCode: "+1",
  phone: "",
  email: "",
  company: "",
  address: "",
  website: "",
  linkedin: "",
  twitter: "",
  facebook: "",
  instagram: "",
  photoDataUrl: "",
};

/** Unique dial options for the card maker country-code control. */
export const CARD_DIAL_OPTIONS = [
  "+1",
  "+44",
  "+61",
  "+64",
  "+91",
  "+49",
  "+33",
  "+34",
  "+39",
  "+31",
  "+46",
  "+47",
  "+55",
  "+52",
  "+81",
  "+82",
  "+65",
  "+971",
  "+27",
] as const;

export function normalizeDialCode(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) {
    return "+1";
  }
  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned.replace(/\D/g, "")}`;
  return /^\+\d{1,4}$/.test(withPlus) ? withPlus : "+1";
}

/** Display phone as "+971 50 123 4567". */
export function formatCardPhone(countryCode: string, phone: string): string {
  const dial = normalizeDialCode(countryCode);
  const national = phone.trim();
  if (!national) {
    return "";
  }
  return `${dial} ${national}`;
}

export function normalizeHex(value: string): string | null {
  const cleaned = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return null;
  }
  return `#${cleaned.toUpperCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return null;
  }
  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${to(r)}${to(g)}${to(b)}`;
}

function luminanceOf(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

function mixToward(
  hex: string,
  target: { r: number; g: number; b: number },
  amount: number,
): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    rgb.r + (target.r - rgb.r) * t,
    rgb.g + (target.g - rgb.g) * t,
    rgb.b + (target.b - rgb.b) * t,
  );
}

/** Readable foreground for solid primary buttons / badges. */
export function contrastForeground(hex: string): string {
  return luminanceOf(hex) > 0.55 ? "#1A1610" : "#FFFFFF";
}

/**
 * Accent ink for text/links sitting on light surfaces.
 * Light swatches (brass) are deepened aggressively so type stays readable.
 */
export function surfaceAccent(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  const lum = luminanceOf(hex);
  if (lum <= 0.45) {
    return hex;
  }
  const factor = lum > 0.7 ? 0.42 : 0.5;
  return rgbToHex(rgb.r * factor, rgb.g * (factor - 0.04), rgb.b * (factor - 0.08));
}

export function softTint(hex: string, alpha = 0.12): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return `rgba(27, 36, 48, ${alpha})`;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

const PAPER = { r: 248, g: 247, b: 244 } as const;
const WARM_PAPER = { r: 250, g: 248, b: 244 } as const;

/**
 * Full surface token set for Connect + Scan craft.
 * Scan: luminous type on solid primary.
 * Connect: atmospheric wash + opaque theme-tinted CTAs (executive blend).
 */
export function resolveCardSurface(primaryInput: string): CardSurfaceTokens {
  const primary = normalizeHex(primaryInput) ?? DEFAULT_CARD_THEME.primary;
  const lum = luminanceOf(primary);
  const isLightPrimary = lum > 0.52;
  const onPrimary = contrastForeground(primary);
  const ink = surfaceAccent(primary);

  // Stronger theme presence than the old 88% gray wash.
  const pageWash = isLightPrimary
    ? mixToward(primary, WARM_PAPER, 0.55)
    : mixToward(primary, PAPER, 0.72);

  // Opaque Synergy-style CTA pills (not low-alpha gray).
  const ctaSecondaryBg = isLightPrimary
    ? mixToward(primary, { r: 255, g: 255, b: 255 }, 0.22)
    : mixToward(primary, PAPER, 0.78);

  const ctaSecondaryFg = ink;
  const ctaSecondaryBorder = isLightPrimary
    ? mixToward(primary, { r: 255, g: 255, b: 255 }, 0.4)
    : mixToward(primary, PAPER, 0.62);

  const avatarBg = isLightPrimary
    ? mixToward(primary, { r: 255, g: 255, b: 255 }, 0.35)
    : mixToward(primary, PAPER, 0.7);

  const socialMutedBg = isLightPrimary
    ? mixToward(primary, { r: 255, g: 255, b: 255 }, 0.45)
    : mixToward(primary, PAPER, 0.82);

  const brandMuted = mixToward(ink, PAPER, isLightPrimary ? 0.35 : 0.45);

  // Scan template: luminous type on the solid color face
  const heroInk = "#FFFFFF";
  const metaInk = "rgba(255,255,255,0.95)";
  const metaMuted = "rgba(255,255,255,0.68)";

  return {
    primary,
    onPrimary,
    ink,
    brandMuted,
    heroInk,
    metaInk,
    metaMuted,
    pageWash,
    avatarBg,
    ctaBg: primary,
    ctaFg: onPrimary,
    ctaSecondaryBg,
    ctaSecondaryFg,
    ctaSecondaryBorder,
    socialBg: primary,
    socialFg: onPrimary,
    socialMutedBg,
    socialMutedFg: ink,
    isLightPrimary,
  };
}

export function initialsFromName(value: string): string {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return initials || "CB";
}

export function resolveTheme(theme: ContactCardTheme | undefined): ContactCardTheme {
  if (!theme?.primary) {
    return DEFAULT_CARD_THEME;
  }
  const primary = normalizeHex(theme.primary) ?? DEFAULT_CARD_THEME.primary;
  return {
    presetId: theme.presetId || "custom",
    primary,
  };
}

export function resolveTemplate(
  template: ContactCardTemplate | undefined,
): ContactCardTemplate {
  return template === "scan" ? "scan" : DEFAULT_CARD_TEMPLATE;
}

export function themeFromPreset(presetId: string): ContactCardTheme {
  const preset = CARD_THEME_PRESETS.find((item) => item.id === presetId);
  if (!preset) {
    return DEFAULT_CARD_THEME;
  }
  return { presetId: preset.id, primary: preset.primary };
}

export function hasAnySocial(fields: ContactCardFields): boolean {
  return Boolean(
    fields.linkedin.trim() ||
      fields.twitter.trim() ||
      fields.facebook.trim() ||
      fields.instagram.trim(),
  );
}

const PHOTO_MAX_EDGE = 512;
const PHOTO_JPEG_QUALITY = 0.82;
const PHOTO_MAX_BYTES = 2.5 * 1024 * 1024;

/**
 * Read an image file into a compressed square-friendly JPEG data URL
 * suitable for localStorage card previews.
 */
export function loadCardPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose an image file (JPG, PNG, or WebP)."));
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      reject(new Error("Image must be under 2.5 MB."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const { width, height } = image;
        if (!width || !height) {
          reject(new Error("Could not read that image."));
          return;
        }

        const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process that image."));
          return;
        }
        ctx.drawImage(image, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY));
      } catch {
        reject(new Error("Could not process that image."));
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load that image."));
    };

    image.src = objectUrl;
  });
}
