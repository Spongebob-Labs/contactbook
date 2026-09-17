import "server-only";

/**
 * Resolving a public share link — `GET /api/v1/public/links/{token}`.
 *
 * This is the endpoint a stranger's browser hits after tapping the WhatsApp link. It is the other
 * half of `POST /cards/{id}/share`: that mints a link whose `url` ends in `/c/{token}`, and this
 * turns the token back into a card.
 *
 * ## ⚠ It is live but undocumented
 * It does **not** appear in `GET /api/docs-json` — the live spec still lists 36 operations and this
 * is not one of them. That is why an earlier guess at `/public/cards/{token}` was wrong. The two
 * are distinguishable by their 404s, which is how this one was confirmed:
 *
 * ```
 * /public/links/{token} → 404 {"code":"SHARE_LINK_NOT_FOUND","message":"This link does not exist."}
 * /public/cards/{token} → 404 {"code":"NOT_FOUND","message":"Cannot GET /api/v1/public/cards/…"}
 * ```
 *
 * A domain code means the route exists and the record does not. `Cannot GET` means the route
 * itself is absent. Worth asking the backend to add this to Swagger, so the next person does not
 * have to probe for it.
 *
 * ## ⚠ The success payload's exact field names are unverified
 * Confirming them needs one real token, which needs a signed-in account that has shared a card.
 * So {@link parsePublicCard} is **shape-tolerant**: it looks for the same few pieces of
 * information in each of the layouts this endpoint plausibly returns, rather than betting on one.
 * It also reports which layout it matched, so a single real link settles it immediately — check
 * the `[api]` log line and `data-public-shape` on the rendered page.
 *
 * What it needs to find, at minimum: the owner's name and a list of fields. Everything else has a
 * sensible absence.
 */

import { API_PREFIX, REQUEST_TIMEOUT_MS, apiBaseUrl } from "@/lib/api/config";
import { logApiCall } from "@/lib/api/log";
import {
  NO_APPEARANCE,
  hasAppearance,
  readAppearance,
  type CardAppearance,
} from "@/lib/api/card-appearance";

/** One row on the card, as a stranger receives it. */
export interface PublicField {
  type: string;
  label: string;
  value: string;
}

/**
 * ⚠ The design type and its validator live in `@/lib/api/card-appearance`, not here.
 *
 * `map.ts` reads the same seven axes off `GET /cards/{id}` and the two must agree exactly, or
 * the owner's card and the card their recipient opens are two different cards. That module is
 * the one both import; this file only decides *where in the payload* to look.
 */
export type { CardAppearance } from "@/lib/api/card-appearance";
export { NO_APPEARANCE } from "@/lib/api/card-appearance";

export interface PublicCardPayload {
  /** The card's own name, e.g. "Work". Absent on a payload that only carries the person. */
  cardName: string | null;
  /** `WORK` / `PERSONAL` / `PAYMENT` / `CUSTOM`, when the payload says. Drives the card's look. */
  kind: string | null;
  fullName: string;
  avatarUrl: string | null;
  /**
   * The card's logo, when the owner uploaded one. `null` otherwise, and `null` on any API build
   * that does not send the key — the two are the same state, and the renderer's fallback mark
   * covers both.
   *
   * ⚠ Looked up through the same `attr()` ladder as `cardName` and `kind`, for the same reason:
   * staging sends `{ owner, card: { … }, fields: [] }`, so a card attribute read off whichever
   * layout happened to carry the *rows* comes back null on every real payload.
   */
  logoUrl: string | null;
  fields: PublicField[];
  /**
   * The owner's saved design. {@link NO_APPEARANCE} when the payload carries none — which is
   * both "this card never chose" and "this API build does not send it yet".
   */
  appearance: CardAppearance;
  /**
   * Axes the API sent that this build could not read, as `axis=value` — e.g. `finish=matte`.
   *
   * Empty on a healthy payload. Non-empty means the two sides' vocabularies have diverged, and
   * the card is rendering a default where the owner chose something. Surfaced in the `[api]`
   * log line so that shows up as a line to read rather than as a card that is quietly the
   * wrong colour.
   */
  appearanceRejected: readonly string[];
  /**
   * Which layout matched, for diagnosis. Rendered as `data-public-shape` and logged, so the first
   * real link tells us what the API actually sends without guesswork.
   */
  shape: string;
}

export type PublicCardResult =
  | { kind: "ok"; card: PublicCardPayload }
  /** The token is unknown, or its card was unpublished — the API keeps those indistinguishable. */
  | { kind: "not-found" }
  /** The owner revoked this link. The API documents 410 for exactly this. */
  | { kind: "revoked" }
  /** The route is missing — should no longer happen now the path is right. Kept as a distinct state. */
  | { kind: "not-implemented" }
  | { kind: "error" };

