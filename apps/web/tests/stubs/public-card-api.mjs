/**
 * A stand-in for `GET /api/v1/public/links/{token}`, for the e2e suite only.
 *
 * ## Why this exists
 * `/c/[slug]` resolves its card **server-side**, inside the Next process — so
 * `page.route()` cannot intercept it, and the suite has no way to put a card of a
 * known shape on screen. When the route moved from fixtures to the real API, every
 * test in `public-card.spec.ts` started navigating to slugs that resolve to nothing.
 * They did not fail loudly; they just stopped exercising the page. That is how the
 * `f3b09a4` ground regression — the background painting only as tall as the card's
 * content — shipped and stayed shipped.
 *
 * ## The token vocabulary
 * `n{count}` renders a card carrying exactly that many fields, so a test can address
 * "the shortest article this route can produce" (`n0`) as directly as a full one.
 * Nothing here is a fixture of a real person: the name is the product's own demo
 * identity and every value is synthetic.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_API_PORT ?? 8788);

const field = (i) => ({
  type: "CUSTOM",
  label: `Field ${i + 1}`,
  value: `value-${i + 1}`,
});

const server = createServer((req, res) => {
  const match = /\/public\/links\/n(\d+)\b/.exec(req.url ?? "");
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");

  if (match === null) {
    res.statusCode = 404;
    res.end(JSON.stringify({ code: "SHARE_LINK_NOT_FOUND", message: "This link does not exist." }));
    return;
  }

  res.end(
    JSON.stringify({
      owner: { name: "Priyanka Raghunathan", photoUrl: null },
      card: {
        name: "Work",
        kind: "WORK",
        templateId: "meridian",
        paletteId: "emerald",
        groundHex: null,
        finish: "gradient",
        texture: "grid",
        texturePresence: "subtle",
        textureScale: "regular",
        updatedAt: "2026-08-23T18:00:00.000Z",
      },
      fields: Array.from({ length: Number(match[1]) }, (_, i) => field(i)),
    }),
  );
});

server.listen(PORT, () => console.log(`public-card stub api on ${PORT}`));
