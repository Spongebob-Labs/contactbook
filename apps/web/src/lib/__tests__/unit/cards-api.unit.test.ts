import { describe, expect, it } from "vitest";
import { toApiCardType } from "@/lib/cards-api";

describe("toApiCardType", () => {
  it("keeps supported API card types", () => {
    expect(toApiCardType("PERSONAL")).toBe("PERSONAL");
    expect(toApiCardType("BUSINESS")).toBe("BUSINESS");
    expect(toApiCardType("CUSTOM")).toBe("CUSTOM");
  });

  it("maps unknown/legacy types to CUSTOM", () => {
    expect(toApiCardType("PAYMENT")).toBe("CUSTOM");
    expect(toApiCardType("other")).toBe("CUSTOM");
  });
});
