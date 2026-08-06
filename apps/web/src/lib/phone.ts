import { DIAL_COUNTRIES } from "@/lib/dial-countries";

/** Builds E.164 from country calling code and local digits (strips spaces and leading 0). */
export function buildE164(dial: string, nationalRaw: string): string {
  const national = nationalDigits(nationalRaw);
  const normalizedDial = dial.startsWith("+") ? dial : `+${dial.replace(/\D/g, "")}`;
  if (!/^\+\d{1,4}$/.test(normalizedDial)) {
    throw new Error("Enter a valid country code.");
  }
  if (!/^\d{4,15}$/.test(national)) {
    throw new Error("Enter a valid phone number.");
  }
  return `${normalizedDial}${national}`;
}

export function nationalDigits(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "");
}

export type PhoneParts = {
  /** E.164 country calling code, e.g. `+91`. */
  countryCode: string;
  /** National digits without trunk prefix, e.g. `9876543210`. */
  phone: string;
};

const KNOWN_DIAL_DIGITS = Array.from(
  new Set(DIAL_COUNTRIES.map((country) => country.dial.replace(/\D/g, ""))),
).sort((a, b) => b.length - a.length);

/**
 * Splits a stored contact number into the `countryCode` + `phone` pair the
 * share API expects. Numbers written in international form (`+91…`, `0091…`)
 * are matched against the known dial codes; local-format numbers fall back to
 * `fallbackDial`. Returns `null` when the result is not a valid recipient.
 */
export function parsePhoneParts(
  raw: string,
  fallbackDial: string,
): PhoneParts | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  const isInternational = trimmed.startsWith("+") || digits.startsWith("00");

  if (isInternational) {
    const withoutPrefix = trimmed.startsWith("+")
      ? digits
      : digits.replace(/^00/, "");
    for (const dial of KNOWN_DIAL_DIGITS) {
      if (
        withoutPrefix.startsWith(dial) &&
        withoutPrefix.length > dial.length
      ) {
        return toPhoneParts(`+${dial}`, withoutPrefix.slice(dial.length));
      }
    }
    return null;
  }

  return toPhoneParts(fallbackDial, digits);
}

function toPhoneParts(dial: string, nationalRaw: string): PhoneParts | null {
  const countryCode = dial.startsWith("+")
    ? dial
    : `+${dial.replace(/\D/g, "")}`;
  const phone = nationalDigits(nationalRaw);
  if (!/^\+\d{1,4}$/.test(countryCode) || !/^\d{4,15}$/.test(phone)) {
    return null;
  }
  return { countryCode, phone };
}
