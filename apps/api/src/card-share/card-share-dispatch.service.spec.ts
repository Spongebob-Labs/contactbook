import { CardShareDispatchStatus, WhatsappMessagePurpose, WhatsappProvider } from "@prisma/client";
import { CardShareDispatchService } from "./card-share-dispatch.service";

describe("CardShareDispatchService", () => {
  const prisma = {
    cardShareRecipient: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const messaging = {
    sendTrackedWithProvider: jest.fn(),
  };
  const twilio = {
    send: jest.fn(),
  };
  const service = new CardShareDispatchService(
    prisma as never,
    messaging as never,
    twilio as never,
  );

  function recipient(overrides: Record<string, unknown> = {}) {
    return {
      id: "recipient-1",
      recipientCountryCode: "+1",
      recipientPhone: "4155551234",
      dispatchAttempts: 0,
      batch: {
        cardNameSnapshot: "Business Card",
        note: null,
        template: { contentSid: "HXabc" },
        vcardAsset: { objectKey: "card-1/x.vcf" },
        sender: { firstName: "Ada", lastName: "Lovelace" },
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.cardShareRecipient.update.mockResolvedValue({});
  });

  it("dispatches due recipients and marks them DISPATCHED on success", async () => {
    prisma.cardShareRecipient.findMany.mockResolvedValue([recipient()]);
    messaging.sendTrackedWithProvider.mockResolvedValue({
      ledgerId: "ledger-1",
      providerMessageId: "SM1",
      status: "sent",
    });

    await service.run();

    expect(prisma.cardShareRecipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dispatchStatus: {
            in: [CardShareDispatchStatus.PENDING, CardShareDispatchStatus.RETRYING],
          },
        }) as unknown,
      }),
    );

    const [toE164, purpose, correlationId, provider, send] =
      messaging.sendTrackedWithProvider.mock.calls[0] as [
        string,
        WhatsappMessagePurpose,
        string,
        WhatsappProvider,
        () => Promise<unknown>,
      ];
    expect(toE164).toBe("+14155551234");
    expect(purpose).toBe(WhatsappMessagePurpose.CARD_SHARE);
    expect(correlationId).toBe("recipient-1");
    expect(provider).toBe(WhatsappProvider.TWILIO);

    twilio.send.mockResolvedValue({ providerMessageId: "SM1", status: "sent" });
    await send();
    expect(twilio.send).toHaveBeenCalledWith({
      toE164: "+14155551234",
      contentSid: "HXabc",
      senderDisplayName: "Ada Lovelace",
      cardName: "Business Card",
      note: null,
      vcardObjectKey: "card-1/x.vcf",
    });

    expect(prisma.cardShareRecipient.update).toHaveBeenCalledWith({
      where: { id: "recipient-1" },
      data: {
        dispatchStatus: CardShareDispatchStatus.DISPATCHED,
        whatsappMessageId: "ledger-1",
        sentAt: expect.any(Date) as unknown,
      },
    });
  });

  it("retries with exponential backoff on transient failure", async () => {
    prisma.cardShareRecipient.findMany.mockResolvedValue([
      recipient({ dispatchAttempts: 1 }),
    ]);
    messaging.sendTrackedWithProvider.mockRejectedValue(new Error("network blip"));

    await service.run();

    expect(prisma.cardShareRecipient.update).toHaveBeenCalledWith({
      where: { id: "recipient-1" },
      data: expect.objectContaining({
        dispatchAttempts: 2,
        dispatchStatus: CardShareDispatchStatus.RETRYING,
        lastDispatchError: "network blip",
        nextAttemptAt: expect.any(Date) as unknown,
      }) as unknown,
    });
    const call = prisma.cardShareRecipient.update.mock.calls[0] as [
      { data: { nextAttemptAt: Date } },
    ];
    const delayMs = call[0].data.nextAttemptAt.getTime() - Date.now();
    // attempt 2 -> backoff = 30s * 2^2 = 120s
    expect(delayMs).toBeGreaterThan(100_000);
    expect(delayMs).toBeLessThanOrEqual(120_000);
  });

  it("marks FAILED (terminal) once max attempts are reached", async () => {
    prisma.cardShareRecipient.findMany.mockResolvedValue([
      recipient({ dispatchAttempts: 4 }),
    ]);
    messaging.sendTrackedWithProvider.mockRejectedValue(new Error("still broken"));

    await service.run();

    expect(prisma.cardShareRecipient.update).toHaveBeenCalledWith({
      where: { id: "recipient-1" },
      data: expect.objectContaining({
        dispatchAttempts: 5,
        dispatchStatus: CardShareDispatchStatus.FAILED,
      }) as unknown,
    });
  });

  it("processes multiple due recipients independently", async () => {
    prisma.cardShareRecipient.findMany.mockResolvedValue([
      recipient({ id: "r1" }),
      recipient({ id: "r2" }),
    ]);
    messaging.sendTrackedWithProvider
      .mockResolvedValueOnce({ ledgerId: "l1", providerMessageId: "SM1", status: "sent" })
      .mockRejectedValueOnce(new Error("boom"));

    await service.run();

    expect(prisma.cardShareRecipient.update).toHaveBeenCalledTimes(2);
    expect(prisma.cardShareRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1" } }),
    );
    expect(prisma.cardShareRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r2" } }),
    );
  });
});
