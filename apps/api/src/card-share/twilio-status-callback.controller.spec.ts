import { ForbiddenException } from "@nestjs/common";
import { WhatsappProvider as WhatsappProviderName } from "@prisma/client";
import { TwilioStatusCallbackController } from "./twilio-status-callback.controller";
import { computeTwilioSignature } from "./twilio-signature.util";

const AUTH_TOKEN = "test-auth-token";
const PUBLIC_BASE = "https://api.example.com";
const FULL_URL = `${PUBLIC_BASE}/api/v1/webhooks/twilio/status`;

describe("TwilioStatusCallbackController", () => {
  const config = {
    get: jest.fn((key: string) =>
      key === "TWILIO_AUTH_TOKEN"
        ? AUTH_TOKEN
        : key === "APP_PUBLIC_URL"
          ? PUBLIC_BASE
          : undefined,
    ),
  };
  const messaging = { recordDelivery: jest.fn() };
  const prisma = { cardShareRecipient: { updateMany: jest.fn() } };
  const controller = new TwilioStatusCallbackController(
    config as never,
    messaging as never,
    prisma as never,
  );

  function reqFor(params: Record<string, string>) {
    return { body: params } as never;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.cardShareRecipient.updateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects a request with an invalid signature", async () => {
    const params = { MessageSid: "SM1", MessageStatus: "delivered" };
    await expect(
      controller.handleStatus(reqFor(params), "sha1=bad"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messaging.recordDelivery).not.toHaveBeenCalled();
  });

  it("rejects when Twilio config is missing, without leaking a signature check", async () => {
    const unconfigured = new TwilioStatusCallbackController(
      { get: () => undefined } as never,
      messaging as never,
      prisma as never,
    );
    await expect(
      unconfigured.handleStatus(reqFor({}), undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("cascades a delivered status onto the linked CardShareRecipient", async () => {
    const params = { MessageSid: "SM1", MessageStatus: "delivered" };
    const signature = computeTwilioSignature(AUTH_TOKEN, FULL_URL, params);
    messaging.recordDelivery.mockResolvedValue({
      count: 1,
      ids: ["ledger-1"],
    });

    await expect(
      controller.handleStatus(reqFor(params), signature),
    ).resolves.toEqual({ ok: true });

    expect(messaging.recordDelivery).toHaveBeenCalledWith(
      {
        type: "message.ack",
        providerMessageId: "SM1",
        status: "delivered",
        errorCode: undefined,
      },
      WhatsappProviderName.TWILIO,
    );
    expect(prisma.cardShareRecipient.updateMany).toHaveBeenCalledWith({
      where: { whatsappMessageId: { in: ["ledger-1"] } },
      data: expect.objectContaining({
        deliveryStatus: "DELIVERED",
        deliveredAt: expect.any(Date) as unknown,
      }) as unknown,
    });
  });

  it("maps failed/undelivered to message.failed and sets failedAt", async () => {
    const params = {
      MessageSid: "SM2",
      MessageStatus: "failed",
      ErrorCode: "63003",
    };
    const signature = computeTwilioSignature(AUTH_TOKEN, FULL_URL, params);
    messaging.recordDelivery.mockResolvedValue({
      count: 1,
      ids: ["ledger-2"],
    });

    await controller.handleStatus(reqFor(params), signature);

    expect(messaging.recordDelivery).toHaveBeenCalledWith(
      {
        type: "message.failed",
        providerMessageId: "SM2",
        status: "failed",
        errorCode: "63003",
      },
      WhatsappProviderName.TWILIO,
    );
    expect(prisma.cardShareRecipient.updateMany).toHaveBeenCalledWith({
      where: { whatsappMessageId: { in: ["ledger-2"] } },
      data: expect.objectContaining({
        deliveryStatus: "FAILED",
        failedAt: expect.any(Date) as unknown,
      }) as unknown,
    });
  });

  it("does not touch CardShareRecipient when no ledger row matched (stale/unknown callback)", async () => {
    const params = { MessageSid: "SM3", MessageStatus: "read" };
    const signature = computeTwilioSignature(AUTH_TOKEN, FULL_URL, params);
    messaging.recordDelivery.mockResolvedValue({ count: 0, ids: [] });

    await expect(
      controller.handleStatus(reqFor(params), signature),
    ).resolves.toEqual({ ok: true });
    expect(prisma.cardShareRecipient.updateMany).not.toHaveBeenCalled();
  });

  it("no-ops when MessageSid/MessageStatus are absent from the payload", async () => {
    const params = { AccountSid: "AC1" };
    const signature = computeTwilioSignature(AUTH_TOKEN, FULL_URL, params);

    await expect(
      controller.handleStatus(reqFor(params), signature),
    ).resolves.toEqual({ ok: true });
    expect(messaging.recordDelivery).not.toHaveBeenCalled();
  });
});
