import { beforeEach, describe, expect, it } from "vitest";
import {
  addCardFieldMapping,
  createCard,
  deleteCard,
  getCard,
  listCardFieldMappings,
  listCards,
  removeCardFieldMapping,
  updateCard,
} from "@/lib/cards-api";
import { clearGetCache } from "@/lib/api";
import { mockFetchSequence, pathFromUrl } from "@/test/fetch-mock";
import { FRONTEND_API_CONTRACT } from "../contract-map";

const apiCard = {
  id: "card-1",
  name: "Personal",
  type: "PERSONAL",
  isSensitive: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("cards-api integration", () => {
  beforeEach(() => {
    clearGetCache();
  });

  it("lists and gets cards with field-mappings merged in", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: [apiCard] },
      { status: 200, body: apiCard },
      { status: 200, body: [{ cardId: "card-1", fieldId: "f1" }] },
    ]);

    const listed = await listCards();
    expect(listed[0]?.id).toBe("card-1");
    expect(listed[0]?.isSensitive).toBe(false);
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.cards.list.path}`,
    );

    const detail = await getCard("card-1");
    expect(detail.mappedFieldIds).toEqual(["f1"]);
    expect(pathFromUrl(calls[1]?.url ?? "")).toBe("/api/v1/cards/card-1");
    expect(pathFromUrl(calls[2]?.url ?? "")).toBe(
      "/api/v1/cards/card-1/field-mappings",
    );
  });

  it("still resolves a card when the mappings call fails", async () => {
    mockFetchSequence([
      { status: 200, body: apiCard },
      { status: 500, body: { message: "boom" } },
    ]);
    const detail = await getCard("card-1");
    expect(detail.id).toBe("card-1");
    expect(detail.mappedFieldIds).toEqual([]);
  });

  it("creates with a trimmed name and a supported card type", async () => {
    const { calls } = mockFetchSequence([{ status: 200, body: apiCard }]);
    const created = await createCard({
      name: " Personal ",
      type: "PAYMENT" as never,
    });
    expect(created.id).toBe("card-1");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toEqual({ name: "Personal", type: "CUSTOM" });
  });

  it("updates, deletes, and edits field mappings", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: { ...apiCard, isSensitive: true } },
      { status: 200, body: [] },
      { status: 200, body: { cardId: "card-1", fieldId: "f1" } },
      { status: 200, body: { ok: true } },
      { status: 200, body: { ok: true } },
    ]);

    const updated = await updateCard("card-1", {
      name: " New ",
      isSensitive: true,
    });
    expect(updated.isSensitive).toBe(true);
    expect(calls[0]?.method).toBe("PATCH");
    expect(calls[0]?.body).toEqual({ name: "New", isSensitive: true });

    await listCardFieldMappings("card-1");
    await addCardFieldMapping("card-1", "f1");
    await removeCardFieldMapping("card-1", "f1");
    await deleteCard("card-1");

    expect(pathFromUrl(calls[1]?.url ?? "")).toBe(
      "/api/v1/cards/card-1/field-mappings",
    );
    expect(calls[2]?.method).toBe("POST");
    expect(calls[2]?.body).toEqual({ fieldId: "f1" });
    expect(calls[3]?.method).toBe("DELETE");
    expect(pathFromUrl(calls[3]?.url ?? "")).toBe(
      "/api/v1/cards/card-1/field-mappings/f1",
    );
    expect(calls[4]?.method).toBe("DELETE");
    expect(pathFromUrl(calls[4]?.url ?? "")).toBe("/api/v1/cards/card-1");
  });
});
