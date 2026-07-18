import { ConfigService } from "@nestjs/config";
import { WhatsappMessagePurpose } from "@prisma/client";
import { WHATSAPP_GATEWAY_SESSION_NOT_READY } from "./whatsapp-errors";
import { OpenWaProvider } from "./openwa.provider";

describe("OpenWaProvider", () => {
  const config = new ConfigService({
    OPENWA_BASE_URL: "http://openwa.test",
    OPENWA_API_KEY: "test-key",
    OPENWA_SESSION_ID: "session/1",
    OPENWA_SENDER_PHONE: "919676240186",
    OPENWA_REQUEST_TIMEOUT_MS: "1000",
  });

  afterEach(() => jest.restoreAllMocks());

  it("implements the provider contract with the OpenWA send-text endpoint", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messageId: "out-1", timestamp: 123 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const provider = new OpenWaProvider(config);

    const result = await provider.sendText({
      toE164: "+917069567007",
      text: "Hello",
      purpose: WhatsappMessagePurpose.CONVERSATION,
    });

    expect(result).toEqual({
      providerMessageId: "out-1",
      status: "sent",
      timestamp: 123,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://openwa.test/api/sessions/session%2F1/messages/send-text",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-API-Key": "test-key",
        }) as unknown,
        body: JSON.stringify({ chatId: "917069567007@c.us", text: "Hello" }),
      }),
    );
  });

  it("preserves a cached OpenWA 463 delivery failure", async () => {
    const provider = new OpenWaProvider(config);
    provider.handleInboundMessage({
      event: "message.failed",
      data: { messageId: "out-463", status: "failed", errorCode: "463" },
    });

    await expect(
      provider.getDeliveryStatus("+917069567007", "out-463"),
    ).resolves.toEqual({
      type: "message.failed",
      providerMessageId: "out-463",
      status: "failed",
      errorCode: "463",
    });
  });

  it("maps OpenWA session-not-ready 409 responses to a stable gateway error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          message:
            "Session is not connected. The WhatsApp client is not ready.",
          error: "Conflict",
          statusCode: 409,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const provider = new OpenWaProvider(config);

    await expect(
      provider.sendText({
        toE164: "+917069567007",
        text: "Hello",
        purpose: WhatsappMessagePurpose.CONVERSATION,
      }),
    ).rejects.toMatchObject({
      code: WHATSAPP_GATEWAY_SESSION_NOT_READY,
      message:
        "OpenWA request failed with status 409: Session is not connected. The WhatsApp client is not ready.",
      details: {
        providerStatusCode: 409,
        providerResponse: {
          message:
            "Session is not connected. The WhatsApp client is not ready.",
          error: "Conflict",
          statusCode: 409,
        },
      },
    });
  });

  it("normalizes text, location, and LID-resolved inbound payloads", () => {
    const provider = new OpenWaProvider(config);

    expect(
      provider.handleInboundMessage({
        event: "message.received",
        data: {
          id: "in-1",
          from: "12345@lid",
          senderPhone: "917069567007",
          body: " Accept ",
          type: "location",
          location: { latitude: 12.1, longitude: 77.2 },
          fromMe: false,
          isGroup: false,
        },
      }),
    ).toEqual({
      type: "message.received",
      providerMessageId: "in-1",
      fromE164: "+917069567007",
      text: "Accept",
      location: { latitude: 12.1, longitude: 77.2 },
    });
  });

  it("ignores outgoing, group, status, and malformed events", () => {
    const provider = new OpenWaProvider(config);
    expect(
      provider.handleInboundMessage({
        event: "message.received",
        data: { id: "1", fromMe: true },
      }),
    ).toBeNull();
    expect(
      provider.handleInboundMessage({
        event: "message.received",
        data: { id: "2", isGroup: true },
      }),
    ).toBeNull();
    expect(
      provider.handleInboundMessage({
        event: "message.received",
        data: { id: "3", isStatusBroadcast: true },
      }),
    ).toBeNull();
    expect(
      provider.handleInboundMessage({ event: "unknown", data: {} }),
    ).toBeNull();
  });
});
