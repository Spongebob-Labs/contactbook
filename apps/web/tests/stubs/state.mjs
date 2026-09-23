/**
 * **A REAL, MUTABLE STORE FOR THE E2E STUB — opt-in, and isolated per test.**
 *
 * ## Why this exists at all
 *
 * `api.mjs` opened with a warning that reads, in part: *"a spec that asserts 'add a field,
 * reload, it is still there' would pass against fake persistence and prove nothing about the API
 * contract. Suites that need a round-trip should either drive the real API or wait for this stub
 * to grow a real store — which is a deliberate next step, not something to fake convincingly."*
 *
 * This is that step. It exists because the card-appearance and dashboard work is precisely the
 * case that warning describes: the whole point of giving `coverUrl`, `headline`, `bio` and the
 * seven design axes real columns was that they **survive a reload and reach another device**.
 * A stub that discards the `PATCH` cannot tell a working integration from a broken one — the
 * screen looks identical either way, which is how the `localStorage` shim survived as long as
 * it did.
 *
 * ## ⚠ WHAT A PASS HERE DOES AND DOES NOT PROVE
 *
 * It proves the **client** side end to end: that the browser sends the right request to the
 * right path with the right body, that it reads the response back rather than its own local
 * state, and that a reload re-renders from the server. The stub validates the closed enum sets,
 * the length caps, the `coverUrl`-is-null-only rule and the upload limits, so a client that
 * sends something the real API would reject fails here too.
 *
 * It does **not** prove the server: the real aggregation, the real Prisma writes and the real
 * masking are the API's own Jest suite's job, and this file is not a second implementation of
 * them to be trusted — it is a fixture shaped like one. Where the two could drift, the
 * constants below are copied from `apps/api/src/sharing/dto/card-appearance.constants.ts` and
 * the aggregation from `apps/api/src/dashboard/dashboard.service.ts`, each marked.
 *
 * ## ⚠ HOW ISOLATION WORKS, AND WHY IT IS OPT-IN
 *
 * Playwright runs `fullyParallel` across three viewport projects against **one** stub process.
 * Persisted writes are therefore visible to every other test in flight, which would turn 22
 * existing spec files into a race — `cards-list.spec.ts` reading a card `builder.spec.ts` had
 * just renamed.
 *
 * So state is **keyed by the `sub` claim of the bearer token**, and only for subs beginning
 * `{@link STATEFUL_SUB_PREFIX}`. Every existing spec signs in as `e2e-fixture-user`, gets no
 * partition, and sees exactly the behaviour it always had: reads from the snapshot, writes
 * echoed and discarded. A spec that wants a round-trip calls `signIn(ctx, url, { sub })` with
 * its own unique sub and gets a private copy of the fixture world that nothing else can see.
 *
 * ⚠ **A partition is never reclaimed.** The process is short-lived and a suite mints a few
 * dozen subs at most; a cache eviction here would be a source of flake far worse than the
 * memory it saves.
 */

/** Only tokens whose `sub` starts with this get a mutable partition. See the ⚠ above. */
export const STATEFUL_SUB_PREFIX = "e2e-state-";

/* ── The closed sets, copied from the API ─────────────────────────────────────────────
   ⚠ `apps/api/src/sharing/dto/card-appearance.constants.ts` is the original. Duplicated rather
   than imported because this is a plain-Node process with no TypeScript runner and no path
   alias into `apps/api`. If the API adds a palette and this list is not updated, the symptom is
   a spec failing on a value the real API accepts — noisy, and in the right direction. */
const TEMPLATE_IDS = ["meridian", "marigold"];
const PALETTE_IDS = [
  "onyx", "sapphire", "emerald", "oxblood", "rust", "amber",
  "clay", "pistachio", "periwinkle", "mint", "ivory",
];
const FINISH_IDS = ["flat", "gradient", "mesh"];
const TEXTURE_IDS = ["none", "grain", "grid", "dots", "topo"];
const TEXTURE_PRESENCE_IDS = ["subtle", "medium", "strong"];
const TEXTURE_SCALE_IDS = ["fine", "regular", "large"];
const GROUND_HEX = /^#[0-9A-Fa-f]{6}$/;

/** `POST /cards/:id/cover` — 5MB, a quarter of the logo's cap, and the same three types. */
export const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** sub → partition. Never evicted; see the ⚠ in the module note. */
const partitions = new Map();

