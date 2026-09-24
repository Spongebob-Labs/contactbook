"use client";

/**
 * The API, called **from the browser** — so every request and response is visible in the
 * Network tab.
 *
 * ## Why this exists alongside `endpoints/*`
 * `endpoints/*` runs on the server and is used by Server Components for the initial render.
 * This is the same 41 operations reached from the client, through the same-origin proxy at
 * `/api/cb/*`. The proxy passes the API's status and body through **verbatim**, so what you see
 * here is what Swagger shows — same JSON, same status codes, same `x-request-id`.
 *
 * The two are not duplicated logic: both are thin wrappers over one path string and one body.
 * The parsing, the error taxonomy and the domain mapping are shared.
 *
 * ## The credential is never here
 * There is no token in this file and none in the browser. `/api/cb/*` reads the httpOnly session
 * cookie server-side and attaches `Authorization: Bearer` itself. That is why calls go through a
 * proxy rather than straight to the API: the API's cookies are scoped to its own domain, so a
 * browser on our origin cannot send them back — they would need `SameSite=None; Secure`, and
 * Safari discards them regardless.
 */

import { ApiError, narrowCode, parseErrorEnvelope } from "@/lib/api/errors";
import { browserApiBase, isDirectMode, publicApiBaseUrl } from "@/lib/api/mode";
import { clearAccessToken, readAccessToken, writeAccessToken } from "@/lib/api/token-store";
import type {
  AudienceResponseDto,
  AuthMeResponseDto,
  CardResponseDto,
  NotifyCardDto,
  NotifyResultDto,
  CompleteOnboardingDto,
  ContactResponseDto,
  CreateCardDto,
  CreateProfileFieldDto,
  CreateProfileFieldGroupDto,
  DashboardResponseDto,
  ImportContactsDto,
  ImportContactsResponseDto,
  MeResponseDto,
  PhotoResponseDto,
  ProfileFieldGroupResponseDto,
  ProfileFieldResponseDto,
  RefreshResponseDto,
  ReorderProfileFieldsDto,
  RequestOtpDto,
  RequestOtpResponseDto,
  SetCardFieldsDto,
  ShareCardDto,
  ShareLinkResponseDto,
  UpdateCardDto,
  UpdateContactDto,
  UpdateProfileFieldDto,
  UpdateProfileFieldGroupDto,
  UpdateShareLinkDto,
  UpsertContactDto,
  VerifyOtpDto,
  VerifyOtpResponseDto,
  WhatsAppTemplateResponseDto,
} from "@/lib/api/schema";

/**
 * ## Two modes, one client
 *
 * - **direct** (`NEXT_PUBLIC_API_DIRECT=1`) — the browser calls
 *   `https://apistaging.getcontactbook.com/api/v1/…` itself. The Network tab shows the deployed
 *   URL. Authenticates with `Authorization: Bearer`, because cookies cannot cross origins.
 * - **proxy** (default) — the browser calls `/api/cb/…`, which forwards verbatim. Authenticates
 *   with an httpOnly cookie the browser never reads.
 *
 * ⚠ Direct mode requires the API to send `Access-Control-Allow-Origin` for the web origin, and
 * **staging currently sends none for any origin** — so it is off by default and every direct call
 * would be blocked by the browser. See `mode.ts` for the measurement and the one env var that
 * fixes it. Both modes send identical requests to identical paths; only the prefix differs.
 */

interface Call {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Path relative to `/api/v1` — `"/cards"`, not `"/api/v1/cards"`. */
  path: string;
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined>;
}

/**
 * One request, one exception type.
 *
 * @throws {ApiError} on any non-2xx, carrying the API's own `code` and `requestId` — the same
 * envelope the server-side client raises, so screens handle exactly one error shape whichever
 * side the call came from.
 */
async function cb<T>(call: Call): Promise<T> {
  try {
    return await send<T>(call);
  } catch (thrown) {
    /* ⚠ One retry, and only for a genuine 401 — never for a network failure or any other status.
       Refreshing is not free (it consumes a single-use token), so it happens when the API has
       actually said the credential is stale and at no other time.

       `/auth/*` is excluded: refreshing in response to a failed sign-in or a failed refresh would
       be a loop, and a 401 there means something different anyway. */
    const unauthorised =
      thrown instanceof ApiError && thrown.status === 401 && !call.path.startsWith("/auth/");
    if (!unauthorised) throw thrown;

    const refreshed = await refreshOnce();
    if (!refreshed) throw thrown;

    // Second attempt, with whatever the refresh produced. A 401 here is final.
    return send<T>(call);
  }
}

