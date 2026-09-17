/**
 * **The e2e API stub — the authenticated surface, plus the public card link.**
 *
 * ## What this replaced, and the bug it fixes
 *
 * This file supersedes `public-card-api.mjs`, which served exactly one route
 * (`GET /public/links/n{N}`) and answered `404 SHARE_LINK_NOT_FOUND` to everything else. That
 * was fine while `/c/[slug]` was the only server-rendered route reading the API. It stopped
 * being fine when the `(app)` screens migrated onto the API, because `(app)/layout.tsx` reads
 * the signed-in user **server-side**:
 *
 *     GET /profile/me   → 404  → loadUser() throws
 *     POST /auth/me     → 404  →      ↓
 *                                proxy.ts bounces the navigation to /signin/phone
 *
 * So every test in `card-detail.spec.ts` and `builder.spec.ts` was asserting against a
 * phone-number form. They did not fail loudly at first — they failed as "element not found",
 * which reads like a product bug. Same failure mode, and same cause, as the regression the
 * original stub's own header describes.
 *
 * ## ⚠ THE DATA IS `src/fixtures`, READ FROM A SNAPSHOT — NOT TYPED OUT HERE
 *
 * `tests/stubs/api-snapshot.ts` builds the DTOs from the same fixtures the specs assert against
 * and the unit tests render from; `tests/global-setup.ts` writes them to JSON. This file only
 * routes. Hand-writing the payloads here would have created a second copy of the fixture data,
 * free to drift from the first, and that drift would surface as a product bug in a spec.
 *
 * The snapshot is read **per request** rather than cached at boot, deliberately: it makes the
 * server independent of whether Playwright starts `webServer` before or after `globalSetup`
 * (an order that has changed between versions), and it means editing a fixture does not need
 * the stub restarted.
 *
 * ## ⚠ Reads are real. Writes are accepted and NOT persisted.
 *
 * Every `GET` below answers from the snapshot, so a screen renders exactly what the fixtures
 * say. Mutations answer `200`/`201` with a plausible echo so that pressing Save does not
 * explode — but nothing is stored, and a second `GET` returns the original fixture.
 *
 * That boundary is drawn on purpose rather than out of laziness. A stub with half-real state is
 * the worst of both: a spec that asserts "add a field, reload, it is still there" would pass
 * against fake persistence and prove nothing about the API contract. Suites that need a
 * round-trip should either drive the real API or wait for this stub to grow a real store —
 * which is a deliberate next step, not something to fake convincingly.
 *
 * ⚠ **No authentication is checked, and that is not an oversight.** `proxy.ts` decides whether
 * a request may proceed by looking for a `cb_at` cookie and reading its `exp` — it never
 * verifies a signature, and only the real API is allowed to. The harness mints a token with a
 * future `exp` (`tests/helpers/session.ts`); this server accepts any `Authorization` header,
 * because the thing under test is the screen, not the token.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = Number(process.env.STUB_API_PORT ?? 8788);
const SNAPSHOT = resolve(process.cwd(), "tests/.tmp/api-fixtures.json");

/** The synthetic field the public-link vocabulary builds a card out of. */
const field = (i) => ({ type: "CUSTOM", label: `Field ${i + 1}`, value: `value-${i + 1}` });

function snapshot() {
  try {
    return JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  } catch {
    /* Absent or unreadable — the setup has not run, or was run from another cwd. Answering
       `null` lets each route below 503 with a message that names the cause, instead of the
       server crashing on its first request and taking the whole suite with it. */
    return null;
  }
}

/** The code the stub "sends", and the only one that connects. */
const CONNECT_DEV_CODE = "424242";

/** `code` → the envelope `POST …/connect/otp/verify` answers with. `null` means success. */
const CONNECT_VERIFY_OUTCOMES = {
  [CONNECT_DEV_CODE]: null,
  "000000": [409, "OTP_INVALID", "That code is incorrect."],
  "111111": [409, "OTP_ATTEMPTS_EXCEEDED", "Too many incorrect attempts."],
  "222222": [404, "OTP_NOT_FOUND", "No active code for this number."],
  "333333": [409, "CANNOT_CONNECT_TO_SELF", "You can't connect to your own card."],
};

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};

