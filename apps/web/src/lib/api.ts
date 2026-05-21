const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8001/api";

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
  retry?: boolean;
};

const getCache = new Map<string, Promise<unknown>>();

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

async function refreshSession(): Promise<boolean> {
  const response = await fetch(`${API_BASE}/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return response.ok;
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

async function requestJson<T>(
  path: string,
  options: ApiOptions,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });

  if (response.status === 401 && options.retry !== false) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return requestJson<T>(path, { ...options, retry: false });
    }
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
