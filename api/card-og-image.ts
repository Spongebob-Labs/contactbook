/**
 * Serves a published card's photo as real image bytes.
 *
 * Photos live inline in the snapshot as base64 data URLs, and no crawler will
 * fetch a `data:` URI for `og:image`. This decodes one into an ordinary image
 * response so link previews can show a face. Retire it when photos move to GCS
 * and have URLs of their own.
 */
export const config = { runtime: "edge" };

const API_BASE =
  process.env.CARD_OG_API_BASE ?? "https://api.getcontactbook.com/api";

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export default async function handler(request: Request): Promise<Response> {
  const slug = (
    new URL(request.url).searchParams.get("slug") ?? ""
  ).toLowerCase();

  if (!SLUG_PATTERN.test(slug)) {
    return new Response(null, { status: 404 });
  }

  try {
    const response = await fetch(`${API_BASE}/v1/public/cards/${slug}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return new Response(null, { status: 404 });
    }

    const card = (await response.json()) as {
      snapshot?: { identity?: { photo?: string } };
    };
    const match = DATA_URL_PATTERN.exec(card.snapshot?.identity?.photo ?? "");
    if (!match) {
      return new Response(null, { status: 404 });
    }

    const [, mimeType, base64] = match;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": mimeType,
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
