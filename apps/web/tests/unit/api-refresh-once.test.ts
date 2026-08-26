/**
 * The refresh stampede — the bug that signed a user out on every single page load.
 *
 * ## What went wrong
 * `POST /auth/refresh` is single-use, and the API is explicit about the consequence of misusing it:
 * *"Reusing an already-rotated token revokes the whole token family (REFRESH_REUSE_DETECTED), not
 * just the presented token."*
 *
 * A page load fires **four concurrent** reads (`/profile/me`, `/auth/me`, `/profile/fields`,
 * `/profile/groups`). When the access token was stale, all four met a 401 and all four tried to
 * refresh with the same token: the first rotated it, the other three presented a consumed token,
 * the API read that as theft and revoked the family. Signed out, every time — which is exactly the
 * "I have to enter my number again" symptom.
 *
 * The fix has two halves and this file guards the client one: **however many 401s arrive at once,
 * exactly one refresh goes out.** (The other half is in `proxy.ts`, which no longer rotates on API
 * requests at all — only on document navigations, which arrive one at a time.)
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { profile } from "@/lib/api/browser";

interface Recorded {
  url: string;
  method: string;
}

/**
 * A fake API that 401s until a refresh happens, then succeeds.
 *
 * Records every request so the test can count refreshes rather than infer them.
 */
function stubApi(): Recorded[] {
  const calls: Recorded[] = [];
  let refreshed = false;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ url, method });

      if (url.includes("/auth/refresh")) {
        refreshed = true;
        return new Response(JSON.stringify({ accessToken: "fresh" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (!refreshed) {
        return new Response(
          JSON.stringify({
            statusCode: 401,
            code: "UNAUTHENTICATED",
            message: "Sign in required.",
            requestId: "r",
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );

  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refresh on 401", () => {
  it("⚠ sends ONE refresh for four concurrent 401s — the stampede that revoked the session", () => {
    const calls = stubApi();

    return Promise.all([
      profile.me(),
      profile.listFields(),
      profile.listGroups(),
      profile.listFields({ includeArchived: true }),
    ]).then((results) => {
      const refreshes = calls.filter((c) => c.url.includes("/auth/refresh"));
      // The whole point. More than one here means the family gets revoked in production.
      expect(refreshes).toHaveLength(1);
      expect(refreshes[0]?.method).toBe("POST");
      // And every caller still got its data, from the retry.
      expect(results).toHaveLength(4);
    });
  });

  it("retries the original request after refreshing, rather than failing it", async () => {
    const calls = stubApi();
    await expect(profile.listFields()).resolves.toEqual([]);

    const fields = calls.filter((c) => c.url.includes("/profile/fields"));
    // Once for the 401, once after the refresh.
    expect(fields).toHaveLength(2);
  });

  it("does not refresh for a non-401 failure — refreshing burns a single-use token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ statusCode: 404, code: "CARD_NOT_FOUND", message: "no", requestId: "r" }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(profile.listFields()).rejects.toThrow();
    const refreshes = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/auth/refresh"));
    expect(refreshes).toEqual([]);
  });

  it("never refreshes in response to an auth call, which would loop", async () => {
    const { auth } = await import("@/lib/api/browser");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ statusCode: 401, code: "UNAUTHENTICATED", message: "no", requestId: "r" }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(auth.me()).rejects.toThrow();
    const urls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (c) => String(c[0]),
    );
    // Exactly the one call. A refresh here would 401 too, and refresh-on-refresh is a loop.
    expect(urls.filter((u) => u.includes("/auth/refresh"))).toEqual([]);
    expect(urls).toHaveLength(1);
  });

  it("gives up rather than looping when the refresh itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ statusCode: 403, code: "REFRESH_INVALID", message: "no", requestId: "r" }),
            { status: 403, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ statusCode: 401, code: "UNAUTHENTICATED", message: "no", requestId: "r" }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }),
    );

    // The original 401 surfaces, so the screen shows "sign in again" rather than hanging.
    await expect(profile.listFields()).rejects.toThrow(/UNAUTHENTICATED/);
  });
});
