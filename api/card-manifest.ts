/**
 * Per-card web app manifest, so Android's "Add to Home screen" installs the
 * card as a standalone app with the person's name and photo.
 *
 * This is the Android half of the Wallet decision: there is no `.pkpass` on
 * Android, so the equivalent is an installable web card. It has to be served
 * from a real same-origin URL — Chrome is unreliable about blob-URL manifests
 * and rejects data URLs outright — which is why it is a function rather than
 * something the SPA can inject on its own.
 */
export const config = { runtime: "edge" };

const API_BASE =
  process.env.CARD_OG_API_BASE ?? "https://api.getcontactbook.com/api";

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

export default async function handler(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const slug = (requestUrl.searchParams.get("slug") ?? "").toLowerCase();

  if (!SLUG_PATTERN.test(slug)) {
    return new Response(null, { status: 404 });
  }

  let identity: Record<string, unknown> = {};
  let themeColor = "#1B2430";

  try {
    const response = await fetch(`${API_BASE}/v1/public/cards/${slug}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return new Response(null, { status: 404 });
    }
    const card = (await response.json()) as {
      snapshot?: {
        identity?: Record<string, unknown>;
        theme?: { background?: { kind?: string; color?: string; from?: string } };
      };
    };
    identity = card.snapshot?.identity ?? {};
    const background = card.snapshot?.theme?.background;
    if (background?.kind === "solid" && background.color) {
      themeColor = background.color;
    } else if (background?.kind === "gradient" && background.from) {
      themeColor = background.from;
    }
  } catch {
    return new Response(null, { status: 404 });
  }

  const name =
    typeof identity.displayName === "string" && identity.displayName.trim()
      ? identity.displayName.trim()
      : "Contact card";

  const hasPhoto =
    typeof identity.photo === "string" && identity.photo.startsWith("data:image/");

  const manifest = {
    name,
    short_name: name.split(/\s+/)[0] ?? name,
    description: "Contact card",
    // The whole point: launching the icon opens this card, not the app root.
    start_url: `/c/${slug}`,
    scope: `/c/${slug}`,
    display: "standalone",
    theme_color: themeColor,
    background_color: themeColor,
    icons: hasPhoto
      ? [
          {
            src: `/api/card-og-image?slug=${encodeURIComponent(slug)}`,
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any",
          },
        ]
      : [],
  };

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
