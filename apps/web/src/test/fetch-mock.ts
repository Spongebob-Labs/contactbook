import { vi } from "vitest";

export type CapturedFetch = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

function normalizeHeaders(init?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!init) {
    return out;
  }
  if (init instanceof Headers) {
    init.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
    return out;
  }
  if (Array.isArray(init)) {
    for (const [key, value] of init) {
      out[key.toLowerCase()] = value;
    }
    return out;
  }
  for (const [key, value] of Object.entries(init)) {
    out[key.toLowerCase()] = String(value);
  }
  return out;
}

export function parseBody(raw: BodyInit | null | undefined): unknown {
  if (raw == null || raw === "") {
    return undefined;
  }
  if (typeof FormData !== "undefined" && raw instanceof FormData) {
    return raw;
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

export function mockFetchSequence(
  responses: Array<{
    status?: number;
    body?: unknown;
    headers?: Record<string, string>;
  }>,
): { calls: CapturedFetch[]; fetchMock: ReturnType<typeof vi.fn> } {
  const calls: CapturedFetch[] = [];
  let index = 0;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = normalizeHeaders(init?.headers);
    const body = parseBody(init?.body ?? null);
    calls.push({ url, method, headers, body });

    const next = responses[Math.min(index, responses.length - 1)] ?? {
      status: 200,
      body: {},
    };
    index += 1;

    return new Response(
      next.body === undefined ? "" : JSON.stringify(next.body),
      {
        status: next.status ?? 200,
        headers: {
          "Content-Type": "application/json",
          ...(next.headers ?? {}),
        },
      },
    );
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

export function pathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
