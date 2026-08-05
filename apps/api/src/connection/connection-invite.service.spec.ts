import { ConfigService } from "@nestjs/config";
import { ConnectionInviteRecipientKind } from "@prisma/client";
import { ConnectionInviteService } from "./connection-invite.service";

describe("ConnectionInviteService", () => {
  const prisma = {
    connectionInvite: { create: jest.fn(), findFirst: jest.fn() },
  };
  const messaging = { sendConnectionInvite: jest.fn() };
  const config = new ConfigService({
    WEB_APP_URL: "https://contactbook.test/",
  });
  const service = new ConnectionInviteService(
    prisma as never,
    messaging as never,
    config,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    messaging.sendConnectionInvite.mockResolvedValue({
      ledgerId: "ledger-1",
      providerMessageId: "wa-1",
      status: "sent",
    });
  });

  it("creates and sends an external signup invitation through the provider", async () => {
    prisma.connectionInvite.create.mockResolvedValue({
      id: "invite-1",
      recipientCountryCode: "+91",
      recipientPhone: "7069567007",
    });

    const result = await service.createInvite({
      requesterId: "requester-1",
      requesterDisplayName: "Neha",
      recipientKind: ConnectionInviteRecipientKind.EXTERNAL,
      recipientCountryCode: "+91",
      recipientPhone: "7069567007",
    });

    expect(messaging.sendConnectionInvite).toHaveBeenCalledWith({
      toE164: "+917069567007",
      requesterDisplayName: "Neha",
      signupUrl: "https://contactbook.test",
      correlationId: "invite-1",
    });
    expect(result.delivery.providerMessageId).toBe("wa-1");
  });
});
