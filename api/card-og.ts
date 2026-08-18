/**
 * Link-preview shim for shared cards.
 *
 * WhatsApp, iMessage, Slack and friends build previews by scraping
 * server-rendered HTML. The web app is a Vite SPA, so `/c/:slug` returns an
 * empty shell and a pasted card link shows as a bare URL. This function serves
 * those crawlers a tiny HTML document carrying real Open Graph tags.
 *
 * It is reached only through a user-agent-conditional rewrite in vercel.json —
 * real browsers still get the SPA. A crawler we fail to match simply gets the
 * old plain-URL preview, which is a graceful degradation rather than a break.
 */
export const config = { runtime: "edge" };

const API_BASE =
  process.env.CARD_OG_API_BASE ?? "https://api.getcontactbook.com/api";

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

type PublicCard = {
  slug: string;
  snapshot?: {
    identity?: {
      displayName?: string;
      title?: string;
      company?: string;
      bio?: string;
      photo?: string;
    };
  };
};

/**
 * Card names and bios are user-controlled and land inside HTML attributes.
 * Escaping here is the boundary that stops a display name from closing the
 * meta tag and injecting markup into every preview of that card.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(params: {
  title: string;
  description: string;
  url: string;
  image?: string;
}): string {
  const { title, description, url, image } = params;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:site_name" content="ContactBook">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ""}
</head>
<body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#0B1220;color:#fff">
<main style="text-align:center;padding:24px">
<h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(title)}</h1>
<p style="opacity:.65;margin:0 0 20px">${escapeHtml(description)}</p>
<a href="${escapeHtml(url)}" style="color:#C4A882">Open card</a>
</main>
</body>
</html>`;
}

export default async function handler(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const slug = (requestUrl.searchParams.get("slug") ?? "").toLowerCase();
  const cardUrl = `${requestUrl.origin}/c/${slug}`;

  const notFound = () =>
    new Response(
      page({
        title: "Card not available",
        description: "This ContactBook card is no longer available.",
        url: cardUrl,
      }),
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
    );

  if (!SLUG_PATTERN.test(slug)) {
    return notFound();
  }

  let card: PublicCard;
  try {
    const response = await fetch(`${API_BASE}/v1/public/cards/${slug}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return notFound();
    }
    card = (await response.json()) as PublicCard;
  } catch {
    return notFound();
  }

  const identity = card.snapshot?.identity ?? {};
  const title = (identity.displayName ?? "").trim() || "ContactBook card";
  const description =
    [identity.title, identity.company]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" · ") ||
    (identity.bio ?? "").trim() ||
    "View and save this contact card.";

  // Photos are inline data URLs, which crawlers cannot fetch, so the image tag
  // points at a sibling function that decodes and serves the bytes.
  const image = identity.photo?.startsWith("data:image/")
    ? `${requestUrl.origin}/api/card-og-image?slug=${encodeURIComponent(slug)}`
    : undefined;

  return new Response(page({ title, description, url: cardUrl, image }), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
