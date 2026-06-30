import { WhatsappMessagePurpose } from "@prisma/client";
import { SyncService } from "./sync.service";

describe("SyncService", () => {
  const prisma = {
    cardFieldMapping: { findMany: jest.fn() },
    connection: { findMany: jest.fn() },
  };
  const messaging = { sendText: jest.fn() };
  const service = new SyncService(prisma as never, messaging as never);

  beforeEach(() => jest.clearAllMocks());

  it("notifies the peer when a shared contact card changes", async () => {
    prisma.connection.findMany.mockResolvedValue([
      {
        id: "connection-1",
        requesterSharedCardId: "card-1",
        receiverSharedCardId: null,
        requester: {
          firstName: "Neha",
          lastName: "Shah",
          countryCode: "+91",
          phone: "9676240186",
        },
        receiver: { countryCode: "+91", phone: "7069567007" },
      },
    ]);
    messaging.sendText.mockResolvedValue({ status: "sent" });

    await service.notifyCardSubscribers("card-1");

    expect(messaging.sendText).toHaveBeenCalledWith({
      toE164: "+917069567007",
      text: "ContactBook: Neha Shah updated a shared contact card.",
      purpose: WhatsappMessagePurpose.CONNECTION_UPDATE,
      correlationId: "connection-1",
    });
  });

  it("does not roll back a profile update when notification delivery fails", async () => {
    prisma.connection.findMany.mockResolvedValue([
      {
        id: "connection-1",
        requesterSharedCardId: "card-1",
        receiverSharedCardId: null,
        requester: {
          firstName: "Neha",
          lastName: "",
          countryCode: "+91",
          phone: "9676240186",
        },
        receiver: { countryCode: "+91", phone: "7069567007" },
      },
    ]);
    messaging.sendText.mockRejectedValue(new Error("OpenWA unavailable"));

    await expect(
      service.notifyCardSubscribers("card-1"),
    ).resolves.toBeUndefined();
  });
});
