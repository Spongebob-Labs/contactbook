"use server";

/**
 * The sign-in flow, for real.
 *
 * ## What replaced what
 * The six `(auth)` screens used to validate a string and navigate — no request, no token, no
 * session (§7.1). Now: two of them call the API, one submits onboarding, and the session they
 * create is what `middleware.ts` guards `(app)` with.
 *
 * ## The mapping from six screens to three calls
 * | screen | call |
 * | --- | --- |
 * | `/signin/phone` | `POST /auth/otp/request` |
 * | `/signin/otp` | `POST /auth/otp/verify`, then `GET /profile/me` to decide where next |
 * | `/signup/first-name`, `/last-name` | nothing — held in memory |
 * | `/signup/email` | `POST /profile/onboarding` with all three answers at once |
 * | `/signup/done` | nothing — a confirmation |
 *
 * Onboarding fires on the **email** screen rather than the confirmation screen, even though the
 * confirmation is where the flow ends. Two reasons: onboarding is one-shot (409 on a second
 * call), so it must happen exactly once at a point the user cannot re-enter by pressing Back;
 * and if it fails, the person is still standing on a form that can show them why. A
 * confirmation screen that submits on mount and then apologises is the worse version.
 *
 * ## Validation happens here, again
 * Every screen already validates client-side. These actions validate the same inputs a second
 * time, because a Server Action is a public HTTP endpoint — the client-side check is a courtesy
 * to the user, not a constraint on the caller.
 */

import { redirect } from "next/navigation";

import { profile } from "@/lib/api";
// `otpVerify` is deliberately not imported: verifying needs the response headers, so it goes
// through `transportRaw` below. See the note in `verifyOtpAction`.
import { otpRequest, logout } from "@/lib/api/endpoints/auth";
import { findCookie, transport, transportRaw } from "@/lib/api/transport";
import { UPSTREAM_REFRESH_COOKIE } from "@/lib/api/config";
import { clearSession, writeSession } from "@/lib/api/session";
import type { MeResponseDto, VerifyOtpResponseDto } from "@/lib/api/schema";
import {
  validateEmail,
  validateFirstName,
  validateLastName,
  validateOtp,
  validatePhone,
} from "@/lib/auth-validation";
import { toE164 } from "@/lib/countries";
import { failFrom, failLocally, succeed, type ActionResult } from "@/lib/actions/result";

/* ── Step 1: request a code ──────────────────────────────────────────────────────────── */

export interface RequestOtpOutcome {
  /** The number the code went to, in E.164 — echoed back so the OTP screen can name it. */
  phoneE164: string;
  /**
   * The code itself, when the API chose to return it.
   *
   * Present only outside production and only when Twilio is unconfigured — the API decides,
   * never us. When it is here, no WhatsApp message was sent, so surfacing it is the difference
   * between a demo that can be completed and one that cannot. The OTP screen labels it as a
   * staging aid rather than pretending it is normal.
   */
  devCode?: string;
}

export async function requestOtpAction(
  country: string,
  phoneDigits: string,
): Promise<ActionResult<RequestOtpOutcome>> {
  const check = validatePhone(phoneDigits);
  if (!check.valid) return failLocally(check.message ?? "Enter your phone number.");

  const phoneE164 = toE164(country, phoneDigits);

  try {
    const response = await otpRequest({ phoneE164 });
    return succeed({ phoneE164, devCode: response.devCode });
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/* ── Step 2: verify, and mint the session ────────────────────────────────────────────── */

export interface VerifyOtpOutcome {
  /**
   * Where the flow goes next. `false` sends them into `/signup/*` to finish setup; `true`
   * means they are a returning user and the six-step flow is over at step two.
   */
  isOnboardingCompleted: boolean;
}

export async function verifyOtpAction(
  country: string,
  phoneDigits: string,
  code: string,
): Promise<ActionResult<VerifyOtpOutcome>> {
  const phoneCheck = validatePhone(phoneDigits);
  if (!phoneCheck.valid) return failLocally("We lost your number. Go back and enter it again.");

  const codeCheck = validateOtp(code);
  if (!codeCheck.valid) return failLocally(codeCheck.message ?? "Enter the 6-digit code.");

  const phoneE164 = toE164(country, phoneDigits);

  try {
    // `transportRaw` rather than the endpoint function, because this is the one call whose
    // response headers matter: the refresh token exists *only* as a `Set-Cookie` scoped to the
    // API's own domain, so it has to be lifted out here or rotation is impossible later.
    const { data, setCookies } = await transportRaw<VerifyOtpResponseDto>({
      method: "POST",
      path: "/auth/otp/verify",
      body: { phoneE164, code },
    });

    const refreshToken = findCookie(setCookies, UPSTREAM_REFRESH_COOKIE);
    await writeSession(data.accessToken, refreshToken);

    if (typeof data.isOnboardingCompleted === "boolean") {
      return succeed({ isOnboardingCompleted: data.isOnboardingCompleted });
    }

    // An API build that predates the flag. Read the profile with the token we just received
    // rather than through `authed()`: relying on `cookies().get()` seeing a value set moments
    // earlier in the same request is the kind of assumption that works until it doesn't.
    const me = await transport<MeResponseDto>({
      method: "GET",
      path: "/profile/me",
      accessToken: data.accessToken,
    });

    return succeed({ isOnboardingCompleted: me.onboardingCompleted });
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/** Resend. Separate from {@link requestOtpAction} only so the screen can report it differently. */
export async function resendOtpAction(
  country: string,
  phoneDigits: string,
): Promise<ActionResult<RequestOtpOutcome>> {
  return requestOtpAction(country, phoneDigits);
}

/* ── Step 3: onboarding ──────────────────────────────────────────────────────────────── */

export async function submitOnboardingAction(input: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<ActionResult<undefined>> {
  const first = validateFirstName(input.firstName);
  if (!first.valid) return failLocally(first.message ?? "Enter your first name.");

  const last = validateLastName(input.lastName);
  if (!last.valid) return failLocally(last.message ?? "Enter your last name.");

  // Required by the API, which is why the email step no longer offers "Skip for now":
  // onboarding is one-shot, so a skipped email could not be added through this endpoint later.
  const email = validateEmail(input.email);
  if (!email.valid) return failLocally(email.message ?? "Enter your email address.");

  try {
    await profile.completeOnboarding({
      identity: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        primaryEmail: input.email.trim(),
      },
    });
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/* ── Sign out ────────────────────────────────────────────────────────────────────────── */

/**
 * Revoke upstream, clear locally, leave.
 *
 * The upstream call is best-effort on purpose. If it fails — expired token, API down — the
 * local cookies are still cleared, because the alternative is a user who pressed "Sign out",
 * saw an error, and is still signed in. Their refresh token stays valid upstream until it
 * expires, which is a real (small) cost, accepted knowingly: the button must always work.
 */
export async function signOutAction(): Promise<void> {
  try {
    await logout();
  } catch {
    // Deliberately swallowed — see above.
  }
  await clearSession();

  // Outside the try: `redirect()` signals by throwing, so catching it would swallow the
  // navigation and leave the user on a dead page.
  redirect("/");
}
