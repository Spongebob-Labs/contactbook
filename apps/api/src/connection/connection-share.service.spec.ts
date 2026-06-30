import { ConnectionStatus } from "@prisma/client";
import { ConnectionShareService } from "./connection-share.service";

describe("ConnectionShareService", () => {
  const prisma = {
    connection: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    contactCard: { findFirst: jest.fn(), findMany: jest.fn() },
    whatsappSession: { updateMany: jest.fn(), create: jest.fn() },
  };
  const contactUpsert = { upsert: jest.fn() };
  const messaging = { sendText: jest.fn() };

  const svc = new ConnectionShareService(
    prisma as never,
    contactUpsert as never,
    messaging as never,
  );

  const requester = {
    id: "req-1",
    firstName: "Req",
    lastName: "User",
    email: "r@example.com",
    phone: "2025551111",
    countryCode: "+1",
  };
  const receiver = {
    id: "recv-1",
    firstName: "Rec",
    lastName: "User",
    email: "v@example.com",
    phone: "2025552222",
    countryCode: "+1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("completes connection when both cards are shared", async () => {
    prisma.connection.findUnique.mockResolvedValue({
      id: "conn-1",
      status: ConnectionStatus.PENDING,
      requesterId: requester.id,
      receiverId: receiver.id,
      requester,
      receiver,
      receiverSharedCardId: null,
      requesterSharedCardId: null,
    });
    prisma.contactCard.findFirst
      .mockResolvedValueOnce({
        id: "card-r",
        userId: receiver.id,
        name: "Personal",
      })
      .mockResolvedValueOnce({
        id: "card-r",
        userId: receiver.id,
        name: "Personal",
        fieldMappings: [],
      });
    prisma.connection.update
      .mockResolvedValueOnce({
        receiverSharedCardId: "card-r",
        requesterSharedCardId: null,
      })
      .mockResolvedValueOnce({});
    prisma.connection.findUniqueOrThrow.mockResolvedValue({
      id: "conn-1",
      status: ConnectionStatus.ACCEPTED,
    });

    const result = await svc.shareCard(
      "conn-1",
      receiver.id,
      "card-r",
      "recipient",
    );
    expect(contactUpsert.upsert).toHaveBeenCalledWith(
      requester.id,
      expect.objectContaining({ source: "CONTACTBOOK" }),
    );
    expect(result.completed).toBe(false);
  });

  it("sends card selection as plain provider text", async () => {
    prisma.connection.findFirst.mockResolvedValue({
      id: "conn-1",
      status: ConnectionStatus.PENDING,
      requester,
      receiver,
    });
    prisma.contactCard.findMany.mockResolvedValue([
      { id: "card-1", name: "Personal" },
    ]);
    prisma.whatsappSession.updateMany.mockResolvedValue({ count: 1 });

    await svc.beginRecipientCardSelection("conn-1", receiver.id);

    expect(messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        toE164: "+12025552222",
        text: expect.stringContaining("1. Personal") as unknown,
        correlationId: "conn-1",
      }),
    );
  });
});
