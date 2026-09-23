/**
 * THE CROP GEOMETRY — pure arithmetic, so the cropper's one hard part is testable without a DOM.
 *
 * ## The defect this exists to fix
 *
 * `card-page.tsx` draws the cover with `object-fit: cover` and a hard-coded
 * `object-position: 50% 28%`, and its own comment admits why: *"There is no crop UI, so the
 * default has to be the one that is right for the photographs people actually upload."* A
 * fixed position is a guess, and on the client's own upload it guessed wrong — a full-length
 * photograph rendered as a head with the body cut away, with no way to correct it.
 *
 * A guess cannot be improved by choosing a different guess. What the owner needs is the ability
 * to say which part of their photograph is the picture, which is what this computes.
 *
 * ## The model, and why it is "scale over cover" rather than raw pixels
 *
 * Three things are involved and they have different units, which is the usual source of crop
 * bugs:
 *
 * · the **source** image, in its own natural pixels (`w × h`);
 * · the **frame** — the aperture the owner is composing into, in CSS pixels on screen. Its
 *   *aspect* is what matters, and it is fixed by where the image lands: the cover is
 *   `1 : COVER_RATIO.photo` and the badge is square;
 * · the **output**, in destination pixels, which is neither of the above.
 *
 * `scale` is deliberately **a multiplier on the cover-fit size, not on the natural size**.
 * At `scale = 1` the image exactly covers the frame, which is precisely what the card does
 * today — so the cropper opens showing what the card already shows, and "1" is a meaningful
 * number for every image regardless of how large the file happens to be. Anchoring to natural
 * pixels instead would make the minimum zoom a different number for every upload, and the
 * slider's left end would mean nothing.
 *
 * `offset` is the displayed image's top-left corner relative to the frame's, in frame pixels.
 *
 * ## ⚠ THE INVARIANT: THE FRAME IS NEVER ALLOWED TO SHOW NOTHING
 *
 * Every function here upholds one rule — the scaled image always covers the frame completely,
 * so no drag or zoom can expose a blank edge. A cropper that lets the photograph slide off its
 * own aperture produces a card with a white wedge down one side, and the owner has no idea
 * whether they did that or the product is broken. {@link clampOffset} is where it is enforced,
 * and every mutation routes through it rather than each caller remembering.
 */

/** The aperture being composed into. Only the ratio matters; the numbers are screen pixels. */
export interface CropFrame {
  width: number;
  height: number;
}

/** The source image's natural size. */
export interface CropSource {
  width: number;
  height: number;
}

/**
 * What the owner chose.
 *
 * `scale` is a multiplier on the cover-fit size (1 = exactly covers, 2 = twice that).
 * `x`/`y` are the displayed image's top-left relative to the frame's, in frame pixels — so both
 * are zero or negative whenever the invariant holds.
 */
export interface CropTransform {
  scale: number;
  x: number;
  y: number;
}

/** How far in the owner may zoom. Past this a 1280px source turns to porridge. */
export const MAX_SCALE = 4;

/** The identity crop: exactly what `object-fit: cover` already shows, centred. */
export function coverTransform(source: CropSource, frame: CropFrame): CropTransform {
  return centre({ scale: 1, x: 0, y: 0 }, source, frame);
}

/**
 * The displayed size of the image at a given scale.
 *
 * ⚠ Guarded against a zero-sized source or frame, which is not paranoia: `naturalWidth` is 0
 * until an image decodes, and a dialog that measures its frame on first paint can see 0 before
 * layout settles. Returning zeros there keeps every downstream division finite instead of
 * seeding `NaN` into the transform, which then persists as a permanently blank cropper.
 */
export function displaySize(
  source: CropSource,
  frame: CropFrame,
  scale: number,
): { width: number; height: number } {
  if (source.width <= 0 || source.height <= 0 || frame.width <= 0 || frame.height <= 0) {
    return { width: 0, height: 0 };
  }
  /* Cover-fit: the larger of the two ratios, so neither axis is left short. */
  const cover = Math.max(frame.width / source.width, frame.height / source.height);
  const factor = cover * scale;
  return { width: source.width * factor, height: source.height * factor };
}

/**
 * Pull an offset back inside the legal range.
 *
 * The legal range for `x` is `[frame.width - displayed.width, 0]` — the left edge may not move
 * right of the frame's left edge, and the right edge may not move left of the frame's right
 * edge. When the displayed image is somehow *smaller* than the frame (only reachable through a
 * degenerate source) the range inverts, so the image is centred instead of clamped to a bound
 * that is behind its own opposite.
 */
export function clampOffset(
  transform: CropTransform,
  source: CropSource,
  frame: CropFrame,
): CropTransform {
  const displayed = displaySize(source, frame, transform.scale);
  const axis = (value: number, frameSize: number, displayedSize: number): number => {
    const min = frameSize - displayedSize;
    if (min >= 0) return min / 2;
    return Math.min(0, Math.max(min, value));
  };
  return {
    scale: transform.scale,
    x: axis(transform.x, frame.width, displayed.width),
    y: axis(transform.y, frame.height, displayed.height),
  };
}

