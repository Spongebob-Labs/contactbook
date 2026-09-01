/**
 * `auth` — 5 endpoints.
 *
 * `otpRequest` and `otpVerify` are the only two calls in the whole client that are
 * unauthenticated. Both live behind Server Actions (`@/lib/actions/auth`) because verifying
 * has to write cookies, which only an Action or a Route Handler can do.
 */

import "server-only";

import { anon, authed } from "@/lib/api/server";
import type {
  AuthMeResponseDto,
  OkResponseDto,
  RefreshResponseDto,
  RequestOtpDto,
  RequestOtpResponseDto,
  VerifyOtpDto,
  VerifyOtpResponseDto,
} from "@/lib/api/schema";

/**
 * Always 202 on a well-formed number — it never reveals whether an account exists.
 *
 * @throws `OTP_COOLDOWN` (resent inside 60s) or `OTP_RATE_LIMITED` (5/hour).
 */
export function otpRequest(body: RequestOtpDto): Promise<RequestOtpResponseDto> {
  return anon({ method: "POST", path: "/auth/otp/request", body });
}

/**
 * Signup and login are the same operation: the User row is created on first verification.
 *
 * ⚠ Returns the raw DTO only. Lifting the refresh token off `Set-Cookie` needs the
 * `Response`, which `transport` does not expose — so the sign-in Action calls the API
 * directly for this one endpoint. See `@/lib/actions/auth`.
 *
 * @throws `OTP_NOT_FOUND`, `OTP_INVALID`, `OTP_ATTEMPTS_EXCEEDED`.
 */
export function otpVerify(body: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
  return anon({ method: "POST", path: "/auth/otp/verify", body });
}

/** @throws `REFRESH_MISSING`, `REFRESH_INVALID`, `REFRESH_REUSE_DETECTED`. */
export function refresh(refreshToken: string): Promise<RefreshResponseDto> {
  return anon({ method: "POST", path: "/auth/refresh", refreshToken });
}

/** Revokes the whole refresh-token family upstream. Our own cookies are cleared separately. */
export function logout(): Promise<OkResponseDto> {
  return authed({ method: "POST", path: "/auth/logout" });
}

/**
 * Token claims only — `{id, phoneE164}`.
 *
 * ⚠ `POST`, not `GET`. Reach for `profileMe()` when you want a name or an email; auth stays
 * scoped to "who is this token for".
 */
export function authMe(): Promise<AuthMeResponseDto> {
  return authed({ method: "POST", path: "/auth/me" });
}
