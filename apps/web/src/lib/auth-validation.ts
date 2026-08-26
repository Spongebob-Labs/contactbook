/**
 * Format validation for the six `(auth)` screens — spec §8D.2, §7.1.
 *
 * ⚠ **This is the entire validation surface of the sign-in flow, and it is client-side
 * only.** There is no real auth in this run: no OTP is sent, no token is issued, no session
 * is created and no route is guarded (§7.1, §3.1). Nothing here talks to anything — these
 * are five pure functions over strings, which is why they are unit-tested rather than
 * driven through a browser.
 *
 * Two rules the whole module follows:
 *
 * · **A message says what to do, never what went wrong.** "Enter your phone number." beats
 *   "Invalid input", and the two failure modes of a phone number get two different
 *   sentences because "6 to 15 digits" is useless advice to someone who typed a space.
 * · **`\d` is ASCII-only in JavaScript**, deliberately. A pasted Arabic-Indic numeral looks
 *   like a phone number and is not one, and the tel input filters on {@link digitsOnly}, so
 *   the field and the validator agree on what a digit is.
 */

/** §8D.2 A-1. */
export const MIN_PHONE_DIGITS = 6;
export const MAX_PHONE_DIGITS = 15;

/** §8D.2 A-2 — six boxes, six digits. `otp-input.tsx` renders this many. */
export const OTP_LENGTH = 6;

/** §8D.2 A-3 / A-4. Also the `maxLength` on both name inputs. */
export const MAX_NAME_LENGTH = 40;

/** RFC 5321's practical ceiling. Longer than this is paste noise, not an address. */
export const MAX_EMAIL_LENGTH = 254;

/** The five answers the flow collects, in step order. */
export type AuthField = "phone" | "otp" | "firstName" | "lastName" | "email";

export interface AuthValidation {
  valid: boolean;
  /** `null` exactly when `valid` is true — a caller can pass it straight to `error`. */
  message: string | null;
}

const VALID: AuthValidation = { valid: true, message: null };

function invalid(message: string): AuthValidation {
  return { valid: false, message };
}

/**
 * Every ASCII digit in the input, in order, and nothing else.
 *
 * Used by the tel input to filter keystrokes and by the OTP boxes to normalise a paste, so
 * that what a user can type and what {@link validatePhone} accepts can never drift apart.
 */
export function digitsOnly(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/**
 * A-1: non-empty, digits only, 6–15 of them.
 *
 * The country dialling code is a separate control (§8D.2), so a leading `+` here is a user
 * putting the code in the wrong box — rejected with the "digits only" sentence, which is
 * the one that tells them what to change.
 */
export function validatePhone(raw: string): AuthValidation {
  const value = raw.trim();
  if (value.length === 0) return invalid("Enter your phone number.");
  if (/[^0-9]/.test(value)) return invalid("Use digits only — no spaces, dashes or letters.");
  if (value.length < MIN_PHONE_DIGITS || value.length > MAX_PHONE_DIGITS) {
    return invalid(`A phone number is ${MIN_PHONE_DIGITS} to ${MAX_PHONE_DIGITS} digits.`);
  }
  return VALID;
}

/**
 * A-2: exactly six digits.
 *
 * One message for every failure, because the six boxes make the shape self-evident: the
 * only thing left to say is how many digits are missing, and the boxes already show that.
 */
export function validateOtp(raw: string): AuthValidation {
  const value = raw.trim();
  if (value.length !== OTP_LENGTH || /[^0-9]/.test(value)) {
    return invalid(`Enter the ${OTP_LENGTH}-digit code.`);
  }
  return VALID;
}

/**
 * A-3 / A-4: 1–40 characters after trimming.
 *
 * `label` is required rather than defaulted so the two screens can never end up sharing a
 * message — "Enter your name." on the last-name screen is the kind of small wrongness that
 * makes a form feel generated.
 */
function validateName(raw: string, label: "first name" | "last name"): AuthValidation {
  const value = raw.trim();
  if (value.length === 0) return invalid(`Enter your ${label}.`);
  if (value.length > MAX_NAME_LENGTH) {
    return invalid(`A ${label} here is ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  return VALID;
}

export function validateFirstName(raw: string): AuthValidation {
  return validateName(raw, "first name");
}

export function validateLastName(raw: string): AuthValidation {
  return validateName(raw, "last name");
}

/**
 * A-5: an "RFC-ish shape", which is the spec's wording and the right ambition.
 *
 * Full RFC 5322 in a regular expression is famously several hundred characters long and
 * still wrong, and this run has no way to send a message to the address anyway. So the test
 * is the one a user can act on: something, an `@`, something, a dot, something — no spaces
 * anywhere and no empty parts. `a@b` fails because a dotless domain in a signup form is a
 * typo far more often than it is an intranet host.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function validateEmail(raw: string): AuthValidation {
  const value = raw.trim();
  if (value.length === 0) return invalid("Enter your email address.");
  if (value.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(value)) {
    return invalid("That doesn't look like an email address.");
  }
  return VALID;
}

const VALIDATORS: Readonly<Record<AuthField, (raw: string) => AuthValidation>> = {
  phone: validatePhone,
  otp: validateOtp,
  firstName: validateFirstName,
  lastName: validateLastName,
  email: validateEmail,
};

/** Validate by field name — what the shared step form calls, so it stays field-agnostic. */
export function validateAuthField(field: AuthField, raw: string): AuthValidation {
  return VALIDATORS[field](raw);
}
