import {
  WhatsappMessageDirection,
  WhatsappMessagePurpose,
  WhatsappMessageStatus,
  WhatsappProvider as WhatsappProviderName,
} from "@prisma/client";
import { WhatsappMessagingService } from "./whatsapp-messaging.service";
import {
  RECIPIENT_INITIATION_REQUIRED,
  WhatsappProviderError,
} from "./whatsapp-errors";

describe("WhatsappMessagingService", () => {
  const prisma = {
    whatsappMessage: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const provider = {
    sendText: jest.fn(),
    sendOtp: jest.fn(),
    sendConnectionInvite: jest.fn(),
    handleInboundMessage: jest.fn(),
    getDeliveryStatus: jest.fn(),
    getReadiness: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === "OPENWA_DELIVERY_POLL_ATTEMPTS"
        ? "1"
        : key === "OPENWA_DELIVERY_POLL_INTERVAL_MS"
          ? "0"
          : fallback,
    ),
  };
  const service = new WhatsappMessagingService(
    prisma as never,
    provider,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.whatsappMessage.create.mockResolvedValue({ id: "ledger-1" });
    prisma.whatsappMessage.update.mockResolvedValue({});
    prisma.whatsappMessage.updateMany.mockResolvedValue({ count: 1 });
    prisma.whatsappMessage.findUnique.mockResolvedValue({
      status: WhatsappMessageStatus.SENT,
      providerErrorCode: null,
    });
    provider.getDeliveryStatus.mockResolvedValue({
      type: "message.ack",
      providerMessageId: "wa-1",
      status: "sent",
    });
  });

  it("records an OTP attempt without persisting the code or body", async () => {
    provider.sendOtp.mockResolvedValue({
      providerMessageId: "wa-1",
      status: "sent",
      timestamp: 123,
    });

    const result = await service.sendOtp({
      toE164: "+917069567007",
      code: "123456",
      expiresInMinutes: 10,
      correlationId: "otp-1",
    });

    const createCall = prisma.whatsappMessage.create.mock
      .calls[0] as unknown as [{ data: Record<string, unknown> }];
    const createData = createCall[0].data;
    expect(createData).toMatchObject({
      provider: WhatsappProviderName.OPENWA,
      direction: WhatsappMessageDirection.OUTBOUND,
      purpose: WhatsappMessagePurpose.OTP,
      phoneE164: "+917069567007",
      correlationId: "otp-1",
      status: WhatsappMessageStatus.PENDING,
    });
    expect(JSON.stringify(createData)).not.toContain("123456");
    expect(result).toEqual({
      ledgerId: "ledger-1",
      providerMessageId: "wa-1",
      status: "sent",
    });
  });

  it("records provider failure details before rethrowing a stable error", async () => {
    provider.sendText.mockRejectedValue(
      new WhatsappProviderError(RECIPIENT_INITIATION_REQUIRED, "initiate", {
        providerMessageId: "wa-463",
        providerErrorCode: "463",
      }),
    );

    await expect(
      service.sendText({
        toE164: "+917069567007",
        text: "Hello",
        purpose: WhatsappMessagePurpose.CONVERSATION,
      }),
    ).rejects.toMatchObject({ code: RECIPIENT_INITIATION_REQUIRED });
    expect(prisma.whatsappMessage.update).toHaveBeenCalledWith({
      where: { id: "ledger-1" },
      data: expect.objectContaining({
        providerMessageId: "wa-463",
        providerErrorCode: "463",
        status: WhatsappMessageStatus.FAILED,
        failedAt: expect.any(Date) as unknown,
      }) as unknown,
    });
  });

  it("maps a cross-instance ledger 463 to recipient initiation required", async () => {
    provider.sendOtp.mockResolvedValue({
      providerMessageId: "wa-463",
      status: "sent",
    });
    prisma.whatsappMessage.findUnique.mockResolvedValue({
      status: WhatsappMessageStatus.FAILED,
      providerErrorCode: "463",
    });

    await expect(
      service.sendOtp({
        toE164: "+917069567007",
        code: "123456",
        expiresInMinutes: 10,
      }),
    ).rejects.toMatchObject({
      code: RECIPIENT_INITIATION_REQUIRED,
      details: { providerMessageId: "wa-463", providerErrorCode: "463" },
    });
  });

  it("applies duplicate delivery events idempotently", async () => {
    prisma.whatsappMessage.updateMany.mockResolvedValue({ count: 1 });
    const event = {
      type: "message.ack" as const,
      providerMessageId: "wa-1",
      status: "delivered" as const,
    };

    await service.recordDelivery(event);
    await service.recordDelivery(event);

    expect(prisma.whatsappMessage.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.whatsappMessage.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        provider: WhatsappProviderName.OPENWA,
        providerMessageId: "wa-1",
      }) as unknown,
      data: expect.objectContaining({
        status: WhatsappMessageStatus.DELIVERED,
        deliveredAt: expect.any(Date) as unknown,
      }) as unknown,
    });
  });

  it("claims an inbound provider message only once", async () => {
    prisma.whatsappMessage.create
      .mockResolvedValueOnce({ id: "inbound-ledger" })
      .mockRejectedValueOnce({ code: "P2002" });
    prisma.whatsappMessage.findUnique.mockResolvedValue({
      id: "inbound-ledger",
      status: WhatsappMessageStatus.PROCESSED,
    });
    const event = {
      type: "message.received" as const,
      providerMessageId: "in-1",
      fromE164: "+917069567007",
      text: "Accept",
    };

    await expect(service.claimInbound(event)).resolves.toBe("inbound-ledger");
    await expect(service.claimInbound(event)).resolves.toBeNull();
    expect(prisma.whatsappMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deduplicationKey: "OPENWA:INBOUND:in-1:message.received",
        direction: WhatsappMessageDirection.INBOUND,
        status: WhatsappMessageStatus.RECEIVED,
      }) as unknown,
    });
  });

  it("resumes a failed inbound claim when OpenWA retries after DLQ persistence failure", async () => {
    prisma.whatsappMessage.create.mockRejectedValueOnce({ code: "P2002" });
    prisma.whatsappMessage.findUnique.mockResolvedValue({
      id: "inbound-ledger",
      status: WhatsappMessageStatus.FAILED,
    });

    await expect(
      service.claimInbound({
        type: "message.received",
        providerMessageId: "in-1",
        fromE164: "+917069567007",
        text: "Accept",
      }),
    ).resolves.toBe("inbound-ledger");
  });
});
