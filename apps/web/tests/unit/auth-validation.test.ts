import { describe, expect, it } from "vitest";

import {
  MAX_NAME_LENGTH,
  MAX_PHONE_DIGITS,
  MIN_PHONE_DIGITS,
  OTP_LENGTH,
  digitsOnly,
  validateAuthField,
  validateEmail,
  validateFirstName,
  validateLastName,
  validateOtp,
  validatePhone,
} from "@/lib/auth-validation";

/**
 * The six auth screens validate **format only, client-side** (spec §7.1 — there is no real
 * auth in this run, no OTP is sent and no token is issued). So these five functions are the
 * entire correctness surface of the flow: everything else is navigation and typography.
 *
 * Every case below is a string comparison. No React, no DOM, no timers.
 */

describe("digitsOnly", () => {
  it("keeps ASCII digits and drops everything else", () => {
    expect(digitsOnly("+91 98765-43210")).toBe("919876543210");
  });

  it("returns an empty string when there is nothing to keep", () => {
    expect(digitsOnly("abc")).toBe("");
  });

  it("does not treat Arabic-Indic digits as digits", () => {
    // `\d` is ASCII-only in JavaScript, and the tel input filters on the same rule, so a
    // pasted ٩٨٧٦٥ must not silently become a phone number.
    expect(digitsOnly("٩٨٧٦٥٤٣٢١٠")).toBe("");
  });
});

describe("validatePhone (A-1: non-empty, 6–15 digits, digits only)", () => {
  it("accepts a ten-digit number", () => {
    expect(validatePhone("9876543210")).toEqual({ valid: true, message: null });
  });

  it("accepts both boundaries of the 6–15 range", () => {
    expect(validatePhone("1".repeat(MIN_PHONE_DIGITS)).valid).toBe(true);
    expect(validatePhone("1".repeat(MAX_PHONE_DIGITS)).valid).toBe(true);
  });

  it("rejects one digit below and one digit above the range", () => {
    expect(validatePhone("1".repeat(MIN_PHONE_DIGITS - 1)).valid).toBe(false);
    expect(validatePhone("1".repeat(MAX_PHONE_DIGITS + 1)).valid).toBe(false);
  });

  it("rejects an empty value with a message that says what to do", () => {
    const result = validatePhone("");
    expect(result.valid).toBe(false);
    expect(result.message).toBe("Enter your phone number.");
  });

  it("rejects whitespace-only input", () => {
    expect(validatePhone("   ").valid).toBe(false);
  });

  it("rejects letters", () => {
    expect(validatePhone("98765abcde").valid).toBe(false);
  });

  it("rejects internal spaces rather than silently stripping them", () => {
    expect(validatePhone("98765 43210").valid).toBe(false);
  });

  it("rejects a leading + — the country code lives in the Select, not the field", () => {
    expect(validatePhone("+919876543210").valid).toBe(false);
  });

  it("says 'digits only' for a non-digit and 'how many digits' for a length problem", () => {
    expect(validatePhone("98765 43210").message).toBe(
      "Use digits only — no spaces, dashes or letters.",
    );
    expect(validatePhone("12345").message).toBe("A phone number is 6 to 15 digits.");
  });

  it("returns null as the message whenever it is valid", () => {
    expect(validatePhone("9876543210").message).toBeNull();
  });
});

describe("validateOtp (A-2: exactly 6 digits)", () => {
  it("accepts exactly six digits", () => {
    expect(validateOtp("123456")).toEqual({ valid: true, message: null });
    expect(OTP_LENGTH).toBe(6);
  });

  it("rejects five and seven digits", () => {
    expect(validateOtp("12345").valid).toBe(false);
    expect(validateOtp("1234567").valid).toBe(false);
  });

  it("rejects an empty code", () => {
    expect(validateOtp("").valid).toBe(false);
    expect(validateOtp("").message).toBe("Enter the 6-digit code.");
  });

  it("rejects a code with a letter in it", () => {
    expect(validateOtp("12a456").valid).toBe(false);
  });

  it("rejects six spaces", () => {
    expect(validateOtp("      ").valid).toBe(false);
  });
});