async function send<T>({ method, path, body, form, query }: Call): Promise<T> {
  const isContactsApi = path.startsWith("/contacts");
  const direct = isDirectMode() || isContactsApi;
  const apiBase = direct ? `${publicApiBaseUrl()}/api/v1` : browserApiBase();
  const url = new URL(`${apiBase}${path}`, window.location.origin);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  // Not set for FormData: the browser has to write its own multipart boundary.
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (direct) {
    // Direct API mode carries the credential directly as Authorization: Bearer <token>.
    const token = readAccessToken();
    if (token !== null) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      // Direct API calls send bearer header rather than relying on same-origin session cookies.
      credentials: direct ? "omit" : "same-origin",
      cache: "no-store",
    });
  } catch (cause) {
    throw new ApiError({
      status: 0,
      code: "NETWORK",
      rawMessage: cause instanceof Error ? cause.message : "fetch failed",
    });
  }

  const requestId = response.headers.get("x-request-id");

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    if (response.ok) return null as T;
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new ApiError({
        status: response.status,
        code: response.ok ? "MALFORMED" : "UNKNOWN",
        rawMessage: `Non-JSON response (${response.status})`,
        requestId,
      });
    }
  }

  if (response.ok) return parsed as T;

  const envelope = parseErrorEnvelope(parsed);
  throw new ApiError({
    status: response.status,
    code: envelope === null ? "UNKNOWN" : narrowCode(envelope.code),
    rawMessage: envelope?.message ?? `Request failed with ${response.status}`,
    requestId: envelope?.requestId ?? requestId,
    details: envelope?.details,
  });
}

/* ── refreshing, exactly once ────────────────────────────────────────────────────────── */

/**
 * The in-flight refresh, shared by every caller that needs one.
 *
 * ## Why a module-level promise and not just a call
 * `POST /auth/refresh` is **single-use with family revocation**: *"Reusing an already-rotated token
 * revokes the whole token family."* A page load fires four concurrent reads, so four concurrent
 * 401s would mean four refresh attempts with the same token — the first rotates it, the rest are
 * treated as theft, and the API kills the session. That was the "signed out on every load" bug.
 *
 * Every caller therefore awaits the *same* promise. One request goes out however many 401s arrive
 * at once. It is cleared when settled, so a later expiry can refresh again.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${browserApiBase()}/auth/refresh`, {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: isDirectMode() ? "omit" : "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return false;

      if (isDirectMode()) {
        const body = (await response.json()) as { accessToken?: unknown };
        if (typeof body.accessToken !== "string") return false;
        writeAccessToken(body.accessToken);
      }
      // In proxy mode the proxy route has already re-homed the new cookie.
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

const id = (value: string) => encodeURIComponent(value);

/* ── auth (5) ────────────────────────────────────────────────────────────────────────── */

export const auth = {
  otpRequest: (b: RequestOtpDto) =>
    cb<RequestOtpResponseDto>({ method: "POST", path: "/auth/otp/request", body: b }),
  /**
   * The one call that creates a session.
   *
   * In **proxy** mode the proxy lifts the tokens out of this response and re-homes them as
   * httpOnly cookies — nothing to do here. In **direct** mode there is no proxy, so the
   * `accessToken` from the body is stored client-side and sent as a bearer from then on. Either
   * way the response returned to the caller is the API's, unchanged.
   */
  otpVerify: async (b: VerifyOtpDto) => {
    const result = await cb<VerifyOtpResponseDto>({
      method: "POST",
      path: "/auth/otp/verify",
      body: b,
    });
    if (isDirectMode() && typeof result?.accessToken === "string") {
      writeAccessToken(result.accessToken);
    }
    return result;
  },
  /**
   * ⚠ Direct mode cannot refresh. The API reads the refresh token from a cookie scoped to its own
   * domain, which a cross-origin request cannot carry, and there is no body parameter for it. So a
   * direct-mode session ends when the access token expires and the user signs in again. Proxy mode
   * rotates transparently in `proxy.ts`.
   */
  refresh: async () => {
    const result = await cb<RefreshResponseDto>({ method: "POST", path: "/auth/refresh" });
    if (isDirectMode() && typeof result?.accessToken === "string") {
      writeAccessToken(result.accessToken);
    }
    return result;
  },
  logout: async () => {
    const result = await cb<{ ok: boolean }>({ method: "POST", path: "/auth/logout" });
    // Proxy mode clears its own cookies; direct mode has to drop the token it is holding.
    if (isDirectMode()) clearAccessToken();
    return result;
  },
  me: () => cb<AuthMeResponseDto>({ method: "POST", path: "/auth/me" }),
};

