"use client";

/**
 * The API, called **from the browser** — so every request and response is visible in the
 * Network tab.
 *
 * ## Why this exists alongside `endpoints/*`
 * `endpoints/*` runs on the server and is used by Server Components for the initial render.
 * This is the same 36 operations reached from the client, through the same-origin proxy at
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
import { browserApiBase, isDirectMode } from "@/lib/api/mode";
import { clearAccessToken, readAccessToken, writeAccessToken } from "@/lib/api/token-store";
import type {
  AuthMeResponseDto,
  CardResponseDto,
  CompleteOnboardingDto,
  ContactResponseDto,
  CreateCardDto,
  CreateProfileFieldDto,
  CreateProfileFieldGroupDto,
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
  const url = new URL(`${browserApiBase()}${path}`, window.location.origin);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  // Not set for FormData: the browser has to write its own multipart boundary.
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const direct = isDirectMode();
  if (direct) {
    // Direct mode carries the credential itself. In proxy mode the header is attached
    // server-side and must never be set here — the browser has no token to set.
    const token = readAccessToken();
    if (token !== null) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      // Proxy mode rides our first-party session cookie. Direct mode sends no cookies at all —
      // they would be cross-site, and the bearer header is what authenticates instead.
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

/* ── cards (7) ───────────────────────────────────────────────────────────────────────── */

export const cards = {
  list: (q?: { includeArchived?: boolean }) =>
    cb<CardResponseDto[]>({ method: "GET", path: "/cards", query: q }),
  create: (b: CreateCardDto) => cb<CardResponseDto>({ method: "POST", path: "/cards", body: b }),
  get: (cardId: string) => cb<CardResponseDto>({ method: "GET", path: `/cards/${id(cardId)}` }),
  update: (cardId: string, b: UpdateCardDto) =>
    cb<CardResponseDto>({ method: "PATCH", path: `/cards/${id(cardId)}`, body: b }),
  archive: (cardId: string) => cb<void>({ method: "DELETE", path: `/cards/${id(cardId)}` }),
  /** ⚠ REPLACES the whole curated set — send everything to keep, not just what changed. */
  setFields: (cardId: string, b: SetCardFieldsDto) =>
    cb<CardResponseDto>({ method: "PUT", path: `/cards/${id(cardId)}/fields`, body: b }),
  share: (cardId: string, b: ShareCardDto) =>
    cb<ShareLinkResponseDto>({ method: "POST", path: `/cards/${id(cardId)}/share`, body: b }),
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
