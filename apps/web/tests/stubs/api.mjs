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
 * ## ⚠ Reads are real. Writes are persisted ONLY for a spec that opts in.
 *
 * By default every `GET` answers from the snapshot and every mutation answers `200`/`201` with
 * a plausible echo that is **not stored** — exactly as this stub has always behaved, and what
 * all 22 existing spec files still get.
 *
 * A spec that needs a genuine round trip opts in by signing in with its own `sub`:
 *
 *     await signIn(context, baseURL, { sub: statefulSub("cover-upload") });
 *
 * That hands it a private, mutable copy of the fixture world — see `state.mjs`, which explains
 * why the isolation is per-`sub` (this one process serves three viewport projects running
 * `fullyParallel`, so a shared store would be a race) and, more importantly, what a pass against
 * it does and does not prove.
 *
 * The old blanket refusal to store anything was right for what this stub was then, and its own
 * note called a real store "a deliberate next step, not something to fake convincingly". The
 * card-appearance work is the case that forced it: the entire point of giving `coverUrl`,
 * `headline`, `bio` and the design axes real columns is that they **survive a reload**, and a
 * stub that discards the `PATCH` renders identically whether the client is right or broken.
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

import {
  Rejected,
  cardPatch,
  coverDataUrl,
  dashboard,
  filePart,
  formFields,
  partitionFor,
} from "./state.mjs";

const PORT = Number(process.env.STUB_API_PORT ?? 8788);

/**
 * `STUB_LOG_REQUESTS=1` prints one line per request — `METHOD /path` and nothing else, never a
 * body or a header — so a manual check can see exactly which writes a screen sent and when (for
 * example, that ticking a field on `/profile` sends nothing until Save changes). Off by default;
 * the suite does not read it.
 */
const LOG_REQUESTS = process.env.STUB_LOG_REQUESTS === "1";
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

/**
 * Read the whole request body, so a POST/PATCH/PUT does not hang the socket.
 *
 * ⚠ **Collects Buffers and concatenates once, rather than `raw += chunk`.** The old string
 * accumulation decoded every chunk as UTF-8, which corrupts any byte above 0x7F — i.e. most of a
 * JPEG. That did not matter while no route read an uploaded file's contents; the cover endpoint
 * echoes the bytes back so a spec can prove the image that reaches the card is the one the crop
 * dialog produced, and that assertion is worthless if this function mangles them.
 *
 * Callers that want text call `.toString("utf8")` themselves — JSON bodies are unaffected.
 */
