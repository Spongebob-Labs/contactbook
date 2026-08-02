import { apiFetch } from "@/lib/api";
import type { SendOtpResponse, VerifyCodeResponse } from "@/lib/types";

/**
 * Current auth channel against live API `…/api/v1`:
 *   1. POST /auth/otp/whatsapp/send
 *   2. POST /auth/otp/whatsapp/verify
 *   3. POST /auth/register (first-time users only)
 *
 * Outdated (do not call):
 *   POST /auth/whatsapp/request-code
 *   POST /auth/whatsapp/verify-code
 */

const PHONE_VERIFICATION_TOKEN_MIN_LENGTH = 20;

export type AuthPhoneContext = {
  phone: string;
  countryCode: string;
};

/** Body for `POST /auth/register` — phone is bound inside phoneVerificationToken. */
export type CompleteRegistrationInput = {
  phoneVerificationToken: string;
  firstName: string;
  lastName: string;
  email: string;
};

/** True when the value is a usable registration JWT from OTP verify. */
export function isPhoneVerificationToken(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= PHONE_VERIFICATION_TOKEN_MIN_LENGTH
  );
}

/**
 * True when OTP verify signed the user in (existing account).
 * Tolerates alternate shapes (string flag, tokens without phoneVerificationToken).
 */
export function isRegisteredAuthResult(
  result: VerifyCodeResponse | Record<string, unknown>,
): boolean {
  const payload = result as Record<string, unknown>;
  const registered = payload.registered;
  if (registered === true || registered === "true") {
    return true;
  }
  if (registered === false || registered === "false") {
    return false;
  }
  const accessToken =
    typeof payload.accessToken === "string" ? payload.accessToken : "";
  const phoneVerificationToken =
    typeof payload.phoneVerificationToken === "string"
      ? payload.phoneVerificationToken
      : "";
  if (accessToken.length > 0 && !isPhoneVerificationToken(phoneVerificationToken)) {
    return true;
  }
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  return userId.length > 0;
}

/** Twilio Authentication template — send WhatsApp OTP. */
export function sendWhatsappOtp(
  context: AuthPhoneContext,
): Promise<SendOtpResponse> {
  return apiFetch<SendOtpResponse>("/v1/auth/otp/whatsapp/send", {
    method: "POST",
    body: {
      phone: context.phone,
      countryCode: context.countryCode,
    },
    retry: false,
  });
}

/**
 * Twilio OTP verify: session when registered; otherwise `phoneVerificationToken`
 * for `POST /auth/register`.
 */
export function verifyWhatsappOtp(
  context: AuthPhoneContext,
  code: string,
): Promise<VerifyCodeResponse> {
  return apiFetch<VerifyCodeResponse>("/v1/auth/otp/whatsapp/verify", {
    method: "POST",
    body: {
      phone: context.phone,
      countryCode: context.countryCode,
      code,
    },
    retry: false,
  });
}

/**
 * First-time signup. Refuses to call the API without a real verification JWT
 * so we never hit class-validator 400s for a missing/empty token.
 */
export function completeRegistration(
  input: CompleteRegistrationInput,
): Promise<Record<string, never>> {
  const phoneVerificationToken = input.phoneVerificationToken.trim();
  if (!isPhoneVerificationToken(phoneVerificationToken)) {
    throw new Error(
      "Registration requires phoneVerificationToken from OTP verify.",
    );
  }

  return apiFetch<Record<string, never>>("/v1/auth/register", {
    method: "POST",
    body: {
      phoneVerificationToken,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim(),
    },
    retry: false,
  });
}
