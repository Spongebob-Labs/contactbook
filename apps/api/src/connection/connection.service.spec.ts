import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConnectionStatus } from "@prisma/client";
import { ConnectionService } from "./connection.service";

describe("ConnectionService", () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    contactCard: { count: jest.fn() },
    contact: { findFirst: jest.fn(), findMany: jest.fn() },
    connection: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    connectionInvite: { findFirst: jest.fn() },
    whatsappSession: { updateMany: jest.fn(), create: jest.fn() },
  };
  const twilio = { sendConnectionInvite: jest.fn() };
  const invites = { createInvite: jest.fn() };

  const svc = new ConnectionService(
    prisma as never,
    twilio as never,
    invites as never,
  );

  const requester = {
    id: "req-1",
    firstName: "A",
    lastName: "B",
    email: "a@example.com",
    countryCode: "+1",
    phone: "5551111111",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(requester);
    prisma.contactCard.count.mockResolvedValue(1);
    prisma.contact.findMany.mockResolvedValue([]);
  });

  it("rejects self-request", async () => {
    await expect(
      svc.createRequest("req-1", {
        recipientCountryCode: "+1",
        recipientPhone: "5551111111",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when requester has no cards", async () => {
    prisma.contactCard.count.mockResolvedValue(0);
    await expect(
      svc.createRequest("req-1", {
        recipientCountryCode: "+1",
        recipientPhone: "2025559999",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates connection for registered recipient", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(requester)
      .mockResolvedValueOnce({
        id: "recv-1",
        countryCode: "+1",
        phone: "2025559999",
      });
    prisma.connection.findFirst.mockResolvedValue(null);
    prisma.connection.create.mockResolvedValue({
      id: "conn-1",
      status: ConnectionStatus.PENDING,
    });

    const result = await svc.createRequest("req-1", {
      recipientCountryCode: "+1",
      recipientPhone: "2025559999",
    });

    expect(result.type).toBe("connection");
    expect(twilio.sendConnectionInvite).toHaveBeenCalled();
  });

  it("returns invite for unknown recipient", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(requester)
      .mockResolvedValueOnce(null);
    prisma.connectionInvite.findFirst.mockResolvedValue(null);
    invites.createInvite.mockResolvedValue({
      id: "inv-1",
      recipientKind: "EXTERNAL",
    });

    const result = await svc.createRequest("req-1", {
      recipientCountryCode: "+1",
      recipientPhone: "2025559999",
    });

    expect(result.type).toBe("invite");
    expect(invites.createInvite).toHaveBeenCalled();
  });

  it("throws on duplicate pending connection", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(requester)
      .mockResolvedValueOnce({ id: "recv-1" });
    prisma.connection.findFirst.mockResolvedValue({
      status: ConnectionStatus.PENDING,
    });

    await expect(
      svc.createRequest("req-1", {
        recipientCountryCode: "+1",
        recipientPhone: "2025559999",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
