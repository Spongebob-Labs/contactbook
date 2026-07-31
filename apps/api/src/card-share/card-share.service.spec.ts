import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { CardShareDispatchStatus, WhatsappMessageStatus } from "@prisma/client";
import { CardShareService } from "./card-share.service";

describe("CardShareService", () => {
  const tx = {
    cardShareBatch: { create: jest.fn() },
    cardShareRecipient: { createMany: jest.fn() },
  };
  const prisma = {
    contactCard: { findFirst: jest.fn() },
    contact: { findMany: jest.fn() },
    cardShareRecipient: { findMany: jest.fn(), update: jest.fn() },
    cardShareBatch: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const vcardGenerator = { getOrCreateAsset: jest.fn() };
  const templates = { resolveActive: jest.fn() };

  const service = new CardShareService(
    prisma as never,
    vcardGenerator as never,
    templates as never,
  );

  const USER_ID = "user-1";
  const CARD_ID = "card-1";
  const CARD = {
    id: CARD_ID,
    userId: USER_ID,
    name: "Business Card",
    type: "BUSINESS",
    isSensitive: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.contactCard.findFirst.mockResolvedValue(CARD);
    prisma.contact.findMany.mockResolvedValue([]);
    prisma.cardShareRecipient.findMany.mockResolvedValue([]);
    templates.resolveActive.mockResolvedValue({ id: "template-1" });
    vcardGenerator.getOrCreateAsset.mockResolvedValue({ id: "asset-1" });
    tx.cardShareBatch.create.mockResolvedValue({ id: "batch-1" });
    tx.cardShareRecipient.createMany.mockResolvedValue({ count: 1 });
    prisma.cardShareBatch.findFirst.mockResolvedValue({
      id: "batch-1",
      cardId: CARD_ID,
      cardNameSnapshot: "Business Card",
      cardTypeSnapshot: "BUSINESS",
      note: null,
      createdAt: new Date(),
      recipients: [],
    });
  });

  describe("createBatch", () => {
    const dto = {
      recipients: [{ countryCode: "+1", phone: "4155551234" }],
    };

    it("throws 404 when the card doesn't exist or isn't owned by the user", async () => {
      prisma.contactCard.findFirst.mockResolvedValue(null);
      await expect(
        service.createBatch(USER_ID, CARD_ID, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws 400 when the card is marked sensitive", async () => {
      prisma.contactCard.findFirst.mockResolvedValue({
        ...CARD,
        isSensitive: true,
      });
      await expect(
        service.createBatch(USER_ID, CARD_ID, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(templates.resolveActive).not.toHaveBeenCalled();
    });

    it("throws 400 when a recipient's contactId isn't owned by the user", async () => {
      prisma.contact.findMany.mockResolvedValue([]); // none found -> mismatch
      await expect(
        service.createBatch(USER_ID, CARD_ID, {
          recipients: [
            { countryCode: "+1", phone: "4155551234", contactId: "contact-9" },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws 429 when the rolling-24h distinct recipient cap would be exceeded", async () => {
      prisma.cardShareRecipient.findMany.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({
          recipientCountryCode: "+1",
          recipientPhone: `555000${i}`,
        })),
      );
      await expect(
        service.createBatch(USER_ID, CARD_ID, dto),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
      await expect(
        service.createBatch(USER_ID, CARD_ID, dto),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it("propagates a 400 when no active template resolves", async () => {
      templates.resolveActive.mockRejectedValue(
        new BadRequestException("No active CARD_SHARE template is configured"),
      );
      await expect(
        service.createBatch(USER_ID, CARD_ID, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("dedupes recipients with the same countryCode+phone within one request", async () => {
      await service.createBatch(USER_ID, CARD_ID, {
        recipients: [
          { countryCode: "+1", phone: "4155551234" },
          { countryCode: "+1", phone: "4155551234" },
          { countryCode: "+1", phone: "4155559999" },
        ],
      });

      const createManyArg = tx.cardShareRecipient.createMany.mock
        .calls[0] as unknown as [{ data: unknown[] }];
      expect(createManyArg[0].data).toHaveLength(2);
    });

    it("creates a batch + recipients and returns the batch detail on the happy path", async () => {
      const result = await service.createBatch(USER_ID, CARD_ID, dto);

      expect(vcardGenerator.getOrCreateAsset).toHaveBeenCalledWith(
        USER_ID,
        CARD,
        undefined,
      );
      expect(tx.cardShareBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cardId: CARD_ID,
          cardNameSnapshot: "Business Card",
          cardTypeSnapshot: "BUSINESS",
          senderId: USER_ID,
          templateId: "template-1",
          vcardAssetId: "asset-1",
        }) as unknown,
      });
      expect(tx.cardShareRecipient.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            batchId: "batch-1",
            recipientCountryCode: "+1",
            recipientPhone: "4155551234",
            recipientContactId: null,
          }),
        ],
      });
      expect(result.id).toBe("batch-1");
    });
  });

  describe("listBatchesForCard", () => {
    it("throws 404 when the card isn't owned by the user", async () => {
      prisma.contactCard.findFirst.mockResolvedValue(null);
      await expect(
        service.listBatchesForCard(USER_ID, CARD_ID, { page: 1, limit: 25 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns a paginated shape", async () => {
      prisma.contactCard.findFirst.mockResolvedValue({ id: CARD_ID });
      prisma.cardShareBatch.count.mockResolvedValue(1);
      prisma.cardShareBatch.findMany.mockResolvedValue([
        {
          id: "batch-1",
          cardId: CARD_ID,
          cardNameSnapshot: "Business Card",
          cardTypeSnapshot: "BUSINESS",
          note: null,
          createdAt: new Date(),
          recipients: [],
        },
      ]);

      const result = await service.listBatchesForCard(USER_ID, CARD_ID, {
        page: 1,
        limit: 25,
      });
      expect(result).toEqual(
        expect.objectContaining({ total: 1, page: 1, limit: 25, totalPages: 1 }),
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe("getBatch", () => {
    it("throws 404 when the batch isn't owned by the user", async () => {
      prisma.cardShareBatch.findFirst.mockResolvedValue(null);
      await expect(
        service.getBatch(USER_ID, "batch-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("resendRecipient", () => {
    function batchWithRecipient(recipient: Record<string, unknown>) {
      return {
        id: "batch-1",
        cardId: CARD_ID,
        cardNameSnapshot: "Business Card",
        cardTypeSnapshot: "BUSINESS",
        note: null,
        createdAt: new Date(),
        recipients: [
          {
            id: "recipient-1",
            recipientCountryCode: "+1",
            recipientPhone: "4155551234",
            recipientContactId: null,
            dispatchStatus: CardShareDispatchStatus.PENDING,
            deliveryStatus: null,
            lastDispatchError: null,
            sentAt: null,
            deliveredAt: null,
            readAt: null,
            failedAt: null,
            createdAt: new Date(),
            ...recipient,
          },
        ],
      };
    }

    it("throws 404 when the recipient doesn't exist in the batch", async () => {
      prisma.cardShareBatch.findFirst.mockResolvedValue(
        batchWithRecipient({ id: "some-other-id" }),
      );
      await expect(
        service.resendRecipient(USER_ID, "batch-1", "recipient-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws 409 when the recipient isn't in a terminal failed state", async () => {
      prisma.cardShareBatch.findFirst.mockResolvedValue(
        batchWithRecipient({ dispatchStatus: CardShareDispatchStatus.DISPATCHED }),
      );
      await expect(
        service.resendRecipient(USER_ID, "batch-1", "recipient-1"),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("allows resend when dispatchStatus is FAILED", async () => {
      prisma.cardShareBatch.findFirst.mockResolvedValue(
        batchWithRecipient({ dispatchStatus: CardShareDispatchStatus.FAILED }),
      );
      prisma.cardShareRecipient.update.mockResolvedValue({
        id: "recipient-1",
        recipientCountryCode: "+1",
        recipientPhone: "4155551234",
        recipientContactId: null,
        dispatchStatus: CardShareDispatchStatus.PENDING,
        deliveryStatus: null,
        lastDispatchError: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        failedAt: null,
        createdAt: new Date(),
      });

      const result = await service.resendRecipient(
        USER_ID,
        "batch-1",
        "recipient-1",
      );

      expect(prisma.cardShareRecipient.update).toHaveBeenCalledWith({
        where: { id: "recipient-1" },
        data: {
          dispatchStatus: CardShareDispatchStatus.PENDING,
          dispatchAttempts: 0,
          nextAttemptAt: expect.any(Date) as unknown,
          lastDispatchError: null,
        },
      });
      expect(result.dispatchStatus).toBe(CardShareDispatchStatus.PENDING);
    });

    it("allows resend when dispatchStatus is DISPATCHED but deliveryStatus is FAILED", async () => {
      prisma.cardShareBatch.findFirst.mockResolvedValue(
        batchWithRecipient({
          dispatchStatus: CardShareDispatchStatus.DISPATCHED,
          deliveryStatus: WhatsappMessageStatus.FAILED,
        }),
      );
      prisma.cardShareRecipient.update.mockResolvedValue({
        id: "recipient-1",
        recipientCountryCode: "+1",
        recipientPhone: "4155551234",
        recipientContactId: null,
        dispatchStatus: CardShareDispatchStatus.PENDING,
        deliveryStatus: null,
        lastDispatchError: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        failedAt: null,
        createdAt: new Date(),
      });

      await expect(
        service.resendRecipient(USER_ID, "batch-1", "recipient-1"),
      ).resolves.toMatchObject({ dispatchStatus: CardShareDispatchStatus.PENDING });
    });
  });
});
