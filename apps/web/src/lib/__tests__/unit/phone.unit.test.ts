import { describe, expect, it } from "vitest";
import { buildE164, nationalDigits, parsePhoneParts } from "@/lib/phone";

describe("nationalDigits", () => {
  it("strips non-digits and leading zeros", () => {
    expect(nationalDigits("09876 54321")).toBe("987654321");
    expect(nationalDigits("123")).toBe("123");
  });
});

describe("buildE164", () => {
  it("builds E.164 from dial and national number", () => {
    expect(buildE164("91", "9876543210")).toBe("+919876543210");
    expect(buildE164("+1", "4155552671")).toBe("+14155552671");
  });

  it("rejects invalid dial or national input", () => {
    expect(() => buildE164("xx", "9876543210")).toThrow(/country code/);
    expect(() => buildE164("91", "12")).toThrow(/phone number/);
  });
});

describe("parsePhoneParts", () => {
  it("splits known dial codes from international numbers", () => {
    expect(parsePhoneParts("+91 93472 43575", "+1")).toEqual({
      countryCode: "+91",
      phone: "9347243575",
    });
    expect(parsePhoneParts("+1 (415) 555-2671", "+91")).toEqual({
      countryCode: "+1",
      phone: "4155552671",
    });
    expect(parsePhoneParts("00971501234567", "+91")).toEqual({
      countryCode: "+971",
      phone: "501234567",
    });
  });

  it("applies the fallback dial code to local numbers", () => {
    expect(parsePhoneParts("09347243575", "+91")).toEqual({
      countryCode: "+91",
      phone: "9347243575",
    });
  });

  it("returns null for unknown dial codes and unusable numbers", () => {
    expect(parsePhoneParts("+999123456789", "+91")).toBeNull();
    expect(parsePhoneParts("123", "+91")).toBeNull();
    expect(parsePhoneParts("   ", "+91")).toBeNull();
  });
});