/* ── profile (14) ────────────────────────────────────────────────────────────────────── */

export const profile = {
  me: () => cb<MeResponseDto>({ method: "GET", path: "/profile/me" }),
  onboarding: (b: CompleteOnboardingDto) =>
    cb<MeResponseDto>({ method: "POST", path: "/profile/onboarding", body: b }),
  listFields: (q?: { category?: string; includeArchived?: boolean }) =>
    cb<ProfileFieldResponseDto[]>({ method: "GET", path: "/profile/fields", query: q }),
  createField: (b: CreateProfileFieldDto) =>
    cb<ProfileFieldResponseDto>({ method: "POST", path: "/profile/fields", body: b }),
  getField: (fieldId: string) =>
    cb<ProfileFieldResponseDto>({ method: "GET", path: `/profile/fields/${id(fieldId)}` }),
  updateField: (fieldId: string, b: UpdateProfileFieldDto) =>
    cb<ProfileFieldResponseDto>({
      method: "PATCH",
      path: `/profile/fields/${id(fieldId)}`,
      body: b,
    }),
  deleteField: (fieldId: string) =>
    cb<void>({ method: "DELETE", path: `/profile/fields/${id(fieldId)}` }),
  reorderFields: (b: ReorderProfileFieldsDto) =>
    cb<void>({ method: "PUT", path: "/profile/fields/order", body: b }),
  listGroups: (q?: { category?: string; includeArchived?: boolean }) =>
    cb<ProfileFieldGroupResponseDto[]>({ method: "GET", path: "/profile/groups", query: q }),
  createGroup: (b: CreateProfileFieldGroupDto) =>
    cb<ProfileFieldGroupResponseDto>({ method: "POST", path: "/profile/groups", body: b }),
  updateGroup: (groupId: string, b: UpdateProfileFieldGroupDto) =>
    cb<ProfileFieldGroupResponseDto>({
      method: "PATCH",
      path: `/profile/groups/${id(groupId)}`,
      body: b,
    }),
  deleteGroup: (groupId: string) =>
    cb<void>({ method: "DELETE", path: `/profile/groups/${id(groupId)}` }),
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return cb<PhotoResponseDto>({ method: "POST", path: "/profile/photo", form });
  },
  deletePhoto: () => cb<void>({ method: "DELETE", path: "/profile/photo" }),
};

/* ── contacts (5) ────────────────────────────────────────────────────────────────────── */

export const contacts = {
  list: () => cb<ContactResponseDto[]>({ method: "GET", path: "/contacts" }),
  upsert: (b: UpsertContactDto) =>
    cb<ContactResponseDto>({ method: "POST", path: "/contacts", body: b }),
  get: (contactId: string) =>
    cb<ContactResponseDto>({ method: "GET", path: `/contacts/${id(contactId)}` }),
  update: (contactId: string, b: UpdateContactDto) =>
    cb<ContactResponseDto>({ method: "PATCH", path: `/contacts/${id(contactId)}`, body: b }),
  import: (b: ImportContactsDto) =>
    cb<ImportContactsResponseDto>({ method: "POST", path: "/contacts/import", body: b }),
};

/* ── cards (11) ──────────────────────────────────────────────────────────────────────── */

/**
 * The create body as form fields — the browser-side twin of `endpoints/cards.ts`'s
 * `toCreateCardForm`, and it must stay a twin.
 *
 * ⚠ `null` and `undefined` are both **omitted**. On a create that is not lossy: every column
 * starts null, so "the owner cleared this" and "the owner never set it" are the same state, and
 * `String(null)` would write the four characters `null` into the column instead.
 */
function createCardForm(body: CreateCardDto, logo?: File): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    form.set(key, String(value));
  }
  if (logo !== undefined) form.set("file", logo);
  return form;
}

