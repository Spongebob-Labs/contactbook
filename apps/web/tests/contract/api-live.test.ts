// @vitest-environment node
/**
 * Live smoke check against the staging API.
 *
 * ⚠ Runs in the **node** environment (see the docblock above). happy-dom implements the
 * browser's Same-Origin Policy, so a cross-origin `fetch` there fails with a CORS error
 * before it ever leaves the process — which looks exactly like the API being down.
 *
 * ## Skipped by default, and why that is not a cop-out
 * A suite that needs the network fails while staging redeploys and passes while a laptop is
 * offline, so it cannot be a gate. But mocks only ever prove that the client agrees with
 * *itself* — they cannot catch a wrong path prefix, a changed error envelope, or a
 * misremembered HTTP verb. Both kinds of test are needed; only one of them can be automatic.
 *
 *     LIVE_API=1 npx vitest run tests/contract/api-live.test.ts
 *
 * ## Nothing here has a side effect
 * Every call below is either a read that must be rejected, or a deliberately-invalid write.
 * In particular the OTP check sends a malformed number so the request cannot reach Twilio —
 * requesting a code for a *well-formed* number would deliver a real WhatsApp message to
 * whoever owns it.
 */

import { describe, expect, it } from "vitest";

import { ApiError, isApiError, isSessionExpired } from "@/lib/api/errors";
import { transport } from "@/lib/api/transport";

const live = process.env.LIVE_API === "1";

describe.skipIf(!live)("staging API — live", () => {
  it("rejects an unauthenticated read with a parseable UNAUTHENTICATED envelope", async () => {
    // The single most valuable assertion in this file: it exercises base URL + `/api/v1`
    // prefix + envelope parse + code narrowing + requestId extraction in one call. If the
    // client can produce this error correctly, its plumbing is right.
    const error = await transport({ method: "GET", path: "/profile/me" }).catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    const api = error as ApiError;
    expect(api.status).toBe(401);
    expect(api.code).toBe("UNAUTHENTICATED");
    expect(isSessionExpired(api)).toBe(true);
    // The support reference the UI shows. Present on every API error by contract.
    expect(api.requestId).toMatch(/[0-9a-f-]{8,}/);
  });

  it("reports an unknown path as NOT_FOUND rather than something generic", async () => {
    const error = await transport({ method: "GET", path: "/definitely-not-a-route" }).catch(
      (e: unknown) => e,
    );
    expect((error as ApiError).code).toBe("NOT_FOUND");
    expect((error as ApiError).status).toBe(404);
  });

  it("validates a POST body server-side, proving JSON serialisation reaches the API", async () => {
    // A malformed number: rejected by the validation pipe before any Twilio call, so this
    // cannot send a message to a real person.
    const error = await transport({
      method: "POST",
      path: "/auth/otp/request",
      body: { phoneE164: "not-a-phone-number" },
    }).catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    // 400 from the pipe. Asserted as a range rather than a literal code, because the
    // validation error's `code` is not documented in the spec and pinning an undocumented
    // value is how a test starts failing for no good reason.
    expect((error as ApiError).status).toBeGreaterThanOrEqual(400);
    expect((error as ApiError).status).toBeLessThan(500);
  });

  it("still serves a spec matching the committed snapshot, operation for operation", async () => {
    // Guards the snapshot itself: if staging's spec has moved on, the coverage assertions in
    // `api-contract.test.ts` are measuring against history rather than against the API.
    const response = await fetch("https://apistaging.getcontactbook.com/api/docs-json");
    expect(response.ok).toBe(true);

    const remote = (await response.json()) as {
      paths: Record<string, Record<string, unknown>>;
    };
    const snapshot = (await import("@/lib/api/openapi.snapshot.json")) as unknown as {
      default: { paths: Record<string, Record<string, unknown>> };
    };

    const operations = (paths: Record<string, Record<string, unknown>>): string[] =>
      Object.entries(paths)
        .flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${path}`))
        .sort();

    expect(operations(remote.paths)).toEqual(operations(snapshot.default.paths));
  }, 20_000);
});

/**
 * The OTP request rejects an unassignable number — and emits an undocumented code doing it.
 *
 * ## What this pinned down, and why it could not be pinned down any other way
 * The plan was to learn whether staging returns `devCode` (so sign-in could be demonstrated
 * without a handset) by requesting a code for `+447700900123` — inside `07700 900000–900999`,
 * the range Ofcom permanently reserves for drama, assigned to nobody. Safe by construction.
 *
 * The API rejected it: **400 `BAD_REQUEST`, "phoneE164 must be a valid phone number in E.164
 * format"**. The reserved range is well-formed E.164 but is not an *assignable* number, and the
 * API validates with a real phone-number library that knows the difference.
 *
 * Two consequences, both load-bearing:
 *
 * 1. **`BAD_REQUEST` is not in the spec.** The OpenAPI document lists no validation code for
 *    any endpoint, yet every DTO can produce this one. It was degrading to `UNKNOWN` and
 *    showing "Something went wrong" for what is really "check the number you typed", so it is
 *    now a first-class member of the taxonomy in `errors.ts`.
 * 2. **The `devCode` question cannot be answered without a real number.** There is no safe
 *    synthetic input — validation rejects exactly the ranges that would be safe to use. It
 *    needs a handset somebody owns. See `docs/INTEGRATION.md`.
 *
 * Never point this at a number you do not own.
 */
describe.skipIf(!live)("staging OTP request validation", () => {
  /** Ofcom's drama reserve. Well-formed E.164, deliberately unassignable. */
  const RESERVED_UK_TEST_NUMBER = "+447700900123";

  it("rejects an unassignable number with BAD_REQUEST, which the spec never documents", async () => {
    const { otpRequest } = await import("@/lib/api/endpoints/auth");

    const thrown = await otpRequest({ phoneE164: RESERVED_UK_TEST_NUMBER }).catch(
      (error: unknown) => error,
    );

    expect(isApiError(thrown)).toBe(true);
    const api = thrown as ApiError;

    // A cooldown from an earlier run would also be a legitimate answer — the request still
    // reached the API and was understood, which is what this file exists to check.
    if (api.code === "OTP_COOLDOWN" || api.code === "OTP_RATE_LIMITED") {
      console.log(`[staging] rate limit hit (${api.code}) — endpoint reachable and enforcing.`);
      return;
    }

    expect(api.status).toBe(400);
    // The point of the assertion: this must narrow to BAD_REQUEST, not degrade to UNKNOWN.
    expect(api.code).toBe("BAD_REQUEST");
    expect(api.requestId).toMatch(/[0-9a-f-]{8,}/);
  }, 25_000);

  it("renders that rejection as advice about the field, not as a generic failure", async () => {
    const { toScreenError } = await import("@/lib/api/errors");
    const shown = toScreenError(
      new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        rawMessage: "phoneE164 must be a valid phone number in E.164 format",
      }),
    );

    expect(shown.title).toBe("We couldn't accept that");
    // The API's own sentence names the DTO field, which is exactly the jargon §6.10 bans.
    expect(JSON.stringify(shown)).not.toContain("phoneE164");
    expect(JSON.stringify(shown)).not.toContain("E.164");
  });
});
