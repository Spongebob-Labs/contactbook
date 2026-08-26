import { PNG } from "pngjs";

/**
 * Pure pixel maths over a raw PNG bitmap. No browser, no canvas, no re-encode.
 *
 * Two consumers depend on this module and neither may edit it (plan §1.2):
 *  - the per-template contrast audit (spec §8B.6) needs the *rendered* luminance
 *    beneath a text node, with glyph pixels excluded by luminance clustering;
 *  - the 80/20 pixel audit (AC-16) needs each pixel assigned to a colour family.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Bitmap {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Buffer;
}

/** A sub-rectangle of a bitmap. Omitted fields mean "the whole bitmap". */
export interface Region {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export type PixelSource = Buffer | Bitmap;

/** Parse a raw PNG buffer. The only PNG entry point in the harness. */
export function readPng(buffer: Buffer): Bitmap {
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

function toBitmap(source: PixelSource): Bitmap {
  return Buffer.isBuffer(source) ? readPng(source) : source;
}

/** `#RGB`, `#RRGGBB` and `rgb(r, g, b)` all parse. Throws on anything else. */
export function parseColor(value: string): Rgb {
  const text = value.trim();

  const rgbMatch = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  const hex = text.replace(/^#/, "");
  if (hex.length === 3 && /^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if ((hex.length === 6 || hex.length === 8) && /^[0-9a-f]+$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  throw new Error(`parseColor: cannot parse "${value}"`);
}

/** WCAG 2.x relative luminance, 0 (black) … 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (raw: number): number => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * WCAG contrast from two *luminances*.
 * `src/lib/contrast.ts` (T02) is the production helper that takes hex; this one exists so
 * the harness can measure rendered pixels without importing product code.
 */
export function contrastFromLuminance(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastBetween(a: Rgb, b: Rgb): number {
  return contrastFromLuminance(relativeLuminance(a), relativeLuminance(b));
}

export function pixelAt(source: PixelSource, x: number, y: number): Rgb {
  const bitmap = toBitmap(source);
  const index = (bitmap.width * y + x) * 4;
  return {
    r: bitmap.data[index],
    g: bitmap.data[index + 1],
    b: bitmap.data[index + 2],
  };
}

function clampRegion(bitmap: Bitmap, region: Region | undefined): Required<Region> {
  const x = Math.max(0, Math.floor(region?.x ?? 0));
  const y = Math.max(0, Math.floor(region?.y ?? 0));
  const width = Math.min(bitmap.width - x, Math.floor(region?.width ?? bitmap.width - x));
  const height = Math.min(bitmap.height - y, Math.floor(region?.height ?? bitmap.height - y));
  if (width <= 0 || height <= 0) {
    throw new Error(
      `pixels: region ${JSON.stringify({ x, y, width, height })} is empty for a ` +
        `${bitmap.width}×${bitmap.height} bitmap`,
    );
  }
  return { x, y, width, height };
}

export interface SampleOptions extends Region {
  /** Pixels with alpha at or below this are skipped entirely. Default 8. */
  alphaThreshold?: number;
}

/** Every opaque pixel in `region`, in row-major order. */
export function samplePixels(source: PixelSource, options: SampleOptions = {}): Rgb[] {
  const bitmap = toBitmap(source);
  const { x, y, width, height } = clampRegion(bitmap, options);
  const alphaThreshold = options.alphaThreshold ?? 8;

  const out: Rgb[] = [];
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      const index = (bitmap.width * row + col) * 4;
      if (bitmap.data[index + 3] <= alphaThreshold) continue;
      out.push({
        r: bitmap.data[index],
        g: bitmap.data[index + 1],
        b: bitmap.data[index + 2],
      });
    }
  }
  if (out.length === 0) {
    throw new Error("pixels: no opaque pixels in the requested region");
  }
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface MedianLuminanceOptions extends SampleOptions {
  /**
   * Drop this fraction from *each* tail of the luminance distribution before taking the
   * median. 0 (the default) is a plain median. Use `backgroundLuminance` instead when the
   * region contains text — it clusters rather than trims.
   */
  trim?: number;
}

/**
 * Median relative luminance of a region. Robust to a few stray pixels in a way a mean is not.
 */
export function medianLuminance(
  source: PixelSource,
  options: MedianLuminanceOptions = {},
): number {
  const luminances = samplePixels(source, options).map(relativeLuminance);
  const trim = options.trim ?? 0;
  if (trim <= 0) return median(luminances);

  const sorted = [...luminances].sort((a, b) => a - b);
  const drop = Math.floor(sorted.length * Math.min(trim, 0.49));
  const kept = sorted.slice(drop, sorted.length - drop);
  return median(kept.length > 0 ? kept : sorted);
}

/** Otsu's method on a 256-bin luminance histogram. Returns a threshold in 0…1. */
function otsuThreshold(luminances: number[]): number {
  const bins = new Array<number>(256).fill(0);
  for (const l of luminances) {
    bins[Math.min(255, Math.max(0, Math.round(l * 255)))] += 1;
  }

  const total = luminances.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * bins[i];

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let bestVariance = -1;

  for (let i = 0; i < 256; i += 1) {
    weightBackground += bins[i];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += i * bins[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance =
      weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (variance > bestVariance) {
      bestVariance = variance;
      best = i;
    }
  }
  return best / 255;
}

export interface BackgroundLuminanceResult {
  /** Median luminance of the larger (background) cluster — the §8B.6 measurement. */
  background: number;
  /** Median luminance of the smaller (glyph) cluster. */
  foreground: number;
  /** Share of pixels that landed in the glyph cluster, 0…1. */
  foregroundShare: number;
  /** The Otsu split point, 0…1. */
  threshold: number;
}

/**
 * Split a region's pixels into two luminance clusters and report both.
 *
 * This is spec §8B.6 step 3: "compute the median luminance of the pixels beneath the text
 * glyphs (sample the background, excluding glyph pixels by luminance clustering)". Text is
 * always the *minority* cluster inside its own bounding box, so the larger cluster is the
 * background the glyph is sitting on.
 */
export function clusterLuminance(
  source: PixelSource,
  options: SampleOptions = {},
): BackgroundLuminanceResult {
  const luminances = samplePixels(source, options).map(relativeLuminance);
  const threshold = otsuThreshold(luminances);

  const low = luminances.filter((l) => l <= threshold);
  const high = luminances.filter((l) => l > threshold);

  if (low.length === 0 || high.length === 0) {
    const only = median(luminances);
    return { background: only, foreground: only, foregroundShare: 0, threshold };
  }

  const [larger, smaller] = low.length >= high.length ? [low, high] : [high, low];
  return {
    background: median(larger),
    foreground: median(smaller),
    foregroundShare: smaller.length / luminances.length,
    threshold,
  };
}

/** Convenience: just the background luminance from {@link clusterLuminance}. */
export function backgroundLuminance(
  source: PixelSource,
  options: SampleOptions = {},
): number {
  return clusterLuminance(source, options).background;
}

export interface PixelFamilyOptions extends SampleOptions {
  /**
   * Maximum Euclidean sRGB distance (0…441.7) at which a pixel still counts as belonging to
   * its nearest family. Anything further lands in `unclassified`. Default: unlimited.
   */
  tolerance?: number;
}

export interface PixelFamilyShare {
  /** Share per family name, 0…1. */
  shares: Record<string, number>;
  /** Share of pixels beyond `tolerance` from every family, 0…1. */
  unclassified: number;
  /** Raw pixel counts, same keys as `shares` plus `unclassified`. */
  counts: Record<string, number>;
  total: number;
}

/**
 * Assign every opaque pixel to its nearest colour family and report the shares.
 *
 * `families` maps a name to one or more representative colours (hex or `rgb()`), e.g.
 * `{ ground: ['#F7F1E6', '#EFE7D8'], accent: ['#14211C'] }`. This is the primitive behind
 * the AC-16 80/20 audit: ≥78% ground, ≤22% accent.
 */
export function pixelFamilyShare(
  source: PixelSource,
  families: Record<string, readonly string[]>,
  options: PixelFamilyOptions = {},
): PixelFamilyShare {
  const names = Object.keys(families);
  if (names.length === 0) {
    throw new Error("pixelFamilyShare: at least one family is required");
  }

  const swatches = names.map((name) => ({
    name,
    colors: families[name].map(parseColor),
  }));

  const tolerance = options.tolerance ?? Number.POSITIVE_INFINITY;
  const counts: Record<string, number> = Object.fromEntries(names.map((n) => [n, 0]));
  let unclassified = 0;

  const pixels = samplePixels(source, options);
  for (const pixel of pixels) {
    let bestName: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const swatch of swatches) {
      for (const color of swatch.colors) {
        const distance = Math.sqrt(
          (pixel.r - color.r) ** 2 + (pixel.g - color.g) ** 2 + (pixel.b - color.b) ** 2,
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          bestName = swatch.name;
        }
      }
    }

    if (bestName !== null && bestDistance <= tolerance) {
      counts[bestName] += 1;
    } else {
      unclassified += 1;
    }
  }

  const total = pixels.length;
  const shares: Record<string, number> = {};
  for (const name of names) shares[name] = counts[name] / total;

  return {
    shares,
    unclassified: unclassified / total,
    counts: { ...counts, unclassified },
    total,
  };
}