const notFound = (res, code, message) => json(res, 404, { code, message });

/**
 * What an uploaded card logo resolves to.
 *
 * A `data:` URI rather than a storage URL: the e2e browser has no network beyond localhost, and
 * a card whose logo 404s renders a broken image — which is indistinguishable, to an assertion,
 * from the logo not being wired at all. This is a 1×1 transparent PNG, so it loads instantly
 * and paints nothing that could disturb a contrast or geometry measurement.
 */
const STUB_LOGO_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** Read and discard a request body, so a POST/PATCH/PUT does not hang the socket. */
function drain(req) {
  return new Promise((done) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => done(raw));
    req.on("error", () => done(raw));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  /* The client prefixes `/api/v1`; match on the tail so this server does not care which. */
  const path = url.pathname.replace(/^\/api\/v1/, "").replace(/\/+$/, "") || "/";
  const method = req.method ?? "GET";

  /* `drain` returns what it read. It used to be discarded, because nothing routed on a request
     body — the connect flow below is the first thing that does. */
  const rawBody = method === "GET" ? "" : await drain(req);

  /* ── the public card link, unchanged from the original stub ───────────────────────────
     `n{count}` renders a card carrying exactly that many fields, so a spec can address "the
     shortest article this route can produce" (`n0`) as directly as a full one. Nothing here is
     a real person: the name is the product's own demo identity and every value is synthetic. */
  /* ⚠ `pay` is the one named token: a card mapping a `BANK_ACCOUNT`, so AC-33's rule that the
     PUBLIC card offers no reveal and never carries the raw value has something to be checked
     against. `n{count}` cannot serve it — those fields are all `CUSTOM` by construction. The
     value is the same synthetic account number `src/fixtures/profile.ts` uses, so the profile
     spec can assert the same string is absent here that it revealed there. */
  if (path === "/public/links/pay") {
    return json(res, 200, {
      card: {
        name: "Priyanka Raghunathan",
        kind: "PAYMENT",
        templateId: "ledger",
        paletteId: "sapphire",
        fields: [
          { type: "BANK_ACCOUNT", label: "Business account", value: "50100412345678" },
          { type: "CUSTOM", label: "Studio handle", value: "@fernwood.studio" },
        ],
      },
    });
  }

  const link = /^\/public\/links\/n(\d+)$/.exec(path);
  if (link !== null) {
    const count = Number(link[1]);
    return json(res, 200, {
      card: {
        name: "Priyanka Raghunathan",
        kind: "WORK",
        templateId: "ledger",
        paletteId: "sapphire",
        fields: Array.from({ length: count }, (_, i) => field(i)),
      },
    });
  }

  /* ── the QR-scan "Save & connect" pair ────────────────────────────────────────────────
     `POST /public/links/{token}/connect/otp/{request,verify}` — anonymous, and absent from
     `/api/docs` on the real API, so there is no snapshot entry to drive them from.

     The outcome rides on the **code typed**, so every documented failure is reachable from a
     page that actually rendered — a token that carried the error would leave no card on screen
     to run the flow on:

       · `424242` → 200 `{connected:true}`, and the code `devCode` hands back
       · `000000` → 409 `OTP_INVALID`            (wrong but retryable — the input stays live)
       · `111111` → 409 `OTP_ATTEMPTS_EXCEEDED`  (spent; resend is the only way on)
       · `222222` → 404 `OTP_NOT_FOUND`          (expired, same)
       · `333333` → 409 `CANNOT_CONNECT_TO_SELF` (the owner's own number)

     The request step keys off the **phone**, since no code exists yet: a national number ending
     `99` returns `OTP_COOLDOWN` carrying `retryAfterSeconds: 42`, and one ending `98` returns
     `OTP_RATE_LIMITED`, which carries no retry hint. */
  const connect = /^\/public\/links\/(n\d+)\/connect\/otp\/(request|verify)$/.exec(path);
  if (connect !== null) {
    if (method !== "POST") return notFound(res, "NOT_FOUND", `Cannot ${method} ${path}`);

    let body = {};
    try {
      body = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    } catch {
      body = {};
    }
    const phone = typeof body.phoneE164 === "string" ? body.phoneE164 : "";

    if (connect[2] === "request") {
      if (phone.endsWith("99")) {
        return json(res, 409, {
          statusCode: 409,
          code: "OTP_COOLDOWN",
          message: "Please wait before requesting another code.",
          requestId: "stub-request-id",
          details: { retryAfterSeconds: 42 },
        });
      }
      if (phone.endsWith("98")) {
        return json(res, 409, {
          statusCode: 409,
          code: "OTP_RATE_LIMITED",
          message: "Too many codes requested for this number.",
          requestId: "stub-request-id",
        });
      }
      return json(res, 202, { sent: true, devCode: CONNECT_DEV_CODE });
    }

    const code = typeof body.code === "string" ? body.code : "";
    // An unlisted code behaves like any wrong one, so a typo in a spec reads as a wrong code
    // rather than as a pass.
    /* ⚠ `??` is wrong here and was the bug: success is encoded as `null`, which is nullish, so
       `OUTCOMES[code] ?? fallback` sent the *correct* code down the `OTP_INVALID` path. The
       distinction this needs is "listed at all" (a known code) versus "not listed" (any other
       six digits) — which is `undefined`, not nullish. */
    const listed = CONNECT_VERIFY_OUTCOMES[code];
    const outcome = listed === undefined ? [409, "OTP_INVALID", "That code is incorrect."] : listed;
    if (outcome === null) return json(res, 200, { connected: true });
    return json(res, outcome[0], {
      statusCode: outcome[0],
      code: outcome[1],
      message: outcome[2],
      requestId: "stub-request-id",
    });
  }

  const db = snapshot();
  if (db === null) {
    return json(res, 503, {
      code: "STUB_SNAPSHOT_MISSING",
      message:
        `tests/.tmp/api-fixtures.json is missing. It is written by tests/global-setup.ts — ` +
        `check that playwright.config.ts still declares globalSetup, and that the stub was ` +
        `launched from apps/web.`,
    });
  }

  /* ── the authenticated surface ────────────────────────────────────────────────────────── */

  if (path === "/auth/me") return json(res, 200, db.authMe);
  if (path === "/profile/me" && method === "GET") return json(res, 200, db.me);
  if (path === "/profile/fields" && method === "GET") return json(res, 200, db.fields);
  if (path === "/profile/groups" && method === "GET") return json(res, 200, db.groups);
  if (path === "/share-links" && method === "GET") return json(res, 200, db.shareLinks);
  if (path === "/contacts" && method === "GET") return json(res, 200, db.contacts);
  if (path === "/cards" && method === "GET") return json(res, 200, db.cards);

  const contact = /^\/contacts\/([^/]+)$/.exec(path);
  if (contact !== null && method === "GET") {
    const found = db.contacts.find((c) => c.id === contact[1]);
    return found === undefined
      ? notFound(res, "CONTACT_NOT_FOUND", "This contact does not exist.")
      : json(res, 200, found);
  }

  /* ⚠ `audience` before `/cards/:id`, or the id pattern swallows it. */
  const audience = /^\/cards\/([^/]+)\/audience$/.exec(path);
  if (audience !== null && method === "GET") {
    const card = db.cards.find((c) => c.id === audience[1]);
    if (card === undefined) {
      return notFound(res, "CARD_NOT_FOUND", "This card does not exist.");
    }
    /* No links in the fixture, so nobody holds this card and nobody is behind. This is what
       makes the builder's post-save notify prompt correctly NOT appear here. */
    return json(res, 200, { currentVersion: 1, recipients: [] });
  }

  const card = /^\/cards\/([^/]+)$/.exec(path);
  if (card !== null && method === "GET") {
    const found = db.cards.find((c) => c.id === card[1]);
    return found === undefined
      ? notFound(res, "CARD_NOT_FOUND", "This card does not exist.")
      : json(res, 200, found);
  }

  /* ── writes: accepted, echoed, not stored. See the ⚠ in the module note. ──────────────── */

  if (path === "/cards" && method === "POST") {
    const first = db.cards[0];
    /* ⚠ `multipart/form-data`, not JSON — the create grew a `file` part so a card can be born
       wearing its logo. The stub does not parse the multipart body; it only has to answer the
       one question the UI branches on, which is whether a logo came with the request. The raw
       body carries `name="file"` in a part header exactly when one did. */
    const withLogo = rawBody.includes('name="file"');
    return json(res, 201, {
      ...first,
      id: "card_created_stub",
      fields: [],
      logoUrl: withLogo ? STUB_LOGO_URL : null,
    });
  }

  /* ── the logo pair ───────────────────────────────────────────────────────────────────
     ⚠ Both routes must precede `/cards/:id`'s PATCH/DELETE branch below, or the id pattern
     never sees them — the same ordering hazard `audience` carries above. They are matched here,
     before it, rather than relying on the `([^/]+)$` anchor to exclude them. */
  const logo = /^\/cards\/([^/]+)\/logo$/.exec(path);
  if (logo !== null) {
    const found = db.cards.find((c) => c.id === logo[1]);
    if (found === undefined) return notFound(res, "CARD_NOT_FOUND", "This card does not exist.");

    if (method === "POST") {
      // The whole card, the way the real endpoint answers — so the client can re-map it.
      return json(res, 200, { ...found, logoUrl: STUB_LOGO_URL });
    }
    if (method === "DELETE") {
      res.statusCode = 204;
      return res.end();
    }
  }
  if (card !== null && (method === "PATCH" || method === "DELETE")) {
    const found = db.cards.find((c) => c.id === card[1]);
    return found === undefined
      ? notFound(res, "CARD_NOT_FOUND", "This card does not exist.")
      : json(res, 200, found);
  }
  if (/^\/cards\/[^/]+\/fields$/.test(path)) return json(res, 200, { updated: true });
  if (/^\/cards\/[^/]+\/(archive|restore)$/.test(path)) return json(res, 200, { ok: true });
  if (/^\/cards\/[^/]+\/notify$/.test(path)) return json(res, 201, []);
  if (path === "/profile/fields" && method === "POST") {
    return json(res, 201, { ...db.fields[0], id: "field_created_stub" });
  }
  if (/^\/profile\/fields\/[^/]+$/.test(path) && method === "PATCH") {
    return json(res, 200, db.fields[0]);
  }
  /* ⚠ Without this, `DELETE` fell through to `STUB_ROUTE_UNHANDLED` and the group editor showed
     its generic failure toast — so E-41's confirm path was asserting against an error, not a
     deletion. A 204 is what the API answers. */
  if (/^\/profile\/fields\/[^/]+$/.test(path) && method === "DELETE") {
    res.statusCode = 204;
    return res.end();
  }
  if (path === "/templates") return json(res, 200, []);

  /* ⚠ The raw inbound capture — unscoped by design upstream, so the stub is unscoped too. A
     stub that quietly scoped it would hide the very hazard the route handler exists to
     contain. `?fromPhoneE164=` narrows; `?limit=` truncates. */
  if (path === "/inbound-messages" && method === "GET") {
    const from = url.searchParams.get("fromPhoneE164");
    /* `?source=` narrows to WHATSAPP_MESSAGE or QR_SCAN_CONNECT. The connects route asks for
       each separately so a burst of one kind cannot crowd the other out of the 500-row cap. */
    const source = url.searchParams.get("source");
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const rows = (db.inboundMessages ?? [])
      .filter((m) => from === null || m.fromPhoneE164 === from)
      .filter((m) => source === null || m.source === source)
      .slice(0, Number.isFinite(limit) ? limit : 100);
    return json(res, 200, rows);
  }

  /* Anything unrecognised. Named so a spec failing here says which route is missing rather
     than reporting an empty screen. */
  return notFound(res, "STUB_ROUTE_UNHANDLED", `The e2e stub has no handler for ${method} ${path}.`);
});

server.listen(PORT, () => {
  process.stdout.write(`e2e api stub listening on ${PORT}\n`);
});