export const cards = {
  list: (q?: { includeArchived?: boolean }) =>
    cb<CardResponseDto[]>({ method: "GET", path: "/cards", query: q }),
  /**
   * ⚠ `multipart/form-data`, always — with a logo or without one. See `endpoints/cards.ts`'s
   * `createCard` for why the encoding does not vary, and why a logo that fails takes the whole
   * create with it rather than leaving a bare card behind.
   */
  create: (b: CreateCardDto, logo?: File) =>
    cb<CardResponseDto>({ method: "POST", path: "/cards", form: createCardForm(b, logo) }),
  get: (cardId: string) => cb<CardResponseDto>({ method: "GET", path: `/cards/${id(cardId)}` }),
  update: (cardId: string, b: UpdateCardDto) =>
    cb<CardResponseDto>({ method: "PATCH", path: `/cards/${id(cardId)}`, body: b }),
  archive: (cardId: string) => cb<void>({ method: "DELETE", path: `/cards/${id(cardId)}` }),
  /** ⚠ REPLACES the whole curated set — send everything to keep, not just what changed. */
  setFields: (cardId: string, b: SetCardFieldsDto) =>
    cb<CardResponseDto>({ method: "PUT", path: `/cards/${id(cardId)}/fields`, body: b }),
  share: (cardId: string, b: ShareCardDto) =>
    cb<ShareLinkResponseDto>({ method: "POST", path: `/cards/${id(cardId)}/share`, body: b }),
  /** Read-only. Safe to re-fetch freely — it is how a send's outcome is discovered. */
  audience: (cardId: string) =>
    cb<AudienceResponseDto>({ method: "GET", path: `/cards/${id(cardId)}/audience` }),
  /** ⚠ Returns `ENQUEUED`, never "delivered". See `NotifyResultDto`. */
  notify: (cardId: string, b: NotifyCardDto) =>
    cb<NotifyResultDto[]>({ method: "POST", path: `/cards/${id(cardId)}/notify`, body: b }),
  /**
   * Upload or replace this card's logo. Returns the **whole updated card**, so a caller can
   * re-map it rather than patching a URL into the card object it is already holding.
   *
   * ⚠ Replacing needs no prior remove — the old object is deleted as part of this request. A
   * remove-then-upload would leave the card bare if the upload half failed.
   */
  uploadLogo: (cardId: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return cb<CardResponseDto>({ method: "POST", path: `/cards/${id(cardId)}/logo`, form });
  },
  /** 204, no body. `LOGO_NOT_FOUND` when there was nothing to remove — see `errors.ts`. */
  removeLogo: (cardId: string) =>
    cb<void>({ method: "DELETE", path: `/cards/${id(cardId)}/logo` }),

  /**
   * Upload or replace this card's cover photograph. Returns the whole updated card, same as the
   * logo pair.
   *
   * ⚠ **JPEG/PNG/WebP, 5 MB — a quarter of the logo's cap**, because a cover is a photograph.
   *
   * ⚠ **The API stores the exact bytes it is sent — no server-side crop, resize or recompress.**
   * The composition is baked in before the call (1:0.7, ≤1280px long edge) by the builder's crop
   * dialog. A raw file straight off a picker renders a full-length photograph as a head crop.
   */
  uploadCover: (cardId: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return cb<CardResponseDto>({ method: "POST", path: `/cards/${id(cardId)}/cover`, form });
  },
  /** 204, no body. `COVER_NOT_FOUND` when there was nothing to remove. */
  removeCover: (cardId: string) =>
    cb<void>({ method: "DELETE", path: `/cards/${id(cardId)}/cover` }),
};

/* ── public connect (2) — anonymous, and deliberately not in `endpoints/` ───────────── */

/**
 * The QR-scan connect endpoints — the OTP pair, `POST /public/links/{token}/connect/otp/{request,
 * verify}`, and the zero-verification `POST /public/links/{token}/connect/send`.
 *
 * ## Why these live here and nowhere else
 * Three properties set them apart from the 41 operations above, and each one is a reason:
 *
 * 1. **They are anonymous.** The caller is a stranger who scanned a QR code, not a signed-in
 *    owner. No guard on the API side, no credential on ours.
 * 2. **They are `@ApiExcludeController()`**, exactly like `GET /public/links/{token}`. So they
 *    are absent from `GET /api/docs-json`, which means they cannot go in `src/lib/api/endpoints`:
 *    `tests/contract/api-contract.test.ts` asserts that directory implements *nothing the spec
 *    does not define*, and would fail on a path the snapshot has never heard of. Their request
 *    and response types are declared below rather than in `schema.ts` for the same reason —
 *    that file mirrors the snapshot, and there is nothing there to mirror. This is the same
 *    treatment `public-card.ts` already gives the resolve endpoint's payload.
 * 3. **They are browser-only.** Both are POSTs made from a hydrated control on `/c/{slug}`;
 *    there is no server-render path that needs them.
 *
 * ## They bypass the refresh retry, on purpose
 * `cb()` treats a 401 as "the access token went stale" and spends a single-use refresh token to
 * recover. Neither of these endpoints can produce a 401 — they have no guard — so a 401 here
 * would mean something has gone wrong upstream, and burning a refresh token in response would
 * revoke the token family of any owner who happens to be signed in while scanning their own
 * card. So they call `send()` directly. Same envelope, same `ApiError`, no rotation.
 */