/**
 * The `sub` claim of a bearer token, without verifying anything.
 *
 * ⚠ Signature-blind on purpose, exactly as `proxy.ts` is: the harness mints `alg: "none"`
 * tokens and nothing in this process is entitled to decide whether a request is authentic.
 * Only the real API is. This reads one claim to pick a bucket.
 */
export function subOf(authorization) {
  if (typeof authorization !== "string") return null;
  const raw = authorization.replace(/^Bearer\s+/i, "");
  const segments = raw.split(".");
  if (segments.length !== 3) return null;
  try {
    const json = Buffer.from(
      segments[1].replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const sub = JSON.parse(json).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/**
 * This request's partition, or `null` when the caller did not ask for one.
 *
 * `null` is the signal to `api.mjs` to behave exactly as it did before this file existed.
 */
export function partitionFor(authorization, snapshot) {
  const sub = subOf(authorization);
  if (sub === null || !sub.startsWith(STATEFUL_SUB_PREFIX)) return null;

  let partition = partitions.get(sub);
  if (partition === undefined) {
    partition = {
      /* A deep copy, so one test's mutations cannot reach the snapshot every other test reads
         straight off disk. `structuredClone` rather than JSON round-tripping because the
         snapshot is plain JSON already and this states the intent. */
      cards: structuredClone(snapshot.cards),
      shareLinks: [],
      seq: 0,
    };
    partitions.set(sub, partition);
  }
  return partition;
}

/* ── errors ──────────────────────────────────────────────────────────────────────────── */

/** The API's one error envelope. `code` is what a client branches on; `message` is for people. */
export function envelope(status, code, message) {
  return { statusCode: status, code, message, requestId: "stub-request-id" };
}

class Rejected extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.body = envelope(status, code, message);
  }
}

/** A 400 in the shape `class-validator` produces, so client-side copy is exercised honestly. */
function badRequest(message) {
  return new Rejected(400, "VALIDATION_FAILED", message);
}

export { Rejected };

/* ── card writes ─────────────────────────────────────────────────────────────────────── */

function oneOf(body, key, allowed, out) {
  if (!(key in body)) return; // ⚠ Omitted leaves the stored value alone.
  const value = body[key];
  if (value === null) {
    out[key] = null;
    return;
  }
  if (!allowed.includes(value)) {
    throw badRequest(`${key} must be one of the following values: ${allowed.join(", ")}`);
  }
  out[key] = value;
}

function text(body, key, max, out) {
  if (!(key in body)) return;
  const value = body[key];
  if (value === null) {
    out[key] = null;
    return;
  }
  if (typeof value !== "string") throw badRequest(`${key} must be a string`);
  if (value.length > max) {
    throw badRequest(`${key} must be shorter than or equal to ${max} characters`);
  }
  out[key] = value;
}

/**
 * The validated patch for `PATCH /cards/:id` — **omitted and `null` are different**, and that
 * distinction is the contract this function exists to enforce. An omitted key leaves the stored
 * column alone; an explicit `null` clears it. A stub that treated them alike would pass a client
 * that could not unmake a choice.
 */
export function cardPatch(body) {
  const out = {};

  if ("name" in body) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      throw badRequest("name should not be empty");
    }
    if (body.name.length > 80) {
      throw badRequest("name must be shorter than or equal to 80 characters");
    }
    out.name = body.name;
  }
  if ("kind" in body) out.kind = body.kind;

  /* ⚠ templateId is the one axis that is NOT nullable — every card always has a template. */
  if ("templateId" in body) {
    if (body.templateId === null) throw badRequest("templateId must be one of the following values: " + TEMPLATE_IDS.join(", "));
    oneOf(body, "templateId", TEMPLATE_IDS, out);
  }
  oneOf(body, "paletteId", PALETTE_IDS, out);
  oneOf(body, "finish", FINISH_IDS, out);
  oneOf(body, "texture", TEXTURE_IDS, out);
  oneOf(body, "texturePresence", TEXTURE_PRESENCE_IDS, out);
  oneOf(body, "textureScale", TEXTURE_SCALE_IDS, out);

  if ("groundHex" in body) {
    if (body.groundHex === null) out.groundHex = null;
    else if (typeof body.groundHex !== "string" || !GROUND_HEX.test(body.groundHex)) {
      throw badRequest("groundHex must be a #RRGGBB hex colour");
    } else out.groundHex = body.groundHex;
  }

  text(body, "headline", 80, out);
  text(body, "bio", 280, out);

  /**
   * ⚠ **`coverUrl` accepts literal `null` and nothing else.** A real cover can only ever come
   * from `POST /cards/:id/cover`, so a client that tried to write one as a string here would be
   * writing a URL the API would never have stored — and the card would render it in the builder
   * while a recipient saw nothing. The 400 is what stops that being discovered in production.
   */
  if ("coverUrl" in body) {
    if (body.coverUrl !== null) {
      throw badRequest(
        "coverUrl can only be explicitly set to null (to remove it) — upload a new cover via POST /cards/:id/cover",
      );
    }
    out.coverUrl = null;
  }

  return out;
}

