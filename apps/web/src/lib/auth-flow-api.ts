"use client";

/**
 * The sign-in flow's three API calls, made from the browser.
 *
 * ## Why these replaced Server Actions
 * They were Server Actions, which worked — but a Server Action appears in the Network tab as an
 * opaque POST to the current route, not as `POST /auth/otp/request`. Sign-in is the first thing
 * anybody demos, so it is the last place where the real call should be invisible.
 *
 * These go through `/api/cb/*` like everything else, so the request payload and the API's exact
 * response body are both inspectable.
 *
 * ## The `ActionResult` shape is kept deliberately
 * `useStepAnswer` takes an `action` returning `ActionResult<T>` and renders a failure under the
 * field. Keeping that contract means the six auth screens are unchanged — only the transport moved.
 *
 * ## Cookies still happen server-side
 * `POST /auth/otp/verify` returns the access token in its body and the refresh token as a
 * `Set-Cookie` scoped to the API's domain. The proxy lifts both out and re-homes them as
 * first-party httpOnly cookies. So the browser sees the response, and never holds the credential.
 */

import { auth, profile } from "@/lib/api/browser";
import { failFrom, failLocally, succeed, type ActionResult } from "@/lib/actions/result";
import {
  validateEmail,
  validateFirstName,
  validateLastName,
  validateOtp,
  validatePhone,
} from "@/lib/auth-validation";
import { toE164 } from "@/lib/countries";

export interface RequestOtpOutcome {
  /** The number the code went to, in E.164 — echoed back so the OTP screen can name it. */
  phoneE164: string;
  /**
   * The code itself, when the API chose to return it.
   *
   * Present only outside production and only when Twilio is unconfigured — the API decides, never
   * us. When it is here no WhatsApp message was sent, so showing it is the difference between a
   * demo that can be completed and one that cannot.
   */
  devCode?: string;
}

/** `POST /auth/otp/request`. @throws nothing — failures come back as `ActionResult`. */
export async function requestOtp(
  country: string,
  phoneDigits: string,
): Promise<ActionResult<RequestOtpOutcome>> {
  const check = validatePhone(phoneDigits);
  if (!check.valid) return failLocally(check.message ?? "Enter your phone number.");

  const phoneE164 = toE164(country, phoneDigits);
  try {
    const response = await auth.otpRequest({ phoneE164 });
    return succeed({ phoneE164, devCode: response.devCode });
  } catch (thrown) {
    return failFrom(thrown);
  }
}

export interface VerifyOtpOutcome {
  /** `false` sends them into `/signup/*`; `true` means a returning user and the flow ends here. */
  onboardingCompleted: boolean;
}

/**
 * `POST /auth/otp/verify`, then `GET /profile/me` to decide where next.
 *
 * Two visible requests. The first mints the session (the proxy re-homes its cookies); the second
 * answers the only remaining question, because signup and login are the same operation upstream
 * and `onboardingCompleted` is what tells them apart.
 */
export async function verifyOtp(
  country: string,
  phoneDigits: string,
  code: string,
): Promise<ActionResult<VerifyOtpOutcome>> {
  if (!validatePhone(phoneDigits).valid) {
    return failLocally("We lost your number. Go back and enter it again.");
  }
  const codeCheck = validateOtp(code);
  if (!codeCheck.valid) return failLocally(codeCheck.message ?? "Enter the 6-digit code.");

  try {
    await auth.otpVerify({ phoneE164: toE164(country, phoneDigits), code });
    const me = await profile.me();
    return succeed({ onboardingCompleted: me.onboardingCompleted });
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/**
 * `POST /profile/onboarding` — all three answers in one call.
 *
 * One-shot upstream (409 on a second call), which is why it fires on the email step rather than
 * the confirmation screen: the email step cannot be re-entered by pressing Back.
 */
export async function submitOnboarding(input: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<ActionResult<undefined>> {
  const first = validateFirstName(input.firstName);
  if (!first.valid) return failLocally(first.message ?? "Enter your first name.");
  const last = validateLastName(input.lastName);
  if (!last.valid) return failLocally(last.message ?? "Enter your last name.");
  // Required by the API, which is why the email step no longer offers "Skip for now".
  const email = validateEmail(input.email);
  if (!email.valid) return failLocally(email.message ?? "Enter your email address.");

  try {
    await profile.onboarding({
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