/** Centre the image in the frame at its current scale. */
export function centre(
  transform: CropTransform,
  source: CropSource,
  frame: CropFrame,
): CropTransform {
  const displayed = displaySize(source, frame, transform.scale);
  return clampOffset(
    {
      scale: transform.scale,
      x: (frame.width - displayed.width) / 2,
      y: (frame.height - displayed.height) / 2,
    },
    source,
    frame,
  );
}

/**
 * Zoom about a fixed point of the frame — by default its centre.
 *
 * ⚠ **Zooming without an anchor is the bug everyone ships.** Scaling the image and leaving the
 * offset alone moves whatever the owner was looking at off toward a corner, so composing means
 * zoom, drag back, zoom, drag back. Holding one frame point still means the picture grows
 * *around* what they are aiming at, which is what makes the control feel like a camera instead
 * of two fighting sliders.
 *
 * The anchor's position in image space is preserved: its distance from the image's top-left
 * scales with the image, and the offset absorbs the difference.
 */
export function zoomTo(
  transform: CropTransform,
  source: CropSource,
  frame: CropFrame,
  nextScale: number,
  anchor: { x: number; y: number } = { x: frame.width / 2, y: frame.height / 2 },
): CropTransform {
  const scale = Math.min(MAX_SCALE, Math.max(1, nextScale));
  const before = displaySize(source, frame, transform.scale);
  const after = displaySize(source, frame, scale);
  if (before.width <= 0 || after.width <= 0) return clampOffset({ ...transform, scale }, source, frame);

  /* Where the anchor sits within the image, 0–1 along each axis. */
  const u = (anchor.x - transform.x) / before.width;
  const v = (anchor.y - transform.y) / before.height;

  return clampOffset(
    { scale, x: anchor.x - u * after.width, y: anchor.y - v * after.height },
    source,
    frame,
  );
}

/** Move by a drag delta, in frame pixels. */
export function panBy(
  transform: CropTransform,
  source: CropSource,
  frame: CropFrame,
  dx: number,
  dy: number,
): CropTransform {
  return clampOffset({ ...transform, x: transform.x + dx, y: transform.y + dy }, source, frame);
}

/**
 * The rectangle of the SOURCE image that the frame is currently showing, in source pixels.
 *
 * This is the whole point of the module: it converts a composition the owner made on screen,
 * at whatever size the dialog happened to be, into coordinates that mean the same thing when
 * drawn to a canvas of any output size. The dialog's pixel dimensions never reach the output.
 */
export function sourceRect(
  transform: CropTransform,
  source: CropSource,
  frame: CropFrame,
): { sx: number; sy: number; sw: number; sh: number } {
  const displayed = displaySize(source, frame, transform.scale);
  if (displayed.width <= 0 || displayed.height <= 0) {
    return { sx: 0, sy: 0, sw: source.width, sh: source.height };
  }
  /* Source pixels per displayed pixel. Uniform, because the fit is uniform on both axes. */
  const ratio = source.width / displayed.width;

  const sx = -transform.x * ratio;
  const sy = -transform.y * ratio;
  const sw = frame.width * ratio;
  const sh = frame.height * ratio;

  /* ⚠ Clamped to the source's own bounds. The invariant should make this unnecessary, and it is
     kept because floating-point drift at the extremes of a drag can put `sx + sw` a hair past
     the edge — and Canvas draws the overflow as TRANSPARENT rather than clamping, which is a
     visible transparent seam on one side of an otherwise correct crop. */
  const clampedX = Math.min(Math.max(0, sx), Math.max(0, source.width - sw));
  const clampedY = Math.min(Math.max(0, sy), Math.max(0, source.height - sh));
  return {
    sx: clampedX,
    sy: clampedY,
    sw: Math.min(sw, source.width - clampedX),
    sh: Math.min(sh, source.height - clampedY),
  };
}

/**
 * The output pixel size for a crop: the frame's aspect, capped on the long edge.
 *
 * Capped rather than "as large as the source allows" because the result is stored as a data URL
 * — in `localStorage` for a cover, which is a ~5MB budget shared with everything else the app
 * keeps there. An uncapped 4000px phone photograph base64s to several megabytes and throws
 * `QuotaExceededError` on save, which surfaces to the owner as a cover that silently fails to
 * persist.
 */
export function outputSize(frame: CropFrame, maxEdge: number): { width: number; height: number } {
  if (frame.width <= 0 || frame.height <= 0) return { width: maxEdge, height: maxEdge };
  const longest = Math.max(frame.width, frame.height);
  const factor = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(frame.width * factor)),
    height: Math.max(1, Math.round(frame.height * factor)),
  };
}