/* ── multipart ───────────────────────────────────────────────────────────────────────── */

/**
 * The `file` part of a `multipart/form-data` body, as bytes plus its declared type.
 *
 * ⚠ A deliberately minimal parser, and it takes a **Buffer** rather than a string: the body is
 * a JPEG, and reading it as UTF-8 first re-encodes every byte above 0x7F. The cover test asserts
 * the stored image is byte-identical to what the crop dialog produced, which is only meaningful
 * if nothing in this path mangles it.
 */
export function filePart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  if (match === null) return null;
  const boundary = Buffer.from(`--${match[1] ?? match[2]}`);

  let cursor = buffer.indexOf(boundary);
  while (cursor !== -1) {
    const headerStart = cursor + boundary.length;
    const headerEnd = buffer.indexOf("\r\n\r\n", headerStart, "latin1");
    if (headerEnd === -1) return null;

    const headers = buffer.toString("latin1", headerStart, headerEnd);
    const next = buffer.indexOf(boundary, headerEnd);
    if (next === -1) return null;

    if (/name="file"/.test(headers)) {
      /* Back off the CRLF that belongs to the delimiter, not to the payload. */
      const body = buffer.subarray(headerEnd + 4, next - 2);
      const type = /content-type:\s*([^\r\n;]+)/i.exec(headers);
      return { bytes: body, type: type === null ? "application/octet-stream" : type[1].trim() };
    }
    cursor = next;
  }
  return null;
}

/** The plain form fields of a multipart body — what `POST /cards` sends its card properties as. */
export function formFields(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  if (match === null) return {};
  const boundary = `--${match[1] ?? match[2]}`;
  const out = {};

  for (const chunk of buffer.toString("latin1").split(boundary)) {
    const split = chunk.indexOf("\r\n\r\n");
    if (split === -1) continue;
    const headers = chunk.slice(0, split);
    if (/filename=/.test(headers)) continue; // a file, not a field
    const name = /name="([^"]+)"/.exec(headers);
    if (name === null) continue;
    out[name[1]] = chunk.slice(split + 4, chunk.length - 2);
  }
  return out;
}

/**
 * An uploaded image as a `data:` URL, validated against the cover endpoint's own limits.
 *
 * A data URL rather than a storage URL because the e2e browser has no network beyond localhost,
 * and a cover whose `src` 404s renders a broken image — indistinguishable, to an assertion, from
 * the upload not being wired at all. Echoing the actual bytes back also makes the round trip
 * checkable: the test can compare what the card renders against what it uploaded.
 */
export function coverDataUrl(part) {
  if (part === null) throw new Rejected(400, "VALIDATION_FAILED", "file is required");
  if (!COVER_TYPES.includes(part.type)) {
    throw new Rejected(415, "COVER_TYPE_UNSUPPORTED", "Use a JPEG, PNG or WebP image.");
  }
  if (part.bytes.length > COVER_MAX_BYTES) {
    throw new Rejected(413, "COVER_TOO_LARGE", "Covers must be 5MB or smaller.");
  }
  return `data:${part.type};base64,${part.bytes.toString("base64")}`;
}

/* ── the dashboard ───────────────────────────────────────────────────────────────────── */

/** Monday 00:00 UTC of the week containing `iso`, as `YYYY-MM-DD`. */
function weekStartOf(iso) {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day),
  ).toISOString().slice(0, 10);
}

/**
 * `GET /dashboard`, computed the way `apps/api/src/dashboard/dashboard.service.ts` computes it.
 *
 * ⚠ **`peopleReached`, `peopleOpened` and `behind` come from one pass over one ACTIVE-link
 * set**, and that is the single most important property to preserve here rather than a detail of
 * how it is written. The bug the endpoint exists to fix was two client-side reductions over
 * different collections, which let `behind` exceed `peopleReached` — a state that cannot exist.
 * Computing them in separate loops here would let a client regression slip through the very
 * suite meant to catch it.
 */
