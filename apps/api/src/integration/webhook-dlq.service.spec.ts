import { WebhookDlqStatus } from "@prisma/client";
import { WebhookDlqService } from "./webhook-dlq.service";

describe("WebhookDlqService", () => {
  const prisma = {
    webhookDeadLetter: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const webhookService = { handleInboundMessage: jest.fn() };
  const messaging = { markInboundProcessed: jest.fn() };
  const service = new WebhookDlqService(
    prisma as never,
    webhookService as never,
    messaging as never,
  );
  const event = {
    type: "message.received" as const,
    providerMessageId: "in-1",
    fromE164: "+12025551234",
    text: "Accept",
    location: { latitude: 12.1, longitude: 77.2 },
  };
  const record = {
    id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    source: "openwa_whatsapp",
    attempts: 0,
    payload: { ...event, ledgerId: "ledger-in-1" },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => jest.useRealTimers());

  it("enqueues a normalized OpenWA event", async () => {
    prisma.webhookDeadLetter.create.mockResolvedValue({});

    await service.enqueueOpenWa(
      event,
      "ledger-in-1",
      { "x-openwa-signature": "sig" },
      "https://api.test/webhook",
    );

    expect(prisma.webhookDeadLetter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "openwa_whatsapp",
        payload: { ...event, ledgerId: "ledger-in-1" },
        status: WebhookDlqStatus.PENDING,
        nextRetryAt: null,
      }) as unknown,
    });
  });

  it("replays normalized text and location and marks success", async () => {
    prisma.webhookDeadLetter.findMany.mockResolvedValue([record]);
    prisma.webhookDeadLetter.update.mockResolvedValue({});

    await service.retryPending();

    expect(webhookService.handleInboundMessage).toHaveBeenCalledWith(
      event.fromE164,
      event.text,
      event.location,
    );
    expect(messaging.markInboundProcessed).toHaveBeenCalledWith("ledger-in-1");
    expect(prisma.webhookDeadLetter.update).toHaveBeenLastCalledWith({
      where: { id: record.id },
      data: expect.objectContaining({
        status: WebhookDlqStatus.SUCCEEDED,
      }) as unknown,
    });
  });

  it("schedules exponential retry and permanently fails on attempt five", async () => {
    prisma.webhookDeadLetter.findMany.mockResolvedValue([
      { ...record, attempts: 4 },
    ]);
    prisma.webhookDeadLetter.update.mockResolvedValue({});
    webhookService.handleInboundMessage.mockRejectedValue(
      new Error("still broken"),
    );

    await service.retryPending();

    expect(prisma.webhookDeadLetter.update).toHaveBeenLastCalledWith({
      where: { id: record.id },
      data: expect.objectContaining({
        status: WebhookDlqStatus.FAILED,
        attempts: 5,
        nextRetryAt: null,
      }) as unknown,
    });
  });
});
