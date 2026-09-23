/**
 * Turn a chosen image file into a **downscaled** data URL, and back into an uploadable file.
 *
 * ## Why not `URL.createObjectURL`
 *
 * An object URL is a handle into this document's memory: it dies with the tab. The cover goes
 * through a crop dialog that composes on a canvas and hands back a string, and that same string
 * is both what the preview paints and — via {@link dataUrlToFile} — what the upload sends. Bytes,
 * not a handle, is what makes one value serve both.
 *
 * ## ⚠ Why it is downscaled, and why that is not just a size optimisation
 *
 * `POST /cards/{id}/cover` caps a cover at **5MB** — a quarter of the logo's 20MB — and a phone
 * photograph is 3–8MB before base64 adds a third. Downscaling to a 1280px long edge at JPEG
 * q0.82 lands a typical cover at 150–400KB, comfortably inside it.
 *
 * It is also simply the right size: the cover renders at most 508 CSS px wide, so 1280 is
 * already 2.5× for a retina screen and everything beyond it is bytes nobody can see. The API
 * performs **no** server-side resize — it stores and serves exactly these bytes — so this
 * function and the crop dialog are the only things deciding what a recipient downloads.
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

/**
 * A composed `data:` URL as a `File`, ready for `POST /cards/{id}/cover`.
 *
 * ## ⚠ Why the upload does not take the original file the owner picked
 * It must not. The crop dialog bakes the owner's composition into new bytes — 1:0.7 aperture,
 * ≤1280px long edge — and the API stores and serves exactly what it is sent, with no server-side
 * crop or re-fit. Uploading the original would render a full-length photograph as a head crop on
 * the card, the builder preview and the public page at once, which is the precise bug the cover
 * feature exists to fix. So the bytes that go up are the bytes that were composed, and this is
 * the one function that converts them.
 *
 * Decoded synchronously through `atob` rather than `await fetch(dataUrl)`: a `fetch` of a
 * `data:` URL is blocked outright by a strict `connect-src` CSP, and failing to upload a cover
 * because of a policy that has nothing to do with the network is not a failure mode worth
 * inheriting.
 *
 * @throws when the string is not a `data:` URL carrying base64. Unreachable from the crop dialog,
 *   which always produces one; a caller passing something else is a programming error, not an
 *   owner's mistake, so it throws rather than returning null for someone to ignore.
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const match = /^data:([^;,]+)(;base64)?,/.exec(dataUrl);
  if (match === null || match[2] === undefined) {
    throw new Error("Expected a base64 data URL.");
  }
  const mime = match[1];
  const binary = atob(dataUrl.slice(match[0].length));
  /* A typed array rather than a string: `new File([binary])` would re-encode each byte as UTF-8
     and corrupt every value above 0x7F — which is most of a JPEG. */
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}
