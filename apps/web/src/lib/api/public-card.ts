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

/** One row on the card, as a stranger receives it. */
export interface PublicField {
  type: string;
  label: string;
  value: string;
}

export interface PublicCardPayload {
  /** The card's own name, e.g. "Work". Absent on a payload that only carries the person. */
  cardName: string | null;
  /** `WORK` / `PERSONAL` / `PAYMENT` / `CUSTOM`, when the payload says. Drives the card's look. */
  kind: string | null;
  fullName: string;
  avatarUrl: string | null;
  fields: PublicField[];
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
 * ⚠ `name` is deliberately not consulted. In this API's own DTOs `name` means the *card's* name
 * (`CardResponseDto.name`), so reading it as a person's produced "Work" as the owner's name on a
 * payload shaped `{ card: { name: "Work", … }, owner: { firstName, lastName } }` — the card's
 * label rendered where the person should be. `fullName` and `firstName`/`lastName` are
 * unambiguous; `name` is not.
 */
function nameOf(source: Record<string, unknown> | null): string | null {
  if (source === null) return null;
  const full = str(source.fullName);
  if (full !== null) return full;
  const first = str(source.firstName) ?? "";
  const last = str(source.lastName) ?? "";
  const joined = `${first} ${last}`.trim();
  return joined.length > 0 ? joined : null;
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

  const identities: Array<Record<string, unknown> | null> = [
    obj(root.owner),
    obj(root.identity),
    obj(root.user),
    obj(root.card) === null ? null : obj(obj(root.card)?.owner),
    root,
  ];

  const name = candidates.map(([, s]) => nameOf(s)).find((n) => n != null)
    ?? identities.map(nameOf).find((n) => n != null)
    ?? null;
  const avatar = candidates.map(([, s]) => avatarOf(s)).find((a) => a != null)
    ?? identities.map(avatarOf).find((a) => a != null)
    ?? null;

  // Bound to a local so the closure below is provably non-null to the compiler. Named to avoid
  // colliding with this function's own `body` parameter.
  const rootBody = root;

  function build(shape: string, source: Record<string, unknown>, fields: PublicField[]) {
    return {
      cardName: str(source.cardName) ?? str(source.name) ?? str(rootBody.cardName),
      kind: str(source.kind) ?? str(source.type) ?? str(rootBody.kind),
      fullName: name ?? "",
      avatarUrl: avatar,
      fields,
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

  report(`ok shape=${card.shape} fields=${card.fields.length}`);
  return { kind: "ok", card };
}
