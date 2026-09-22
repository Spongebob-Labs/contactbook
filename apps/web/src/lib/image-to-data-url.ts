/**
 * Turn a chosen image file into a **downscaled** data URL.
 *
 * ## Why not `URL.createObjectURL`
 *
 * An object URL is a handle into this document's memory: it dies with the tab, so it cannot be
 * stored and read back. The card's cover has no API column yet and is held in `localStorage`
 * (`card-local-draft.ts`), which means it has to be the bytes themselves.
 *
 * ## ⚠ Why it is downscaled, and why that is not just a size optimisation
 *
 * A phone photograph is 3–8MB, and base64 adds a third. `localStorage` gives an origin roughly
 * 5MB **in total**, so storing one raw cover would blow the budget for every card at once and
 * throw `QuotaExceededError` on the write. Downscaling to a 1280px long edge at JPEG q0.82 lands
 * a typical cover at 150–400KB encoded.
 *
 * It is also simply the right size: the cover renders at most 508 CSS px wide, so 1280 is
 * already 2.5× for a retina screen and everything beyond it is bytes nobody can see.
 *
 * ## The alpha question
 *
 * Output is JPEG, which has no alpha — correct here, because a cover fills a rectangle edge to
 * edge and a transparent one would show the sheet through it. A PNG logo keeps its alpha because
 * the logo goes through the real upload endpoint and never comes near this function.
 */

/** The long edge, in px, the cover is reduced to. See the ⚠ above for why this number. */
const MAX_EDGE = 1280;
const QUALITY = 0.82;

export interface DownscaleResult {
  dataUrl: string;
  /** Encoded length in bytes, so a caller can refuse something implausible. */
  bytes: number;
}

/**
 * @throws when the file is not a decodable image. Callers show that as a message rather than
 *   letting it reach an error boundary — a bad file is the owner's mistake, not a broken screen.
 */
export async function imageToDataUrl(file: File): Promise<DownscaleResult> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("This browser could not read the image.");

    /* White beneath, because a PNG with transparency encodes to JPEG as black otherwise — a
       logo-shaped file chosen as a cover would come out a dark rectangle. */
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
    /* The base64 payload's decoded length, near enough: 4 chars per 3 bytes, minus padding. */
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    return { dataUrl, bytes: Math.floor((base64.length * 3) / 4) };
  } finally {
    /* Frees the decoded bitmap immediately rather than at the next GC — it is the largest thing
       this function allocates and a cover is often chosen several times in a row. */
    bitmap.close();
  }
}
