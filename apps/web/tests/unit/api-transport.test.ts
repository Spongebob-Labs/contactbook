/**
 * `transport()` — the only function that can turn an HTTP response into an exception.
 *
 * These tests are the reason the rest of the client has no error handling in it: if every
 * failure mode is converted to an `ApiError` with the right `code` here, then callers only
 * ever handle the happy path plus one exception type, and no raw API message can reach a
 * screen.
 *
 * `fetch` is stubbed rather than hitting staging — a unit test that needs the network is a
 * test that fails during a deploy and passes while offline.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, isApiError, isSessionExpired, toScreenError } from "@/lib/api/errors";
import { findCookie, transport } from "@/lib/api/transport";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/**
 * A `Response` body can only be read once, so a stub that hands back the *same* object on
 * every call fails the second time with "Body is unusable". `factory` is therefore invoked
 * per call, producing a fresh response — which is what a real fetch does.
 */
function stubFetch(factory: Response | (() => Response | Promise<Response>)) {
  // The parameters are declared so `spy.mock.calls` is typed as the fetch arguments — a
  // zero-arg mock types them as `[]`, and every `calls[0][1]` read becomes a type error.
  const spy = vi.fn(
    // The parameters are never read — they exist purely to give the mock fetch's signature.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (input: string | URL | Request, init?: RequestInit) =>
      typeof factory === "function" ? factory() : factory,
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** The `init` of the nth recorded call, as headers. Narrowed once so the tests stay readable. */
function callHeaders(spy: ReturnType<typeof stubFetch>, index: number): Headers {
  const init = spy.mock.calls[index]?.[1];
  return new Headers(init?.headers);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transport — success", () => {
  it("returns the parsed body on 200", async () => {
    stubFetch(jsonResponse({ id: "card_1", name: "Work" }));
    const result = await transport<{ id: string; name: string }>({
      method: "GET",
      path: "/cards/card_1",
    });
    expect(result).toEqual({ id: "card_1", name: "Work" });
  });

  it("returns null on 204, without trying to parse an empty body", async () => {
    // Five endpoints answer 204 (field delete, reorder, group delete, photo delete, card
    // archive). Calling .json() on any of them throws, which is exactly the bug this pins.
    stubFetch(new Response(null, { status: 204 }));
    await expect(
      transport({ method: "DELETE", path: "/profile/fields/f_1" }),
    ).resolves.toBeNull();
  });

  it("sends the bearer token when one is supplied, and omits it when not", async () => {
    const spy = stubFetch(() => jsonResponse({ ok: true }));

    await transport({ method: "GET", path: "/cards", accessToken: "tok_abc" });
    expect(callHeaders(spy, 0).get("authorization")).toBe("Bearer tok_abc");

    await transport({ method: "POST", path: "/auth/otp/request", body: { phoneE164: "+1" } });
    expect(callHeaders(spy, 1).get("authorization")).toBeNull();
  });

  it("passes the refresh token as a Cookie header, since a server call has no jar", async () => {
    const spy = stubFetch(jsonResponse({ accessToken: "new" }));
    await transport({ method: "POST", path: "/auth/refresh", refreshToken: "rt_xyz" });
    expect(callHeaders(spy, 0).get("cookie")).toBe("cb_refresh_token=rt_xyz");
  });

  it("builds the query string and drops undefined values", async () => {
    const spy = stubFetch(jsonResponse([]));
    await transport({
      method: "GET",
      path: "/profile/fields",
      query: { category: "WORK", includeArchived: true, missing: undefined },
    });
    const url = String(spy.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/api/v1/profile/fields?");
    expect(url).toContain("category=WORK");
    expect(url).toContain("includeArchived=true");
    // An `undefined` that becomes the literal string "undefined" is a real and very
    // annoying source of 400s.
    expect(url).not.toContain("missing");
  });
});

describe("transport — failure", () => {
  it("turns the error envelope into an ApiError carrying code and requestId", async () => {
    stubFetch(
      jsonResponse(
        {
          statusCode: 409,
          code: "OTP_ATTEMPTS_EXCEEDED",
          message: "Too many attempts for this code.",
          requestId: "req_123",
        },
        { status: 409 },
      ),
    );

    const error = await transport({ method: "POST", path: "/auth/otp/verify" }).catch((e) => e);
    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).code).toBe("OTP_ATTEMPTS_EXCEEDED");
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).requestId).toBe("req_123");
  });

  it("degrades an unrecognised code to UNKNOWN rather than throwing", async () => {
    // A spec bump that adds a code must not crash the UI on the way to being handled.
    stubFetch(
      jsonResponse(
        { statusCode: 418, code: "SOMETHING_NEW", message: "nope", requestId: "r" },
        { status: 418 },
      ),
    );
    const error = await transport({ method: "GET", path: "/cards" }).catch((e) => e);
    expect((error as ApiError).code).toBe("UNKNOWN");
    // The original is still available for a log line, just not for a headline.
    expect((error as ApiError).rawMessage).toBe("nope");
  });

  it("reports a network failure as NETWORK", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));
    const error = await transport({ method: "GET", path: "/cards" }).catch((e) => e);
    expect((error as ApiError).code).toBe("NETWORK");
  });

  it("reports an abort as TIMEOUT, distinctly from a network failure", async () => {
    stubFetch(() => Promise.reject(new DOMException("timed out", "TimeoutError")));
    const error = await transport({ method: "GET", path: "/cards" }).catch((e) => e);
    expect((error as ApiError).code).toBe("TIMEOUT");
  });

  it("reports an HTML gateway page as an error rather than crashing on JSON.parse", async () => {
    // What a 502 from the reverse proxy actually looks like.
    stubFetch(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const error = await transport({ method: "GET", path: "/cards" }).catch((e) => e);
    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).status).toBe(502);
  });

  it("reports a non-JSON 200 as MALFORMED, because that is a contract break", async () => {
    stubFetch(new Response("not json", { status: 200 }));
    const error = await transport({ method: "GET", path: "/cards" }).catch((e) => e);
    expect((error as ApiError).code).toBe("MALFORMED");
  });
});

