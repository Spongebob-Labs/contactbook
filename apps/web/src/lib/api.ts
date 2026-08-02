/**
 * Live ContactBook API only — browser Network must show this host, never
 * `localhost:5173/api/...`. Relative bases like `/api` are rejected.
 *
 * Auth: prefer `Authorization: Bearer` from verify/refresh responses, and still
 * send cookies (`credentials: "include"`) when the API sets them.
 */
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  hasClientSessionHint,
  setSessionTokens,
} from "@/lib/session-tokens";

const LIVE_API_BASE = "https://api.getcontactbook.com/api";

function resolveApiBase(raw: string | undefined): string {
  const value = (raw ?? LIVE_API_BASE).trim().replace(/\/$/, "");
  if (value.startsWith("https://") || value.startsWith("http://")) {
    return value;
  }
  return LIVE_API_BASE;
}

const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL as string | undefined);

export type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = Omit<RequestInit, "body" | "credentials"> & {
  body?: unknown;
  /** When false, skip session refresh on 401. Default: auto (true for app APIs, false for auth). */
  retry?: boolean;
};

const getCache = new Map<string, Promise<unknown>>();

/** Auth routes where 401 means bad credentials/OTP — never treat as expired session. */
function isAuthCredentialPath(path: string): boolean {
  const normalized = path.split("?")[0] ?? path;
  return (
    normalized.startsWith("/v1/auth/otp/") ||
    normalized === "/v1/auth/register" ||
    normalized === "/v1/auth/refresh" ||
    normalized === "/v1/auth/logout"
  );
}

function formatError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as ApiErrorPayload).message;
    if (typeof message === "string") {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join("; ");
    }
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function hasRefreshSessionHint(): boolean {
  return Boolean(
    getCookie("cb_refresh_token") ||
      getCookie("cb_user_id") ||
      hasClientSessionHint(),
  );
}

function authHeaders(): HeadersInit {
  const accessToken = getAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function refreshSession(): Promise<boolean> {
  if (!hasRefreshSessionHint()) {
    return false;
  }
  try {
    const refreshToken = getRefreshToken();
    const response = await fetch(`${API_BASE}/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
    if (!response.ok) {
      return false;
    }
    const payload = (await readJson(response)) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (payload && typeof payload === "object") {
      setSessionTokens({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      });
    }
    return true;
  } catch {
    return false;
  }
}

function requestMethod(options: ApiOptions): string {
  return (options.method ?? "GET").toUpperCase();
}

function getCacheKey(path: string, options: ApiOptions): string {
  return JSON.stringify({
    path,
    headers: options.headers ?? {},
  });
}

function clearGetCache() {
  getCache.clear();
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function shouldAttemptSessionRefresh(path: string, options: ApiOptions): boolean {
  if (options.retry === false) {
    return false;
  }
  if (isAuthCredentialPath(path)) {
    return false;
  }
  return hasRefreshSessionHint();
}

async function requestJson<T>(
  path: string,
  options: ApiOptions,
): Promise<T> {
  const body = options.body;
  const isFormData = isFormDataBody(body);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...authHeaders(),
      ...options.headers,
    },
    body:
      body === undefined
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body),
  });

  if (response.status === 401 && shouldAttemptSessionRefresh(path, options)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return requestJson<T>(path, { ...options, retry: false });
    }
    clearSessionTokens();
  }

  const payload = await readJson(response);
  if (!response.ok) {
    throw new ApiError(
      formatError(payload, "Something went wrong. Please try again."),
      response.status,
      payload,
    );
  }
  return payload as T;
}

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const method = requestMethod(options);
  if (method === "GET") {
    const cacheKey = getCacheKey(path, options);
    const cached = getCache.get(cacheKey);
    if (cached) {
      return cached as Promise<T>;
    }

    const request = requestJson<T>(path, options).catch((error) => {
      getCache.delete(cacheKey);
      throw error;
    });
    getCache.set(cacheKey, request);
    return request;
  }

  const payload = await requestJson<T>(path, options);
  if (method !== "HEAD" && method !== "OPTIONS") {
    clearGetCache();
  }
  return payload as T;
}

export function getCookie(name: string): string | null {
  const encoded = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encoded));
  if (!match) {
    return null;
  }
  return decodeURIComponent(match.slice(encoded.length));
}

export { API_BASE };
