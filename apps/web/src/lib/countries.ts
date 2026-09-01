/**
 * Country dialling data, and the two conversions between a typed number and E.164.
 *
 * ## Why this is its own module
 * This data used to live in `components/auth/country-select.tsx`, which is a `"use client"`
 * module that imports the `Select` primitive. The API mapper and the sign-in Server Action
 * both need the conversions, and importing them from there would drag a React component tree
 * into server-only code. So the data and the pure functions live here, and the component
 * re-exports them — every existing import site is unchanged.
 *
 * Pure: no React, no I/O, no clock.
 */

export interface Country {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** E.164 dialling prefix, `+` included. */
  dial: string;
}

export const COUNTRIES: readonly Country[] = [
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "US", name: "United States", dial: "+1" },
] as const;

const BY_CODE: ReadonlyMap<string, Country> = new Map(
  COUNTRIES.map((country) => [country.code, country] as const),
);

/** `"IN"` → `"+91"`. An unknown code returns an empty string rather than throwing. */
export function dialCodeFor(code: string): string {
  return BY_CODE.get(code)?.dial ?? "";
}

/** `"IN"` → `"India"`. Used by the OTP screen's helper line. */
export function countryNameFor(code: string): string {
  return BY_CODE.get(code)?.name ?? "";
}

/**
 * The number as it will be dialled, e.g. `+91 9820115577` — spaced, for reading.
 *
 * ⚠ Not what the API wants. `POST /auth/otp/request` requires strict E.164 with no
 * separators; use {@link toE164} for that. Keeping the two as separate functions is
 * deliberate — they differ by one space, and that space is the difference between a
 * delivered OTP and a 400.
 */
export function dialledNumber(code: string, phone: string): string {
  const dial = dialCodeFor(code);
  return dial.length === 0 ? phone : `${dial} ${phone}`;
}

/**
 * Country + local digits → strict E.164, e.g. `+919820115577`.
 *
 * Two normalisations, both of which exist because the API rejects anything that is not strict
 * E.164 and a rejected sign-in is indistinguishable from a broken one:
 *
 * 1. **Non-digits are stripped.** A pasted `98201 15577` or `(982) 011-5577` becomes a valid
 *    number instead of a 400.
 * 2. **Leading zeros are dropped.** A national trunk prefix is not part of an E.164 number:
 *    London's `020 7123 4567` is `+442071234567`, not `+4402071234567`. People type the number
 *    the way they would dial it at home, which for most of the world includes that zero.
 *
 * ⚠ The second rule is safe for {@link COUNTRIES} as it stands and **must be rechecked if that
 * list grows**. It holds for every trunk-prefix country here (GB, DE, FR, AU, IN, ZA, KE, NG,
 * JP, BR, AE) and is a no-op for the ones with no trunk prefix (US, CA, SG), whose national
 * numbers never begin with a zero. It would be wrong for Italy, where the leading zero is part
 * of the subscriber number — so adding `IT` means replacing this rule with a per-country flag,
 * not extending it.
 */
export function toE164(code: string, phone: string): string {
  const national = phone.replace(/[^0-9]/g, "").replace(/^0+/, "");
  return `${dialCodeFor(code)}${national}`;
}

/**
 * E.164 → its dialling prefix, e.g. `+919820115577` → `+91`.
 *
 * Longest match wins, which is what makes `+1` (US/Canada) harmless here: both countries
 * share the prefix, and the prefix is all this returns. That is exactly what the domain's
 * `User.countryCode` holds — the dial code, not the ISO code.
 *
 * Returns `""` for a number whose prefix is not in {@link COUNTRIES}, rather than guessing.
 */
export function dialPrefixOf(e164: string): string {
  let best = "";
  for (const { dial } of COUNTRIES) {
    if (e164.startsWith(dial) && dial.length > best.length) best = dial;
  }
  return best;
}
