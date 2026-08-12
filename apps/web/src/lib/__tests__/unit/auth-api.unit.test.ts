import { describe, expect, it } from "vitest";
import {
  completeRegistration,
  isPhoneVerificationToken,
  isRegisteredAuthResult,
} from "@/lib/auth-api";

describe("isPhoneVerificationToken", () => {
  it("accepts strings at least 20 chars", () => {
    expect(isPhoneVerificationToken("a".repeat(20))).toBe(true);
    expect(isPhoneVerificationToken(`  ${"b".repeat(20)}  `)).toBe(true);
  });

  it("rejects short or empty values", () => {
    expect(isPhoneVerificationToken("short")).toBe(false);
    expect(isPhoneVerificationToken("")).toBe(false);
    expect(isPhoneVerificationToken(null)).toBe(false);
    expect(isPhoneVerificationToken(undefined)).toBe(false);
  });
});

describe("isRegisteredAuthResult", () => {
  it("respects boolean and string registered flags", () => {
    expect(isRegisteredAuthResult({ registered: true })).toBe(true);
    expect(isRegisteredAuthResult({ registered: "true" })).toBe(true);
    expect(isRegisteredAuthResult({ registered: false })).toBe(false);
    expect(isRegisteredAuthResult({ registered: "false" })).toBe(false);
  });

  it("treats accessToken without phoneVerificationToken as registered", () => {
    expect(
      isRegisteredAuthResult({
        accessToken: "access-token-value",
        phoneVerificationToken: "",
      }),
    ).toBe(true);
  });

  it("treats phoneVerificationToken + access as unregistered signup path", () => {
    expect(
      isRegisteredAuthResult({
        accessToken: "access",
        phoneVerificationToken: "x".repeat(24),
      }),
    ).toBe(false);
  });

  it("falls back to userId presence", () => {
    expect(isRegisteredAuthResult({ userId: "user-1" })).toBe(true);
    expect(isRegisteredAuthResult({})).toBe(false);
  });
});

describe("completeRegistration guard", () => {
  const validInput = {
    phoneVerificationToken: "t".repeat(24),
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "9876543210",
    countryCode: "+91",
    email: "ada@example.com",
  };

  it("throws before network when token is missing", () => {
    expect(() =>
      completeRegistration({ ...validInput, phoneVerificationToken: "short" }),
    ).toThrow(/phoneVerificationToken/);
  });

  it("throws before network when phone is missing", () => {
    expect(() => completeRegistration({ ...validInput, phone: "" })).toThrow(
      /phone number/,
    );
  });

  it("throws before network when country code is missing", () => {
    expect(() =>
      completeRegistration({ ...validInput, countryCode: "" }),
    ).toThrow(/country code/);
  });
});