describe("validateFirstName / validateLastName (A-3, A-4: 1–40 chars)", () => {
  it("accepts an ordinary name", () => {
    expect(validateFirstName("Priyanka")).toEqual({ valid: true, message: null });
    expect(validateLastName("Raghunathan")).toEqual({ valid: true, message: null });
  });

  it("accepts exactly 40 characters and rejects 41", () => {
    expect(MAX_NAME_LENGTH).toBe(40);
    expect(validateFirstName("a".repeat(40)).valid).toBe(true);
    expect(validateFirstName("a".repeat(41)).valid).toBe(false);
  });

  it("rejects empty and whitespace-only values", () => {
    expect(validateFirstName("").valid).toBe(false);
    expect(validateFirstName("   ").valid).toBe(false);
    expect(validateLastName("").valid).toBe(false);
  });

  it("measures the trimmed value, so a padded name still passes", () => {
    expect(validateFirstName("  Arjun  ").valid).toBe(true);
  });

  it("names the field it is talking about, so the two screens never share one message", () => {
    expect(validateFirstName("").message).toBe("Enter your first name.");
    expect(validateLastName("").message).toBe("Enter your last name.");
    expect(validateFirstName("a".repeat(41)).message).toBe(
      "A first name here is 40 characters or fewer.",
    );
  });

  it("accepts a single character, a hyphen and an apostrophe", () => {
    expect(validateFirstName("M").valid).toBe(true);
    expect(validateLastName("Mehta-Rao").valid).toBe(true);
    expect(validateLastName("O'Neill").valid).toBe(true);
  });
});

describe("validateEmail (A-5: RFC-ish shape)", () => {
  it("accepts a minimal well-formed address", () => {
    expect(validateEmail("a@b.co")).toEqual({ valid: true, message: null });
  });

  it("accepts a real-looking address with dots and a plus tag", () => {
    expect(validateEmail("priyanka.r+cards@fernwood.example").valid).toBe(true);
  });

  it("rejects a@ — the case the plan names", () => {
    expect(validateEmail("a@").valid).toBe(false);
  });

  it("rejects a bare local part, a bare domain and an empty value", () => {
    expect(validateEmail("a").valid).toBe(false);
    expect(validateEmail("@b.co").valid).toBe(false);
    expect(validateEmail("").valid).toBe(false);
  });

  it("rejects a domain with no dot", () => {
    expect(validateEmail("a@b").valid).toBe(false);
  });

  it("rejects a trailing dot and a doubled @", () => {
    expect(validateEmail("a@b.").valid).toBe(false);
    expect(validateEmail("a@@b.co").valid).toBe(false);
  });

  it("rejects an internal space", () => {
    expect(validateEmail("a b@c.co").valid).toBe(false);
  });

  it("trims before judging", () => {
    expect(validateEmail("  a@b.co  ").valid).toBe(true);
  });

  it("rejects an address longer than 254 characters", () => {
    expect(validateEmail(`${"a".repeat(250)}@b.co`).valid).toBe(false);
  });

  it("distinguishes 'nothing typed' from 'wrong shape'", () => {
    expect(validateEmail("").message).toBe("Enter your email address.");
    expect(validateEmail("a@").message).toBe("That doesn't look like an email address.");
  });
});

describe("validateAuthField", () => {
  it("dispatches to the validator for each of the five answers", () => {
    expect(validateAuthField("phone", "9876543210").valid).toBe(true);
    expect(validateAuthField("otp", "123456").valid).toBe(true);
    expect(validateAuthField("firstName", "Priyanka").valid).toBe(true);
    expect(validateAuthField("lastName", "Raghunathan").valid).toBe(true);
    expect(validateAuthField("email", "a@b.co").valid).toBe(true);
  });

  it("carries the per-field message through, not a generic one", () => {
    expect(validateAuthField("firstName", "").message).toBe("Enter your first name.");
    expect(validateAuthField("lastName", "").message).toBe("Enter your last name.");
  });
});
