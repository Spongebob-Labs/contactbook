import { describe, expect, it, vi } from "vitest";
import {
  listCardsWithFieldCounts,
  toApiCardType,
} from "@/lib/cards-api";

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

describe("listCardsWithFieldCounts", () => {
  const cardA = {
    id: "card-a",
    name: "Has details",
    type: "PERSONAL",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
  };
  const cardB = {
    id: "card-b",
    name: "Empty",
    type: "PERSONAL",
    createdAt: "2026-08-09T10:00:00.000Z",
    updatedAt: "2026-08-09T10:00:00.000Z",
  };

  function routed(mappings: (id: string) => unknown) {
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/field-mappings")) {
        const id = url.includes("card-a") ? "card-a" : "card-b";
        const result = mappings(id);
        if (result === "fail") {
          return new Response("{}", { status: 500 });
        }
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify([cardA, cardB]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  }

  it("attaches each card's mapped field ids", async () => {
    // Without this the create wizard cannot tell a card that carries details
    // from an empty one, so it copies nothing and the recipient gets a name.
    vi.stubGlobal(
      "fetch",
      routed((id) => (id === "card-a" ? [{ cardId: id, fieldId: "f1" }] : [])),
    );

    const cards = await listCardsWithFieldCounts();

    expect(cards.find((card) => card.id === "card-a")?.mappedFieldIds).toEqual(["f1"]);
    expect(cards.find((card) => card.id === "card-b")?.mappedFieldIds).toEqual([]);
  });

  it("leaves the count unknown rather than guessing empty when the lookup fails", async () => {
    vi.stubGlobal("fetch", routed(() => "fail"));

    const cards = await listCardsWithFieldCounts();

    // Undefined means "unknown". Reporting [] would wrongly warn that a card
    // shares only a name.
    expect(cards.every((card) => card.mappedFieldIds === undefined)).toBe(true);
  });
});