describe("error copy", () => {
  it("never surfaces the API's own message to a person", () => {
    const error = new ApiError({
      status: 409,
      code: "OTP_INVALID",
      rawMessage: "OtpService: code mismatch for +919876543210",
      requestId: "req_9",
    });
    const shown = toScreenError(error);

    expect(shown.title).toBe("That code didn't match");
    // The developer sentence — which here contains a phone number — must not leak.
    expect(JSON.stringify(shown)).not.toContain("OtpService");
    expect(JSON.stringify(shown)).not.toContain("919876543210");
    // And no code in the copy (§6.10).
    expect(JSON.stringify(shown)).not.toContain("OTP_INVALID");
  });

  it("marks a wrong code retryable and an exhausted one not", () => {
    // Getting this backwards makes a retry button lie: after OTP_ATTEMPTS_EXCEEDED even the
    // correct code is rejected, so offering "try again" sends the user in a circle.
    expect(toScreenError(new ApiError({ status: 409, code: "OTP_INVALID", rawMessage: "" })).retryable).toBe(true);
    expect(
      toScreenError(new ApiError({ status: 409, code: "OTP_ATTEMPTS_EXCEEDED", rawMessage: "" }))
        .retryable,
    ).toBe(false);
  });

  it("falls back to the generic panel for a non-ApiError throw", () => {
    expect(toScreenError(new Error("bug in our own mapper")).title).toBe("Something went wrong");
    expect(toScreenError("a thrown string").kind).toBe("unknown");
  });

  it("identifies exactly the four codes that require signing in again", () => {
    const requiresSignIn = [
      "UNAUTHENTICATED",
      "REFRESH_MISSING",
      "REFRESH_INVALID",
      "REFRESH_REUSE_DETECTED",
    ] as const;
    for (const code of requiresSignIn) {
      expect(isSessionExpired(new ApiError({ status: 401, code, rawMessage: "" }))).toBe(true);
    }
    expect(isSessionExpired(new ApiError({ status: 404, code: "CARD_NOT_FOUND", rawMessage: "" }))).toBe(
      false,
    );
  });
});

describe("findCookie", () => {
  it("lifts the refresh token out of a Set-Cookie header", () => {
    // The one reason this helper exists: the API's refresh cookie is httpOnly and scoped to
    // the API's domain, so it has to be re-homed server-side or rotation is impossible.
    expect(
      findCookie(
        ["cb_refresh_token=rt_secret; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000"],
        "cb_refresh_token",
      ),
    ).toBe("rt_secret");
  });

  it("finds it alongside the access cookie, which is how verify actually responds", () => {
    expect(
      findCookie(
        [
          "cb_access_token=at_1; Path=/; HttpOnly",
          "cb_refresh_token=rt_2; Path=/; HttpOnly",
        ],
        "cb_refresh_token",
      ),
    ).toBe("rt_2");
  });

  it("is not fooled by a comma inside an Expires date", () => {
    // The classic Set-Cookie parsing bug: splitting on every comma cuts
    // `Expires=Wed, 01 Jan 2027` in half and loses the cookie after it.
    expect(
      findCookie(
        [
          "a=1; Expires=Wed, 01 Jan 2027 00:00:00 GMT, cb_refresh_token=rt_3; Path=/",
        ],
        "cb_refresh_token",
      ),
    ).toBe("rt_3");
  });

  it("returns null when the cookie is absent", () => {
    expect(findCookie(["other=1; Path=/"], "cb_refresh_token")).toBeNull();
    expect(findCookie([], "cb_refresh_token")).toBeNull();
  });
});