function drain(req) {
  return new Promise((done) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => done(Buffer.concat(chunks)));
    req.on("error", () => done(Buffer.concat(chunks)));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  /* The client prefixes `/api/v1`; match on the tail so this server does not care which. */
  const path = url.pathname.replace(/^\/api\/v1/, "").replace(/\/+$/, "") || "/";
  const method = req.method ?? "GET";
  if (LOG_REQUESTS) process.stdout.write(`${new Date().toISOString()} ${method} ${path}\n`);

  /* `drain` returns what it read, as bytes. `rawBody` is the text view for the JSON routes;
     `rawBytes` is what the multipart parser needs — see the ⚠ on `drain`. */
  const rawBytes = method === "GET" ? Buffer.alloc(0) : await drain(req);
  const rawBody = rawBytes.toString("utf8");

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
  /* ── "Send to my phone" — `POST /public/links/{token}/connect/send` ──────────────────
     One call, no code. Like the OTP routes it is anonymous and absent from `/api/docs`, so the
     outcome rides on the **phone** — a national number ending:

       · `97` → 409 `CANNOT_CONNECT_TO_SELF` (the owner's own number; the input stays live)
       · `96` → 410 `SHARE_LINK_REVOKED`     (the owner turned the card off while the page was
                                              open — the flow goes terminal)
       · anything else → 200 `{connected:true}`

     The suffixes are distinct from the OTP routes' `98`/`99` so no number means two things. */
  const connectSend = /^\/public\/links\/(n\d+)\/connect\/send$/.exec(path);
  if (connectSend !== null) {
    if (method !== "POST") return notFound(res, "NOT_FOUND", `Cannot ${method} ${path}`);
    let body = {};
    try {
      body = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    } catch {
      body = {};
    }
    const phone = typeof body.phoneE164 === "string" ? body.phoneE164 : "";
    const fail = (status, code, message) =>
      json(res, status, { statusCode: status, code, message, requestId: "stub-request-id" });

    if (phone.endsWith("97")) {
      return fail(409, "CANNOT_CONNECT_TO_SELF", "You can't connect to your own card.");
    }
    if (phone.endsWith("96")) {
      return fail(410, "SHARE_LINK_REVOKED", "This card is no longer being shared.");
    }
    return json(res, 200, { connected: true });
  }

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

  /* ── the STATEFUL surface — only for a spec that opted in ─────────────────────────────
     `partitionFor` returns null for every other caller, and everything below is skipped, so
     the 22 existing spec files see exactly the stateless stub they always did. See `state.mjs`
     for why isolation is keyed on the token's `sub` and what a pass here proves. */
  const store = partitionFor(req.headers.authorization, db);
  if (store !== null) {
    try {
      const answer = await stateful({ store, db, path, method, rawBody, rawBytes, req });
      if (answer !== undefined) {
        if (answer.status === 204) {
          res.statusCode = 204;
          return res.end();
        }
        return json(res, answer.status, answer.body);
      }
    } catch (thrown) {
      if (thrown instanceof Rejected) return json(res, thrown.status, thrown.body);
      throw thrown;
    }
    /* Fell through: a route this partition does not override. The stateless handlers below
       answer it from the snapshot, which is correct for every read the store does not own. */
  }

  /* ── the authenticated surface ────────────────────────────────────────────────────────── */

  if (path === "/auth/me") return json(res, 200, db.authMe);
  if (path === "/profile/me" && method === "GET") return json(res, 200, db.me);
  if (path === "/profile/fields" && method === "GET") return json(res, 200, db.fields);
  if (path === "/profile/groups" && method === "GET") return json(res, 200, db.groups);
  if (path === "/share-links" && method === "GET") return json(res, 200, db.shareLinks);
  if (path === "/contacts" && method === "GET") return json(res, 200, db.contacts);
  if (path === "/cards" && method === "GET") return json(res, 200, db.cards);
  /* ⚠ `GET /dashboard` for the DEFAULT identity, computed from the snapshot with no links.
     The stateful router answers it for opted-in specs, but the dashboard screen now reads this
     endpoint and nothing else for its numbers — so without a stateless answer every spec signed
     in as `e2e-fixture-user` (all of `dashboard.spec.ts`) got a 404 and an error panel. Same
     computation as the stateful path, over the fixture world as it stands: nothing shared yet. */
  if (path === "/dashboard" && method === "GET") {
    return json(res, 200, dashboard({ cards: db.cards, shareLinks: [] }, db));
  }

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


/**
 * Every route whose result depends on what this partition has already written.
 *
 * Returns `{status, body}` to answer, or `undefined` to fall through to the stateless handlers.
 * Throws {@link Rejected} to answer with the API's own error envelope.
 *
 * ⚠ **Order matters exactly as it does below**: `/cards/:id/cover` and `/cards/:id/logo` are
 * matched before the bare `/cards/:id`, or its `([^/]+)$` pattern swallows them.
 */
async function stateful({ store, db, path, method, rawBody, rawBytes, req }) {
  const body = () => {
    try {
      return rawBody.length > 0 ? JSON.parse(rawBody) : {};
    } catch {
      return {};
    }
  };
  const find = (id) => store.cards.find((c) => c.id === id);
  const stamp = (card) => {
    card.updatedAt = new Date().toISOString();
    return card;
  };
  const cardNotFound = () =>
    new Rejected(404, "CARD_NOT_FOUND", "This card does not exist.");

  if (path === "/dashboard" && method === "GET") {
    return { status: 200, body: dashboard(store, db) };
  }

  if (path === "/cards" && method === "GET") return { status: 200, body: store.cards };
  if (path === "/share-links" && method === "GET") return { status: 200, body: store.shareLinks };

  if (path === "/cards" && method === "POST") {
    /* ⚠ `multipart/form-data`, always — the create grew a `file` part so a card can be born
       wearing its logo. Its other properties therefore arrive as form fields, i.e. as strings. */
    const fields = formFields(rawBytes, req.headers["content-type"]);
    const logo = filePart(rawBytes, req.headers["content-type"]);
    store.seq += 1;
    const id = `card_stateful_${store.seq}`;
    const created = {
      id,
      name: fields.name ?? "Untitled card",
      kind: fields.kind ?? "CUSTOM",
      templateId: fields.templateId ?? "meridian",
      paletteId: fields.paletteId ?? null,
      groundHex: fields.groundHex ?? null,
      finish: fields.finish ?? "gradient",
      texture: fields.texture ?? "none",
      texturePresence: fields.texturePresence ?? null,
      textureScale: fields.textureScale ?? null,
      /* ⚠ `headline` and `bio` ride the create; a cover never can — it has no part on this
         endpoint and `PATCH` rejects a URL, so it is always `POST /cards/:id/cover` afterwards. */
      headline: fields.headline ?? null,
      bio: fields.bio ?? null,
      coverUrl: null,
      logoUrl: logo === null ? null : STUB_LOGO_URL,
      publicUrl: `http://localhost:3100/c/${id}`,
      currentVersion: 1,
      fields: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.cards.push(created);
    return { status: 201, body: created };
  }

  const cover = /^\/cards\/([^/]+)\/cover$/.exec(path);
  if (cover !== null) {
    const card = find(cover[1]);
    if (card === undefined) throw cardNotFound();

    if (method === "POST") {
      /* Validates type and the 5MB cap, then echoes the ACTUAL bytes back as a data URL — so a
         spec can assert the image the card renders is the one the crop dialog produced. */
      card.coverUrl = coverDataUrl(filePart(rawBytes, req.headers["content-type"]));
      return { status: 200, body: stamp(card) };
    }
    if (method === "DELETE") {
      if (card.coverUrl === null) {
        throw new Rejected(404, "COVER_NOT_FOUND", "This card has no cover to remove.");
      }
      card.coverUrl = null;
      stamp(card);
      return { status: 204 };
    }
  }

  const logo = /^\/cards\/([^/]+)\/logo$/.exec(path);
  if (logo !== null) {
    const card = find(logo[1]);
    if (card === undefined) throw cardNotFound();
    if (method === "POST") {
      card.logoUrl = STUB_LOGO_URL;
      return { status: 200, body: stamp(card) };
    }
    if (method === "DELETE") {
      if (card.logoUrl === null) {
        throw new Rejected(404, "LOGO_NOT_FOUND", "This card has no logo to remove.");
      }
      card.logoUrl = null;
      stamp(card);
      return { status: 204 };
    }
  }

  const fieldsRoute = /^\/cards\/([^/]+)\/fields$/.exec(path);
  if (fieldsRoute !== null && method === "PUT") {
    const card = find(fieldsRoute[1]);
    if (card === undefined) throw cardNotFound();
    /* ⚠ REPLACES the whole curated set — not a merge. A client that sent only what changed
       would silently strip the rest, and this is where that shows up. */
    const entries = body().fields ?? [];
    card.fields = entries.flatMap((entry, position) => {
      const field = db.fields.find((f) => f.id === entry.fieldId);
      if (field === undefined) return [];
      return [
        {
          fieldId: field.id,
          category: field.category,
          type: field.type,
          label: entry.labelOverride ?? field.label,
          value: field.value,
          visible: entry.visible !== false,
          position,
        },
      ];
    });
    /* Bumped only by a field-set change, never by an appearance PATCH — a palette swap is not
       something a recipient can perceive as "the card changed". */
    card.currentVersion += 1;
    return { status: 200, body: stamp(card) };
  }

  const share = /^\/cards\/([^/]+)\/share$/.exec(path);
  if (share !== null && method === "POST") {
    const card = find(share[1]);
    if (card === undefined) throw cardNotFound();
    const contactId = body().contactId;
    const contact = db.contacts.find((c) => c.id === contactId);
    if (contact === undefined) {
      throw new Rejected(404, "CONTACT_NOT_FOUND", "This contact does not exist.");
    }
    /* ⚠ Idempotent per (card, contact) — the same token comes back rather than a second link.
       A double tap on Send must not mint two links, and the dashboard must not count one
       person twice. */
    const existing = store.shareLinks.find(
      (l) => l.cardId === card.id && l.contactId === contactId,
    );
    if (existing !== undefined) return { status: 201, body: existing };

    store.seq += 1;
    const link = {
      id: `link_stateful_${store.seq}`,
      cardId: card.id,
      contactId,
      token: `tok${store.seq}`,
      url: `http://localhost:3100/c/tok${store.seq}`,
      /* ⚠ The recipient and card are echoed on the link, exactly as the API's toResponseDto does.
         Omitting them made the share dialog throw formatting an undefined number — a stub gap,
         since the real response always carries all three. */
      cardName: card.name,
      contactPhoneE164: contact.phoneE164,
      contactDisplayName: contact.displayName ?? null,
      status: "ACTIVE",
      viewCount: 0,
      firstViewedAt: null,
      lastViewedAt: null,
      lastNotifiedVersion: card.currentVersion,
      createdAt: new Date().toISOString(),
    };
    store.shareLinks.push(link);
    return { status: 201, body: link };
  }

  const audience = /^\/cards\/([^/]+)\/audience$/.exec(path);
  if (audience !== null && method === "GET") {
    const card = find(audience[1]);
    if (card === undefined) throw cardNotFound();
    return {
      status: 200,
      body: {
        currentVersion: card.currentVersion,
        recipients: store.shareLinks
          .filter((l) => l.cardId === card.id && l.status === "ACTIVE")
          .map((l) => {
            const contact = db.contacts.find((c) => c.id === l.contactId);
            return {
              shareLinkId: l.id,
              contactId: l.contactId,
              contactDisplayName: contact?.displayName ?? null,
              contactPhoneE164: contact?.phoneE164 ?? "+910000000000",
              lastNotifiedVersion: l.lastNotifiedVersion,
              versionsBehind: Math.max(card.currentVersion - (l.lastNotifiedVersion ?? 0), 0),
              viewCount: l.viewCount,
              lastViewedAt: l.lastViewedAt,
            };
          }),
      },
    };
  }

  const one = /^\/cards\/([^/]+)$/.exec(path);
  if (one !== null) {
    const card = find(one[1]);
    if (card === undefined) throw cardNotFound();

    if (method === "GET") return { status: 200, body: card };
    if (method === "PATCH") {
      /* ⚠ The whole contract in one line: `cardPatch` validates the closed sets and the length
         caps, enforces that `coverUrl` may only ever be null, and — crucially — returns ONLY
         the keys the request actually carried, so an omitted field is left alone and an explicit
         null clears it. Merging a defaulted object here would erase every column the client did
         not mention. */
      Object.assign(card, cardPatch(body()));
      return { status: 200, body: stamp(card) };
    }
    if (method === "DELETE") {
      store.cards = store.cards.filter((c) => c.id !== card.id);
      /* Archiving a card revokes every active link on it — recipients get a 410 rather than a
         link that quietly still works. */
      for (const link of store.shareLinks) {
        if (link.cardId === card.id) link.status = "REVOKED";
      }
      return { status: 204 };
    }
  }

  return undefined;
}

server.listen(PORT, () => {
  process.stdout.write(`e2e api stub listening on ${PORT}\n`);
});
