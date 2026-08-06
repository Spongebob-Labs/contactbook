import { beforeEach, describe, expect, it } from "vitest";
import {
  listConnections,
  resendConnectionRequest,
  sendConnectionRequest,
} from "@/lib/connections-api";
import {
  createWhatsappTemplate,
  deleteWhatsappTemplate,
  getWhatsappTemplate,
  listWhatsappTemplates,
  updateWhatsappTemplate,
} from "@/lib/whatsapp-templates-api";
import { clearGetCache } from "@/lib/api";
import { mockFetchSequence, pathFromUrl } from "@/test/fetch-mock";
import { FRONTEND_API_CONTRACT } from "../contract-map";

describe("connections-api integration", () => {
  beforeEach(() => {
    clearGetCache();
  });

  it("lists connections and coerces non-arrays to []", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: { not: "array" } },
    ]);
    await expect(listConnections()).resolves.toEqual([]);
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.connections.list.path}`,
    );
  });

  it("sends request and resend paths", async () => {
    const { calls } = mockFetchSequence([
      {
        status: 200,
        body: {
          type: "invite",
          id: "req-1",
          status: "PENDING",
          createdAt: "t",
        },
      },
      { status: 200, body: { status: "QUEUED" } },
    ]);
    await sendConnectionRequest({
      recipientCountryCode: "+91",
      recipientPhone: "9876543210",
      requesterSharedCardId: "card-1",
    });
    await resendConnectionRequest("req-1");
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.connections.request.path}`,
    );
    expect(calls[0]?.body).toEqual({
      recipientCountryCode: "+91",
      recipientPhone: "9876543210",
      requesterSharedCardId: "card-1",
    });
    expect(pathFromUrl(calls[1]?.url ?? "")).toBe(
      "/api/v1/connections/requests/req-1/resend",
    );
    expect(calls[1]?.method).toBe("POST");
  });
});

describe("whatsapp-templates-api integration", () => {
  beforeEach(() => {
    clearGetCache();
  });

  it("lists, gets, creates, patches, deletes", async () => {
    const template = {
      id: "1",
      key: "card_share_default",
      useCase: "CARD_SHARE",
      locale: "en",
      bodyPreview: "hi",
      contentSid: "HX",
      isDefault: true,
      isActive: true,
      createdAt: "t",
    };
    const { calls } = mockFetchSequence([
      { status: 200, body: [template] },
      { status: 200, body: template },
      { status: 200, body: template },
      { status: 200, body: template },
      { status: 200, body: { ok: true } },
    ]);

    await listWhatsappTemplates("CARD_SHARE");
    await getWhatsappTemplate("card_share_default");
    await createWhatsappTemplate({
      key: " card_share_custom ",
      body: " Hello {{1}} ",
      buttonTitle: " Open ",
    });
    await updateWhatsappTemplate("card_share_default", { isActive: false });
    await deleteWhatsappTemplate("card_share_default");

    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      "/api/v1/whatsapp-templates?useCase=CARD_SHARE",
    );
    expect(pathFromUrl(calls[1]?.url ?? "")).toBe(
      "/api/v1/whatsapp-templates/card_share_default",
    );
    expect(calls[2]?.method).toBe("POST");
    expect(calls[2]?.body).toMatchObject({
      key: "card_share_custom",
      body: "Hello {{1}}",
      buttonTitle: "Open",
      useCase: "CARD_SHARE",
      locale: "en",
    });
    expect(calls[3]?.method).toBe("PATCH");
    expect(calls[4]?.method).toBe("DELETE");
  });
});