/* ── parsing ─────────────────────────────────────────────────────────────────────────── */

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function obj(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A `{type,label,value}` list, wherever it turns up. */
function fieldsOf(source: Record<string, unknown> | null): PublicField[] | null {
  if (source === null) return null;
  const raw = source.fields;
  if (!Array.isArray(raw)) return null;

  const fields: PublicField[] = [];
  for (const entry of raw) {
    const record = obj(entry);
    if (record === null) continue;
    const value = str(record.value);
    if (value === null) continue; // §11 E-07: a blank field is not a row.
    fields.push({
      type: str(record.type) ?? "TEXT",
      label: str(record.label) ?? "",
      value,
    });
  }
  return fields;
}

/**
 * A **person's** name, from whichever spelling is present.
 *
 * ## ⚠ Why `name` is gated behind a flag instead of being read or refused outright
 * `name` is ambiguous in this API and means opposite things one level apart:
 *
 *   · on a **card** object it is the card's label — `CardResponseDto.name`, e.g. `"Work"`
 *   · on an **owner** object it is the person — `PublicOwnerDto.name`, e.g. `"Vansh Mehta"`
 *
 * Both mistakes have now been made here, in both directions, and each shipped:
 *
 *   1. Reading `name` everywhere rendered `"Work"` where the person should be — the card's
 *      label printed as somebody's name.
 *   2. Refusing `name` everywhere — the fix for (1) — dropped the owner entirely on live
 *      staging payloads, which send exactly `{ owner: { name, photoUrl }, … }` and no
 *      `fullName` at all. Every shared card rendered nameless.
 *
 * So the decision belongs to the **caller**, which is the only party that knows whether it is
 * holding an identity object or a card. `allowName` is passed `true` for the dedicated identity
 * objects (`owner`, `identity`, `user`, `card.owner`) and `false` everywhere else — including
 * the bare root, where a flat card payload's `name` is the card's.
 */
function nameOf(
  source: Record<string, unknown> | null,
  { allowName = false }: { allowName?: boolean } = {},
): string | null {
  if (source === null) return null;
  const full = str(source.fullName);
  if (full !== null) return full;
  const first = str(source.firstName) ?? "";
  const last = str(source.lastName) ?? "";
  const joined = `${first} ${last}`.trim();
  if (joined.length > 0) return joined;
  return allowName ? str(source.name) : null;
}

function avatarOf(source: Record<string, unknown> | null): string | null {
  if (source === null) return null;
  return str(source.avatarUrl) ?? str(source.profilePhoto) ?? str(source.photoUrl);
}

/**
 * Find the card in whatever wrapper it arrived in.
 *
 * Tries, in order: the body itself; `body.card`; `body.snapshot` (the shape an older iteration of
 * this API used); `body.data`. The owner's identity is looked for in the same places plus
 * `body.owner` / `body.identity` / `body.user`.
 *
 * Returns `null` only when no layout yields a name *or* a field — i.e. when there is genuinely
 * nothing to render, which is worth reporting as an error rather than drawing a blank card.
 */
export function parsePublicCard(body: unknown): PublicCardPayload | null {
  const root = obj(body);
  if (root === null) return null;

  const candidates: Array<[string, Record<string, unknown> | null]> = [
    ["root", root],
    ["card", obj(root.card)],
    ["snapshot", obj(root.snapshot)],
    ["data", obj(root.data)],
  ];

  /** Objects that exist to describe a person — here, and only here, `name` means the person. */
  const identities: Array<Record<string, unknown> | null> = [
    obj(root.owner),
    obj(root.identity),
    obj(root.user),
    obj(root.card) === null ? null : obj(obj(root.card)?.owner),
  ];

  const name = candidates.map(([, s]) => nameOf(s)).find((n) => n != null)
    ?? identities.map((s) => nameOf(s, { allowName: true })).find((n) => n != null)
    /* The root last, and without `allowName`: on a flat `{ name, kind, fields }` payload that
       `name` is the card's label, which is the mistake this whole function is shaped around. */
    ?? nameOf(root)
    ?? null;
  const avatar = candidates.map(([, s]) => avatarOf(s)).find((a) => a != null)
    ?? identities.map(avatarOf).find((a) => a != null)
    ?? null;

  // Bound to a local so the closure below is provably non-null to the compiler. Named to avoid
  // colliding with this function's own `body` parameter.
  const rootBody = root;

  function build(shape: string, source: Record<string, unknown>, fields: PublicField[]) {
    /**
     * ⚠ The layout that matched for the *rows* is not always the object that owns the card's
     * own attributes, and conflating the two was a real bug on every live link.
     *
     * Staging sends `{ owner, card: { name, kind, …design }, fields: [...] }`. `fields` is a
     * **root** key, so pass 1 matches shape `root` — and every card attribute sits one level
     * down under `card`, untouched. Reading them off `source` alone therefore produced
     * `cardName: null` and `kind: null` on every real payload:
     *
     *   · the card rendered with an empty name
     *   · `kind: null` → `cardTypeOf` defaults to `PERSONAL` → marigold + amber, so **every**
     *     shared card came out golden, including WORK cards that should derive blue
     *
     * So card attributes are looked up across the layouts in order — the matched one, then the
     * dedicated `card` object, then the root — and the first that answers wins. `source` stays
     * first because a payload that really is flat must keep working.
     */
    const cardSources = [source, obj(rootBody.card), rootBody];

    const attr = (...keys: readonly string[]): string | null => {
      for (const candidate of cardSources) {
        if (candidate === null) continue;
        for (const key of keys) {
          const value = str(candidate[key]);
          if (value !== null) return value;
        }
      }
      return null;
    };

    /* Same order, same reason — a design under `card` must not be dropped because the rows
       matched at the root. First layout carrying any axis wins; a card that genuinely chose
       nothing falls through to NO_APPEARANCE.

       Rejections are collected per layout and only the winning layout's are kept: a payload
       shaped `{ card: {…} }` would otherwise report the root's absent keys as rejects too. */
    const attempts = cardSources.map((candidate) => {
      const rejected: string[] = [];
      return { appearance: readAppearance(candidate, rejected), rejected };
    });
    const won =
      attempts.find((attempt) => hasAppearance(attempt.appearance)) ??
      attempts.find((attempt) => attempt.rejected.length > 0);

    return {
      cardName: attr("cardName", "name"),
      kind: attr("kind", "type"),
      fullName: name ?? "",
      avatarUrl: avatar,
      /* `logo` as a second spelling for the same tolerance reason the rest of this function
         exists: the resolve endpoint is `@ApiExcludeController`, so its payload is not in the
         spec and cannot be asserted against one. `logoUrl` is what staging sends today. */
      logoUrl: attr("logoUrl", "logo"),
      fields,
      appearance: won?.appearance ?? NO_APPEARANCE,
      appearanceRejected: won?.rejected ?? [],
      shape,
    };
  }

  /* ⚠ Two passes, and the order is the whole correctness of this function.
     A single pass that accepted a layout as soon as it yielded *either* fields or a name matched
     `root` first — because the name was found in a sibling `owner` object — and returned
     `fields: []` while the real fields sat untouched under `card`. That is silent data loss: a
     card rendering with a name and none of its rows, with nothing to indicate anything was lost.
     So fields decide the layout, and a name only decides it when no layout has any. */

  // Pass 1: whichever layout actually carries the rows.
  for (const [shape, source] of candidates) {
    if (source === null) continue;
    const fields = fieldsOf(source);
    if (fields !== null && fields.length > 0) return build(shape, source, fields);
  }

  // Pass 2: no rows anywhere. A card whose owner has mapped nothing is still a real card, so a
  // name alone is enough — the renderer shows the §11 E-02 caption rather than a blank.
  if (name !== null) {
    for (const [shape, source] of candidates) {
      if (source === null) continue;
      if (nameOf(source) !== null || fieldsOf(source) !== null) {
        return build(shape, source, fieldsOf(source) ?? []);
      }
    }
    return build("root", rootBody, []);
  }

  return null;
}

/* ── the call ────────────────────────────────────────────────────────────────────────── */

export async function fetchPublicCard(token: string): Promise<PublicCardResult> {
  const url = `${apiBaseUrl()}${API_PREFIX}/public/links/${encodeURIComponent(token)}`;
  const started = performance.now();
  const logPath = "/public/links/{token}";

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    logApiCall({
      method: "GET",
      path: logPath,
      status: 0,
      durationMs: performance.now() - started,
      code: "NETWORK",
    });
    return { kind: "error" };
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  const report = (code?: string) =>
    logApiCall({
      method: "GET",
      path: logPath,
      status: response.status,
      durationMs: performance.now() - started,
      requestId: response.headers.get("x-request-id"),
      code,
    });

  if (response.status === 410) {
    report("REVOKED");
    return { kind: "revoked" };
  }

  if (response.status === 404) {
    // `Cannot GET` is NestJS's unmatched-route reply; anything else is a real domain 404.
    const message = obj(parsed)?.message;
    const missingRoute = typeof message === "string" && message.startsWith("Cannot GET");
    report(missingRoute ? "ROUTE_MISSING" : "SHARE_LINK_NOT_FOUND");
    return { kind: missingRoute ? "not-implemented" : "not-found" };
  }

  if (!response.ok) {
    report(str(obj(parsed)?.code) ?? "UNKNOWN");
    return { kind: "error" };
  }

  const card = parsePublicCard(parsed);
  if (card === null) {
    // A 200 nothing could be read from. Reported loudly rather than drawn as a blank card, and the
    // top-level keys are logged so the real shape is one page-load away from being known.
    report(`UNREADABLE_SHAPE keys=${Object.keys(obj(parsed) ?? {}).join("|")}`);
    return { kind: "error" };
  }

  /* `appearance=` is the one-glance answer to "did the design columns deploy yet", and
     `rejected=` to "did the two vocabularies drift". Both belong on the success line rather
     than behind a warning: they are facts about a 200, not failures. */
  const rejected =
    card.appearanceRejected.length > 0 ? ` rejected=${card.appearanceRejected.join(",")}` : "";
  report(
    `ok shape=${card.shape} fields=${card.fields.length} ` +
      `appearance=${hasAppearance(card.appearance) ? "yes" : "none"}${rejected}`,
  );
  return { kind: "ok", card };
}
