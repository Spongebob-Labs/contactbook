import { beforeEach, describe, expect, it } from "vitest";
import {
  createCard,
  deleteCard,
  generateCardVcard,
  getCard,
  getCardShareBatch,
  listCardFieldMappings,
  listCardShares,
  listCards,
  resendCardShareRecipient,
  shareCardBatch,
  updateCard,
} from "@/lib/cards-api";
import { clearGetCache } from "@/lib/api";
import { mockFetchSequence, pathFromUrl } from "@/test/fetch-mock";
import { FRONTEND_API_CONTRACT } from "../contract-map";

const apiCard = {
  id: "card-1",
  name: "Personal",
  type: "PERSONAL",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("cards-api integration", () => {
  beforeEach(() => {
    clearGetCache();
    localStorage.clear();
  });

  it("lists and gets cards with field-mappings merge", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: [apiCard] },
      { status: 200, body: apiCard },
      { status: 200, body: [{ cardId: "card-1", fieldId: "f1" }] },
    ]);
    const listed = await listCards();
    expect(listed[0]?.id).toBe("card-1");
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

  it("creates with API type only and stores presentation locally", async () => {
    const { calls } = mockFetchSequence([{ status: 200, body: apiCard }]);
    const created = await createCard({
      name: " Personal ",
      type: "PAYMENT" as never,
      theme: { presetId: "classic", primary: "#111111" },
    });
    expect(created.id).toBe("card-1");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toEqual({ name: "Personal", type: "CUSTOM" });
  });

  it("updates, deletes, mappings, vcard, share flows", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: apiCard },
      { status: 200, body: { ok: true } },
      { status: 200, body: [] },
      {
        status: 200,
        body: {
          url: "https://cdn/x.vcf",
          key: "k",
          mimeType: "text/vcard",
          contentHash: "h",
        },
      },
      {
        status: 200,
        body: {
          id: "batch-1",
          cardId: "card-1",
          createdAt: "t",
          recipients: [],
        },
      },
      {
        status: 200,
        body: { batches: [], total: 0, page: 1, limit: 20 },
      },
      {
        status: 200,
        body: {
          id: "batch-1",
          cardId: "card-1",
          createdAt: "t",
          recipients: [],
        },
      },
      {
        status: 200,
        body: {
          id: "r1",
          countryCode: "+91",
          phone: "999",
          dispatchStatus: "PENDING",
        },
      },
    ]);

    await updateCard("card-1", { name: "New" });
    await deleteCard("card-1");
    await listCardFieldMappings("card-1");
    await generateCardVcard("card-1", ["EMAIL"]);
    await shareCardBatch("card-1", {
      recipients: [{ countryCode: "+91", phone: "9999999999" }],
      note: " hi ",
    });
    await listCardShares("card-1", { page: 0, limit: 20 });
    await getCardShareBatch("batch-1");
    await resendCardShareRecipient("batch-1", "r1");

    expect(calls[0]?.method).toBe("PATCH");
    expect(calls[1]?.method).toBe("DELETE");
    expect(pathFromUrl(calls[3]?.url ?? "")).toBe("/api/v1/cards/card-1/vcard");
    expect(calls[3]?.body).toEqual({ fieldTypes: ["EMAIL"] });
    expect(pathFromUrl(calls[4]?.url ?? "")).toBe("/api/v1/cards/card-1/share");
    expect(calls[4]?.body).toMatchObject({
      recipients: [{ countryCode: "+91", phone: "9999999999" }],
      note: "hi",
    });
    expect(pathFromUrl(calls[5]?.url ?? "")).toContain("page=1");
    expect(pathFromUrl(calls[6]?.url ?? "")).toBe("/api/v1/card-shares/batch-1");
    expect(pathFromUrl(calls[7]?.url ?? "")).toBe(
      "/api/v1/card-shares/batch-1/recipients/r1/resend",
    );
  });
});
