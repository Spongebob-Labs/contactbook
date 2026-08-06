import { describe, expect, it } from "vitest";
import {
  formatError,
  isAuthCredentialPath,
  resolveApiBase,
} from "@/lib/api";

describe("resolveApiBase", () => {
  it("keeps absolute http(s) bases and strips trailing slash", () => {
    expect(resolveApiBase("https://api.getcontactbook.com/api/")).toBe(
      "https://api.getcontactbook.com/api",
    );
    expect(resolveApiBase("http://localhost:8001/api")).toBe(
      "http://localhost:8001/api",
    );
  });

  it("falls back to production for relative or empty values", () => {
    expect(resolveApiBase("/api")).toBe("https://api.getcontactbook.com/api");
    expect(resolveApiBase("")).toBe("https://api.getcontactbook.com/api");
    expect(resolveApiBase(undefined)).toBe("https://api.getcontactbook.com/api");
  });
});

describe("isAuthCredentialPath", () => {
  it("matches OTP and auth credential routes", () => {
    expect(isAuthCredentialPath("/v1/auth/otp/whatsapp/send")).toBe(true);
    expect(isAuthCredentialPath("/v1/auth/otp/whatsapp/verify?x=1")).toBe(true);
    expect(isAuthCredentialPath("/v1/auth/register")).toBe(true);
    expect(isAuthCredentialPath("/v1/auth/refresh")).toBe(true);
    expect(isAuthCredentialPath("/v1/auth/logout")).toBe(true);
  });

  it("does not match app data or outdated request-code routes", () => {
    expect(isAuthCredentialPath("/v1/profile/me")).toBe(false);
    expect(isAuthCredentialPath("/v1/contacts")).toBe(false);
    expect(isAuthCredentialPath("/v1/auth/whatsapp/request-code")).toBe(false);
    expect(isAuthCredentialPath("/v1/auth/whatsapp/verify-code")).toBe(false);
  });
});

describe("formatError", () => {
  it("formats string and array messages", () => {
    expect(formatError({ message: "Nope" }, "fallback")).toBe("Nope");
    expect(formatError({ message: ["A", "B"] }, "fallback")).toBe("A; B");
  });

  it("uses fallback when message missing", () => {
    expect(formatError({}, "fallback")).toBe("fallback");
    expect(formatError("raw", "fallback")).toBe("fallback");
  });
});