export function dashboard(partition, snapshot) {
  const cards = partition.cards;
  const cardIds = new Set(cards.map((c) => c.id));
  const active = partition.shareLinks.filter(
    (l) => l.status === "ACTIVE" && cardIds.has(l.cardId),
  );

  const opensByCard = new Map();
  const recipientsByCard = new Map();
  const behindByCard = new Map();
  const neverOpenedByCard = new Map();
  const reached = new Set();
  const opened = new Set();
  const behindContacts = new Set();
  let totalOpens = 0;
  let neverOpened = 0;

  const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

  for (const link of active) {
    reached.add(link.contactId);
    totalOpens += link.viewCount;
    bump(recipientsByCard, link.cardId);
    opensByCard.set(link.cardId, (opensByCard.get(link.cardId) ?? 0) + link.viewCount);

    if (link.viewCount > 0) opened.add(link.contactId);
    else {
      neverOpened += 1;
      bump(neverOpenedByCard, link.cardId);
    }

    const card = cards.find((c) => c.id === link.cardId);
    const versionsBehind = (card?.currentVersion ?? 1) - (link.lastNotifiedVersion ?? 0);
    if (versionsBehind > 0) {
      bump(behindByCard, link.cardId);
      behindContacts.add(link.contactId);
    }
  }

  const cardReach = cards.map((c) => ({
    cardId: c.id,
    cardName: c.name,
    opens: opensByCard.get(c.id) ?? 0,
    recipients: recipientsByCard.get(c.id) ?? 0,
  }));

  /* ⚠ Kind-priority order, worst-first within each kind — and the zero-activity kinds are
     INCLUDED. A card with no fields or no shares is the most actionable row on the screen. */
  const of = (kind, rows) =>
    rows.sort((a, b) => b.count - a.count).map((r) => ({ kind, ...r }));

  const noFields = [];
  const behindRows = [];
  const neverOpenedRows = [];
  const neverShared = [];

  for (const card of cards) {
    const row = { cardId: card.id, cardName: card.name };
    if (card.fields.length === 0) {
      noFields.push({ ...row, count: 0 });
      continue; // An empty card's reach problems are downstream of it being empty.
    }
    const behind = behindByCard.get(card.id) ?? 0;
    if (behind > 0) behindRows.push({ ...row, count: behind });
    if ((recipientsByCard.get(card.id) ?? 0) === 0) neverShared.push({ ...row, count: 0 });
    else {
      const unopened = neverOpenedByCard.get(card.id) ?? 0;
      if (unopened > 0) neverOpenedRows.push({ ...row, count: unopened });
    }
  }

  const attention = [
    ...of("no-fields", noFields),
    ...of("behind", behindRows),
    ...of("never-opened", neverOpenedRows),
    ...of("never-shared", neverShared),
  ];

  /* 12 weekly buckets, oldest first, INCLUDING the empty weeks — the gaps are the point, and
     the count is links CREATED, never opens. There is no per-view log to draw one from. */
  const created = new Map();
  for (const link of partition.shareLinks) {
    const key = weekStartOf(link.createdAt);
    created.set(key, (created.get(key) ?? 0) + 1);
  }
  const thisMonday = weekStartOf(new Date().toISOString());
  const sharingActivity = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(thisMonday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    sharingActivity.push({ weekStart: key, count: created.get(key) ?? 0 });
  }

  return {
    totals: {
      cards: cards.length,
      contacts: snapshot.contacts.length,
      fields: snapshot.fields.length,
      peopleReached: reached.size,
      peopleOpened: opened.size,
      totalOpens,
      neverOpened,
      /* ⚠ null, never 0, with no cards at all — "nothing to compute this from", which the UI
         must render differently from "checked, nobody is behind". */
      behind: cards.length === 0 ? null : behindContacts.size,
    },
    cardReach,
    attention,
    sharingActivity,
    /* Every group, including the empty ones — they are the whole point of the panel. */
    groups: snapshot.groups.map((g) => ({
      id: g.id,
      name: g.tag ?? titleCase(g.category ?? ""),
      fieldCount: (g.fields ?? []).length,
    })),
  };
}

function titleCase(value) {
  return value.length === 0 ? "" : value.charAt(0) + value.slice(1).toLowerCase();
}
