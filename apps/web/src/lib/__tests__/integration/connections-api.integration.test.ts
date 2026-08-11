import { beforeEach, describe, expect, it } from "vitest";
import {
  listConnections,
  resendConnectionRequest,
  sendConnectionRequest,
} from "@/lib/connections-api";
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
