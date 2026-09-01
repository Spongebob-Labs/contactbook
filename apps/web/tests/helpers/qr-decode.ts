import jsQR from "jsqr";
import { readPng, type Bitmap } from "./pixels";

/**
 * The ground truth of this build (spec §8A.7, AC-09/AC-10).
 *
 * ⚠ Decode the **raw PNG buffer**. Never round-trip a screenshot through a canvas or an
 * image re-encode first — that is the documented flake source (spec §16.1 R-2) and it turns
 * a real scannability failure into a coin flip.
 */

export interface DecodeOptions {
  /**
   * jsQR inversion strategy. `attemptBoth` costs a second pass but survives a template that
   * renders light modules on a dark plate.
   */
  inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst";
}

/** Decode a QR symbol out of a raw PNG buffer. Returns the payload, or `null`. */
export function decodeQrPng(buffer: Buffer, options: DecodeOptions = {}): string | null {
  return decodeQrBitmap(readPng(buffer), options);
}

/** Decode from an already-parsed bitmap, so a caller can parse the PNG once. */
export function decodeQrBitmap(bitmap: Bitmap, options: DecodeOptions = {}): string | null {
  const pixels = new Uint8ClampedArray(
    bitmap.data.buffer,
    bitmap.data.byteOffset,
    bitmap.data.byteLength,
  );
  const result = jsQR(pixels, bitmap.width, bitmap.height, {
    inversionAttempts: options.inversionAttempts ?? "attemptBoth",
  });
  return result === null ? null : result.data;
}

/**
 * Run `attempt` until it yields a payload, at most `attempts` times.
 *
 * Spec §16.1 R-2: "retry a decode at most twice and treat a third failure as real". Pass a
 * thunk that re-takes the screenshot so the retry actually resamples the raster:
 *
 * ```ts
 * const payload = await decodeWithRetry(async () =>
 *   decodeQrPng(await screenshotElement(page.locator('[data-qr-zone]'))),
 * );
 * ```
 *
 * If it still flaps, raise the symbol floor from 140px to 160px. **Never relax the
 * assertion** (spec §14.6).
 */
export async function decodeWithRetry(
  attempt: (attemptIndex: number) => Promise<string | null> | string | null,
  attempts = 3,
): Promise<string | null> {
  if (attempts < 1) throw new Error("decodeWithRetry: attempts must be >= 1");

  let last: string | null = null;
  for (let index = 0; index < attempts; index += 1) {
    last = await attempt(index);
    if (last !== null) return last;
  }
  return last;
}
