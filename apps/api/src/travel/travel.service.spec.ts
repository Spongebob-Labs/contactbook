import { WhatsappMessagePurpose } from "@prisma/client";
import { TravelService } from "./travel.service";

describe("TravelService", () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    travelNotificationContact: { findMany: jest.fn() },
  };
  const messaging = { sendText: jest.fn() };
  const service = new TravelService(prisma as never, messaging as never);

  it("sends travel notifications through the provider", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.travelNotificationContact.findMany.mockResolvedValue([
      { contact: { phones: [{ value: "+917069567007", isPrimary: true }] } },
    ]);
    messaging.sendText.mockResolvedValue({ status: "sent" });

    await expect(
      service.dispatchTravelNotifications("user-1", "I am traveling"),
    ).resolves.toEqual({ sent: 1 });
    expect(messaging.sendText).toHaveBeenCalledWith({
      toE164: "+917069567007",
      text: "I am traveling",
      purpose: WhatsappMessagePurpose.TRAVEL_NOTIFICATION,
      correlationId: "user-1",
    });
  });
});
