/**
 * Where browser calls go, and what they carry — the bug that took the Contacts screen down.
 *
 * ## What went wrong
 * `ed628c3` special-cased every `/contacts*` path into direct mode while the app was in proxy
 * mode. So `GET /contacts` went straight to `https://apistaging.getcontactbook.com/api/v1/contacts`
 * instead of `/api/cb/contacts`, and it went with **no credential**:
 *
 * - the bearer is only ever written to `sessionStorage` by a *direct-mode* sign-in, so in proxy
 *   mode there was nothing there;
 * - the fallback read `cb_at` from `document.cookie`, but `cb_at` is httpOnly — the browser
 *   cannot read it, which is the whole point of it.
 *
 * The API answered `401 {"message":"Sign in required."}` (124 bytes — the no-token response; a bad
 * token gets "Invalid or expired session." instead), without `Access-Control-Allow-Origin`, so the
 * browser discarded it, `fetch` threw, and the screen said "You're offline". Swagger and curl
 * worked the whole time because they send the header and are not subject to CORS.
 *
 * Every route goes through one prefix. No path gets to pick its own transport.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { contacts } from "@/lib/api/browser";
import { readAccessToken, writeAccessToken, clearAccessToken } from "@/lib/api/token-store";

interface Recorded {
  url: URL;
  credentials: RequestCredentials | undefined;
  authorization: string | undefined;
}

function recordFetch(): Recorded[] {
  const calls: Recorded[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({
        url: new URL(String(input)),
        credentials: init?.credentials,
        authorization: headers.Authorization,
      });
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

/** One of each contacts operation — the screen and the share sheet between them use all five. */
async function everyContactsCall(): Promise<void> {
  await contacts.list();
  await contacts.get("ct_1");
  await contacts.upsert({ phoneE164: "+15555550100", displayName: "Test" });
  await contacts.update("ct_1", { displayName: "Test" });
  await contacts.import({ contacts: [] });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearAccessToken();
  document.cookie = "cb_at=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("proxy mode (the default)", () => {
  it("⚠ sends every /contacts call through the same-origin proxy, never to the API origin", async () => {
    const calls = recordFetch();
    await everyContactsCall();

    expect(calls).toHaveLength(5);
    for (const call of calls) {
      // Same origin as the page — a cross-origin call here is the bug, whatever else it carries.
      expect(call.url.origin).toBe(window.location.origin);
      expect(call.url.pathname.startsWith("/api/cb/contacts")).toBe(true);
    }
  });

  it("rides the httpOnly session cookie and sets no Authorization header of its own", async () => {
    const calls = recordFetch();
    await everyContactsCall();

    for (const call of calls) {
      expect(call.credentials).toBe("same-origin");
      // The proxy attaches the bearer server-side. The browser has no token to set.
      expect(call.authorization).toBeUndefined();
    }
  });

  it("does not turn a readable cookie into a bearer — the session is not document.cookie's", async () => {
    document.cookie = "cb_at=looks-like-a-token; path=/";
    const calls = recordFetch();
    await contacts.list();

    expect(calls[0]?.authorization).toBeUndefined();
    expect(readAccessToken()).toBeNull();
  });
});

describe("direct mode (NEXT_PUBLIC_API_DIRECT=1)", () => {
  it("calls the deployed API with the bearer from the direct-mode sign-in", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_DIRECT", "1");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://apistaging.getcontactbook.com");
    writeAccessToken("from-otp-verify");
    const calls = recordFetch();

    await contacts.list();

    expect(calls[0]?.url.href).toBe("https://apistaging.getcontactbook.com/api/v1/contacts");
    expect(calls[0]?.authorization).toBe("Bearer from-otp-verify");
    expect(calls[0]?.credentials).toBe("omit");
  });
});