/** `POST …/connect/otp/request` → 202. Not in the snapshot; see the note above. */
export interface ConnectOtpRequestResult {
  sent: true;
  /** Present only outside production, and only when Twilio is unconfigured. */
  devCode?: string;
}

/**
 * `POST …/connect/otp/verify` and `POST …/connect/send` → 200. Connecting a second time is a
 * no-op, not an error.
 */
export interface ConnectResult {
  connected: true;
}

export const publicConnect = {
  /**
   * Sends a WhatsApp OTP to the **scanner's** number.
   *
   * @throws {ApiError} `SHARE_LINK_NOT_FOUND` (404) / `SHARE_LINK_REVOKED` (410) if the token is
   * dead — checked before anything is sent; `OTP_COOLDOWN` (409, with `details.retryAfterSeconds`)
   * or `OTP_RATE_LIMITED` (409, no retry-after) under the login flow's own limits: 60s between
   * requests, 5 per hour per phone.
   */
  otpRequest: (token: string, phoneE164: string) =>
    send<ConnectOtpRequestResult>({
      method: "POST",
      path: `/public/links/${id(token)}/connect/otp/request`,
      body: { phoneE164 },
    }),
  /**
   * Proves the scanner owns the number and mints their `ShareLink` — no account, no session.
   *
   * @throws {ApiError} `OTP_NOT_FOUND` (404, expired or never requested), `OTP_INVALID` (409,
   * wrong digits, attempt counted), `OTP_ATTEMPTS_EXCEEDED` (409, this code is now dead) or
   * `CANNOT_CONNECT_TO_SELF` (409, the number is the card owner's own).
   */
  otpVerify: (token: string, phoneE164: string, code: string) =>
    send<ConnectResult>({
      method: "POST",
      path: `/public/links/${id(token)}/connect/otp/verify`,
      body: { phoneE164, code },
    }),
  /**
   * "Send to my phone" — one call, no OTP. Same outcome as a successful `otpVerify`: a contact on
   * the owner's side, a live `ShareLink`, and the card link sent to this number over WhatsApp.
   *
   * ⚠ **The number is trusted as typed.** Nothing proves it belongs to the caller, so a mistyped
   * number sends the owner's card to a stranger. The API logs it under its own source
   * (`SEND_TO_PHONE`) so it is never mistaken for a verified connect, and it has **no rate
   * limit** — there is no `OtpService.request()` step to carry one.
   *
   * @throws {ApiError} `SHARE_LINK_NOT_FOUND` (404) / `SHARE_LINK_REVOKED` (410) if the token is
   * dead — checked before anything is sent; `CANNOT_CONNECT_TO_SELF` (409, the number is the card
   * owner's own). No `OTP_*` code is reachable: this path never touches `OtpService`.
   */
  send: (token: string, phoneE164: string) =>
    send<ConnectResult>({
      method: "POST",
      path: `/public/links/${id(token)}/connect/send`,
      body: { phoneE164 },
    }),
};

/* ── share-links (2) ─────────────────────────────────────────────────────────────────── */

export const shareLinks = {
  list: () => cb<ShareLinkResponseDto[]>({ method: "GET", path: "/share-links" }),
  update: (linkId: string, b: UpdateShareLinkDto) =>
    cb<ShareLinkResponseDto>({ method: "PATCH", path: `/share-links/${id(linkId)}`, body: b }),
};

/* ── whatsapp-templates (3) ──────────────────────────────────────────────────────────── */

export const templates = {
  list: (q?: { purpose?: string }) =>
    cb<WhatsAppTemplateResponseDto[]>({ method: "GET", path: "/templates", query: q }),
  create: (b: unknown) =>
    cb<WhatsAppTemplateResponseDto>({ method: "POST", path: "/templates", body: b }),
  update: (templateId: string, b: unknown) =>
    cb<WhatsAppTemplateResponseDto>({
      method: "PATCH",
      path: `/templates/${id(templateId)}`,
      body: b,
    }),
};

/* ── dashboard (1) ───────────────────────────────────────────────────────────────────── */

/**
 * One call, server-computed. See `endpoints/dashboard.ts` for why this replaced the screen's
 * old four-endpoints-plus-one-per-card assembly, and `DashboardResponseDto` for what each
 * number means — in particular why `totals.behind === null` is not `0`.
 */
export const dashboard = {
  get: () => cb<DashboardResponseDto>({ method: "GET", path: "/dashboard" }),
};
