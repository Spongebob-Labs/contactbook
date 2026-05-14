import { BadRequestException } from "@nestjs/common";
import parsePhoneNumberFromString from "libphonenumber-js/max";

export type PhoneIdentity = { countryCode: string; phone: string };

/** National significant number (digits only, no country calling code). */
export function normalizeNationalPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.replace(/^0+/, "") || digits;
}

/**
 * Normalizes an E.164 country calling prefix to a leading `+` and digits only
 * (e.g. `1` → `+1`, `+44` → `+44`).
 */
export function normalizeDialCode(input: string): string {
  const raw = String(input ?? "").trim();
  const digits = raw.startsWith("+")
    ? raw.slice(1).replace(/\D/g, "")
    : raw.replace(/\D/g, "");
  if (!digits.length) {
    return "+";
  }
  return `+${digits}`;
}

export function assertDialAndNationalFormat(
  dial: string,
  national: string,
): void {
  const d = normalizeDialCode(dial);
  if (!/^\+\d{1,4}$/.test(d)) {
    throw new BadRequestException("Invalid country calling code");
  }
  const n = normalizeNationalPhone(national);
  if (n.length < 4 || n.length > 15) {
    throw new BadRequestException("Invalid national phone number");
  }
}

/** Concatenate country calling prefix and national digits into E.164 (Twilio / OTP). */
export function composeE164(
  countryCallingPrefix: string,
  nationalPhone: string,
): string {
  const dial = normalizeDialCode(countryCallingPrefix);
  const national = normalizeNationalPhone(nationalPhone);
  assertDialAndNationalFormat(dial, national);
  return `${dial}${national}`;
}

export function e164FromStoredUser(user: {
  countryCode: string;
  phone: string;
}): string {
  return composeE164(user.countryCode, user.phone);
}

/** Parse inbound WhatsApp E.164 into stored identity (calling prefix + national). */
export function inboundE164ToIdentity(e164Raw: string): PhoneIdentity | null {
  const trimmed = e164Raw.trim();
  const withPlus = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  const parsed = parsePhoneNumberFromString(withPlus);
  if (!parsed?.isValid()) {
    return null;
  }
  const cc = parsed.countryCallingCode;
  if (!cc) {
    return null;
  }
  return {
    countryCode: `+${cc}`,
    phone: String(parsed.nationalNumber),
  };
}
