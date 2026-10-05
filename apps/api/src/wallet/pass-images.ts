import sharp from 'sharp';
import type { PassTheme } from './pass-colors.util';

/**
 * The portrait on the pass: a round thumbnail on the right of the name, exactly where the share
 * face on the web puts it.
 *
 * Wallet draws the pass's rounded outline and the white QR plate itself, so the only thing the
 * server controls visually is colour, text and these images. This one carries the "rounded"
 * personality: a circle with a hairline ring in the card's own ink.
 *
 * ## Sizes
 * A generic pass shows a thumbnail up to 90 × 90 points, so the three files are 90, 180 and 270
 * pixels. They are all cut from one 270 px render so the three never disagree.
 *
 * ## The photo
 * `photoUrl` is the owner's profile photo — a public GCS URL the API itself wrote (never a
 * client-supplied string, see `ProfilePhotoStorageService`). It is still fetched defensively:
 * https only, no redirects, a short timeout and a size cap, and ANY failure falls back to a
 * neutral silhouette rather than failing the pass. A pass without a portrait is fine; a pass that
 * cannot be issued because a photo host was slow is not.
 */

const THUMB_PX = 270;
const FETCH_TIMEOUT_MS = 4000;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * The card's gradient as the pass's background (`background.png`, 180 × 220 points).
 *
 * Wallet paints one flat colour for a pass's ground, so the web card's two-stop gradient has to
 * arrive as an image. Wallet crops it slightly and BLURS it — harmless for a smooth gradient,
 * which is why this is a gradient and not a texture. 135° of CSS angle would be a diagonal; the
 * web's palettes all use 150–160°, so it uses 155°.
 */
export const BACKGROUND_FILES = {
  'background.png': 1,
  'background@2x.png': 2,
  'background@3x.png': 3,
} as const;

const BG_POINTS = { width: 180, height: 220 };
const BG_ANGLE_DEG = 155;

export async function renderBackgrounds(
  theme: Pick<PassTheme, 'gradientFromHex' | 'gradientToHex'>,
): Promise<Record<keyof typeof BACKGROUND_FILES, Buffer>> {
  // CSS angle (0deg = up, clockwise) to an SVG objectBoundingBox vector.
  const a = (BG_ANGLE_DEG * Math.PI) / 180;
  const x1 = 0.5 - 0.5 * Math.sin(a);
  const y1 = 0.5 + 0.5 * Math.cos(a);
  const x2 = 0.5 + 0.5 * Math.sin(a);
  const y2 = 0.5 - 0.5 * Math.cos(a);

  const entries = await Promise.all(
    (
      Object.entries(BACKGROUND_FILES) as Array<
        [keyof typeof BACKGROUND_FILES, number]
      >
    ).map(async ([name, scale]) => {
      const w = BG_POINTS.width * scale;
      const h = BG_POINTS.height * scale;
      const svg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
          `<defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
          `<stop offset="0" stop-color="${theme.gradientFromHex}"/>` +
          `<stop offset="1" stop-color="${theme.gradientToHex}"/>` +
          `</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
      );
      return [name, await sharp(svg).png().toBuffer()] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<
    keyof typeof BACKGROUND_FILES,
    Buffer
  >;
}

export const THUMBNAIL_FILES = {
  'thumbnail.png': 90,
  'thumbnail@2x.png': 180,
  'thumbnail@3x.png': 270,
} as const;

/** The owner's photo bytes, or `null` for anything short of a clean, small, https image. */
export async function fetchPhoto(
  photoUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer | null> {
  let url: URL;
  try {
    url = new URL(photoUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) return null;
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_PHOTO_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length > 0 && bytes.length <= MAX_PHOTO_BYTES ? bytes : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A neutral person-shaped placeholder, in the card's ink so it works on any ground. */
function silhouetteSvg(inkHex: string): Buffer {
  const s = THUMB_PX;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">` +
      `<rect width="${s}" height="${s}" fill="${inkHex}" fill-opacity="0.12"/>` +
      `<circle cx="${s / 2}" cy="${s * 0.39}" r="${s * 0.155}" fill="${inkHex}" fill-opacity="0.5"/>` +
      `<ellipse cx="${s / 2}" cy="${s * 0.93}" rx="${s * 0.3}" ry="${s * 0.27}" fill="${inkHex}" fill-opacity="0.5"/>` +
      `</svg>`,
  );
}

function circleMask(): Buffer {
  const s = THUMB_PX;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
      `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#fff"/></svg>`,
  );
}

function ring(inkHex: string): Buffer {
  const s = THUMB_PX;
  const width = 4;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
      `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - width / 2}" fill="none" ` +
      `stroke="${inkHex}" stroke-opacity="0.35" stroke-width="${width}"/></svg>`,
  );
}

/**
 * The three thumbnail files for the pass, keyed by their file name in the pkpass.
 *
 * @param photo the owner's photo bytes, or `null` for the silhouette. A photo sharp cannot
 *   decode also falls back to the silhouette.
 */
export async function renderThumbnails(
  photo: Buffer | null,
  theme: Pick<PassTheme, 'inkHex'>,
): Promise<Record<keyof typeof THUMBNAIL_FILES, Buffer>> {
  let square: Buffer;
  try {
    if (photo === null) throw new Error('no photo');
    square = await sharp(photo, { failOn: 'none' })
      .rotate() // honour the camera's EXIF orientation
      .resize(THUMB_PX, THUMB_PX, { fit: 'cover', position: 'attention' })
      .png()
      .toBuffer();
  } catch {
    square = await sharp(silhouetteSvg(theme.inkHex)).png().toBuffer();
  }

  // Two steps on purpose: a second `.composite()` in the same chain REPLACES the first.
  const masked = await sharp(square)
    .ensureAlpha()
    .composite([{ input: circleMask(), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const round = await sharp(masked)
    .composite([{ input: ring(theme.inkHex), blend: 'over' }])
    .png()
    .toBuffer();

  const entries = await Promise.all(
    (
      Object.entries(THUMBNAIL_FILES) as Array<
        [keyof typeof THUMBNAIL_FILES, number]
      >
    ).map(
      async ([name, px]) =>
        [
          name,
          px === THUMB_PX
            ? round
            : await sharp(round).resize(px, px).png().toBuffer(),
        ] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<
    keyof typeof THUMBNAIL_FILES,
    Buffer
  >;
}
