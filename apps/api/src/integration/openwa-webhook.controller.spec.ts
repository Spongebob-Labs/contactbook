import { ForbiddenException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { OpenWaWebhookController } from "./openwa-webhook.controller";

describe("OpenWaWebhookController", () => {
  const messaging = {
    normalizeProviderEvent: jest.fn(),
    recordDelivery: jest.fn(),
    claimInbound: jest.fn(),
    markInboundProcessed: jest.fn(),
    markInboundFailed: jest.fn(),
  };
  const processor = { handleInboundMessage: jest.fn() };
  const dlq = { enqueueOpenWa: jest.fn() };
  const config = { get: jest.fn(() => "webhook-secret") };
  const controller = new OpenWaWebhookController(
    messaging as never,
    processor as never,
    dlq as never,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    messaging.claimInbound.mockResolvedValue("ledger-in-1");
  });

  it("rejects an invalid OpenWA signature", async () => {
    const req = requestFor({ event: "message.received", data: {} });

    await expect(
      controller.whatsapp(req as never, "sha256=bad"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updates delivery state for a signed ack", async () => {
    const payload = {
      event: "message.ack",
      data: { messageId: "wa-1", status: "delivered" },
    };
    const event = {
      type: "message.ack",
      providerMessageId: "wa-1",
      status: "delivered",
    };
    const req = requestFor(payload);
    messaging.normalizeProviderEvent.mockReturnValue(event);

    await expect(
      controller.whatsapp(req as never, signature(req.rawBody)),
    ).resolves.toEqual({ ok: true });
    expect(messaging.recordDelivery).toHaveBeenCalledWith(event);
    expect(processor.handleInboundMessage).not.toHaveBeenCalled();
  });

  it("processes a normalized inbound location only after claiming its provider ID", async () => {
    const payload = { event: "message.received", data: { id: "in-1" } };
    const event = {
      type: "message.received",
      providerMessageId: "in-1",
      fromE164: "+917069567007",
      text: "",
      location: { latitude: 12.1, longitude: 77.2 },
    };
    const req = requestFor(payload);
    messaging.normalizeProviderEvent.mockReturnValue(event);

    await controller.whatsapp(req as never, signature(req.rawBody));

    expect(processor.handleInboundMessage).toHaveBeenCalledWith(
      "+917069567007",
      "",
      event.location,
    );
    expect(messaging.markInboundProcessed).toHaveBeenCalledWith("ledger-in-1");
  });

  it("ignores duplicate inbound delivery", async () => {
    const req = requestFor({ event: "message.received", data: { id: "in-1" } });
    messaging.normalizeProviderEvent.mockReturnValue({
      type: "message.received",
      providerMessageId: "in-1",
      fromE164: "+917069567007",
      text: "Accept",
    });
    messaging.claimInbound.mockResolvedValue(null);

    await controller.whatsapp(req as never, signature(req.rawBody));

    expect(processor.handleInboundMessage).not.toHaveBeenCalled();
  });

  it("persists normalized processing failures for replay and still acknowledges receipt", async () => {
    const req = requestFor({ event: "message.received", data: { id: "in-1" } });
    const event = {
      type: "message.received",
      providerMessageId: "in-1",
      fromE164: "+917069567007",
      text: "Accept",
    };
    messaging.normalizeProviderEvent.mockReturnValue(event);
    processor.handleInboundMessage.mockRejectedValue(
      new Error("db unavailable"),
    );

    await expect(
      controller.whatsapp(req as never, signature(req.rawBody)),
    ).resolves.toEqual({ ok: true });
    expect(messaging.markInboundFailed).toHaveBeenCalledWith(
      "ledger-in-1",
      expect.any(Error),
    );
    expect(dlq.enqueueOpenWa).toHaveBeenCalledWith(
      event,
      "ledger-in-1",
      expect.any(Object),
      expect.any(String),
    );
  });
});

function requestFor(payload: unknown) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  return {
    rawBody,
    body: payload,
    originalUrl: "/api/v1/webhooks/openwa/whatsapp",
    headers: {},
  };
}

function signature(rawBody: Buffer): string {
  return `sha256=${createHmac("sha256", "webhook-secret").update(rawBody).digest("hex")}`;
}
