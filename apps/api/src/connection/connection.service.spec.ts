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
  const messaging = { sendConnectionInvite: jest.fn() };
  const invites = { createInvite: jest.fn(), resendInvite: jest.fn() };

  const svc = new ConnectionService(
    prisma as never,
    messaging as never,
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
    messaging.sendConnectionInvite.mockResolvedValue({
      ledgerId: "ledger-1",
      providerMessageId: "wa-1",
      status: "sent",
    });
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
    expect(messaging.sendConnectionInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        toE164: "+12025559999",
        connectionId: "conn-1",
        correlationId: "conn-1",
      }),
    );
    expect(result).toMatchObject({ delivery: { providerMessageId: "wa-1" } });
  });

  it("returns invite for unknown recipient", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(requester)
      .mockResolvedValueOnce(null);
    prisma.connectionInvite.findFirst.mockResolvedValue(null);
    invites.createInvite.mockResolvedValue({
      invite: { id: "inv-1", recipientKind: "EXTERNAL" },
      delivery: {
        ledgerId: "ledger-2",
        providerMessageId: "wa-2",
        status: "sent",
      },
    });

    const result = await svc.createRequest("req-1", {
      recipientCountryCode: "+1",
      recipientPhone: "2025559999",
    });

    expect(result.type).toBe("invite");
    expect(invites.createInvite).toHaveBeenCalled();
    expect(result).toMatchObject({ delivery: { providerMessageId: "wa-2" } });
  });

  it("resends a pending registered connection owned by the requester", async () => {
    prisma.connection.findFirst.mockResolvedValue({
      id: "conn-1",
      status: ConnectionStatus.PENDING,
      requester: { firstName: "A", lastName: "B", email: "a@example.com" },
      receiver: { countryCode: "+1", phone: "2025559999" },
    });

    await svc.resendRequest("req-1", "conn-1");

    expect(messaging.sendConnectionInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: "conn-1",
        toE164: "+12025559999",
      }),
    );
  });

  it("delegates pending signup invite resend with requester authorization", async () => {
    prisma.connection.findFirst.mockResolvedValue(null);
    invites.resendInvite.mockResolvedValue({ providerMessageId: "wa-3" });

    await svc.resendRequest("req-1", "invite-1");

    expect(invites.resendInvite).toHaveBeenCalledWith("req-1", "invite-1");
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
