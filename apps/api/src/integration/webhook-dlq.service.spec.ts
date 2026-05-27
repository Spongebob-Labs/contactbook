import { WebhookDlqStatus } from "@prisma/client";
import { WebhookDlqService } from "./webhook-dlq.service";

const RECORD_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";

const makePrisma = () => ({
  webhookDeadLetter: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
});

const makeWebhookService = () => ({
  handleInboundMessage: jest.fn(),
});

describe("WebhookDlqService", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let webhookService: ReturnType<typeof makeWebhookService>;
  let svc: WebhookDlqService;

  beforeEach(() => {
    jest.useFakeTimers();
    prisma = makePrisma();
    webhookService = makeWebhookService();
    svc = new WebhookDlqService(prisma as never, webhookService as never);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── enqueue ───────────────────────────────────────────────────────────────

  describe("enqueue", () => {
    it("creates a PENDING record with null nextRetryAt", async () => {
      prisma.webhookDeadLetter.create.mockResolvedValue({});
      await svc.enqueue(
        { From: "whatsapp:+12025551234", Body: "hi" },
        { "x-twilio-signature": "sig" },
        "https://example.com/api/v1/webhooks/twilio/whatsapp",
      );
      expect(prisma.webhookDeadLetter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: "twilio_whatsapp",
          status: WebhookDlqStatus.PENDING,
          nextRetryAt: null,
        }),
      });
    });
  });

  // ─── retryPending ──────────────────────────────────────────────────────────

  describe("retryPending", () => {
    const baseRecord = {
      id: RECORD_ID,
      attempts: 0,
      payload: { From: "whatsapp:+12025551234", Body: "ACCEPT-conn-1" },
      headers: { "x-twilio-signature": "sig" },
      webhookUrl: "https://example.com/api/v1/webhooks/twilio/whatsapp",
    };

    it("does nothing when no records are pending", async () => {
      prisma.webhookDeadLetter.findMany.mockResolvedValue([]);
      await svc.retryPending();
      expect(webhookService.handleInboundMessage).not.toHaveBeenCalled();
    });

    it("marks record SUCCEEDED when handler resolves", async () => {
      prisma.webhookDeadLetter.findMany.mockResolvedValue([baseRecord]);
      prisma.webhookDeadLetter.update.mockResolvedValue({});
      webhookService.handleInboundMessage.mockResolvedValue(undefined);

      await svc.retryPending();

      // first update: mark RETRYING
      expect(prisma.webhookDeadLetter.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: { status: WebhookDlqStatus.RETRYING },
        }),
      );
      // second update: mark SUCCEEDED
      expect(prisma.webhookDeadLetter.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({ status: WebhookDlqStatus.SUCCEEDED }),
        }),
      );
    });

    it("increments attempts and schedules next retry on handler error", async () => {
      prisma.webhookDeadLetter.findMany.mockResolvedValue([baseRecord]);
      prisma.webhookDeadLetter.update.mockResolvedValue({});
      webhookService.handleInboundMessage.mockRejectedValue(
        new Error("db unavailable"),
      );

      jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      await svc.retryPending();

      const secondCall = prisma.webhookDeadLetter.update.mock.calls[1][0];
      expect(secondCall.data.status).toBe(WebhookDlqStatus.PENDING);
      expect(secondCall.data.attempts).toBe(1);
      // backoff: 2^(1-1) = 1 min
      expect(secondCall.data.nextRetryAt).toEqual(
        new Date("2026-01-01T00:01:00Z"),
      );
    });

    it("marks record FAILED after MAX_ATTEMPTS", async () => {
      const exhaustedRecord = { ...baseRecord, attempts: 4 }; // 4 done, this is attempt 5
      prisma.webhookDeadLetter.findMany.mockResolvedValue([exhaustedRecord]);
      prisma.webhookDeadLetter.update.mockResolvedValue({});
      webhookService.handleInboundMessage.mockRejectedValue(
        new Error("still broken"),
      );

      await svc.retryPending();

      const secondCall = prisma.webhookDeadLetter.update.mock.calls[1][0];
      expect(secondCall.data.status).toBe(WebhookDlqStatus.FAILED);
      expect(secondCall.data.attempts).toBe(5);
      expect(secondCall.data.nextRetryAt).toBeNull();
    });

    it("prefers ButtonText over Body when both present", async () => {
      const record = {
        ...baseRecord,
        payload: { From: "whatsapp:+12025551234", Body: "fallback", ButtonText: "  Accept  " },
      };
      prisma.webhookDeadLetter.findMany.mockResolvedValue([record]);
      prisma.webhookDeadLetter.update.mockResolvedValue({});
      webhookService.handleInboundMessage.mockResolvedValue(undefined);

      await svc.retryPending();

      expect(webhookService.handleInboundMessage).toHaveBeenCalledWith(
        "whatsapp:+12025551234",
        "Accept",
      );
    });
  });
});
