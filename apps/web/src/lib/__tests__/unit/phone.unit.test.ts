import { describe, expect, it } from "vitest";
import { buildE164, nationalDigits } from "@/lib/phone";

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
