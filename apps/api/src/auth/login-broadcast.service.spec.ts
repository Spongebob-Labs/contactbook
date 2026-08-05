import { WhatsappMessagePurpose } from "@prisma/client";
import { LoginBroadcastService } from "./login-broadcast.service";

describe("LoginBroadcastService", () => {
  const prisma = {
    user: { findUnique: jest.fn() },
  };
  const messaging = { sendText: jest.fn() };
  const config = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      firstName: "Asha",
      lastName: "Khan",
      countryCode: "+91",
      phone: "9876543210",
      email: "asha@example.com",
    });
    messaging.sendText.mockResolvedValue({ status: "sent" });
    config.get.mockImplementation((key: string, fallback?: string) =>
      key === "LOGIN_BROADCAST_ENABLED" ? "true" : fallback,
    );
  });

  it("sends the contact-card template only to the configured POC recipients", async () => {
    const service = new LoginBroadcastService(
      prisma as never,
      messaging as never,
      config as never,
    );

    await service.sendForUser("user-1");

    const text =
      "Asha Khan is on ContactBook. You get started by visiting https://www.getcontactbook.com and creating your account.\n\n" +
      "Here is Asha Khan's Contact card.\n\n" +
      "Name: Asha Khan\n" +
      "Phone no: +919876543210\n" +
      "Email: asha@example.com";
    expect(messaging.sendText).toHaveBeenCalledTimes(3);
    expect(messaging.sendText).toHaveBeenNthCalledWith(1, {
      toE164: "+919587746347",
      text,
      purpose: WhatsappMessagePurpose.LOGIN_BROADCAST,
      correlationId: expect.any(String) as unknown,
    });
    expect(messaging.sendText).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ toE164: "+31627452799", text }),
    );
    expect(messaging.sendText).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ toE164: "+919347243575", text }),
    );
  });

  it("does nothing unless the POC feature is explicitly enabled", async () => {
    config.get.mockImplementation((key: string, fallback?: string) =>
      key === "LOGIN_BROADCAST_ENABLED" ? "false" : fallback,
    );
    const service = new LoginBroadcastService(
      prisma as never,
      messaging as never,
      config as never,
    );

    await service.sendForUser("user-1");

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(messaging.sendText).not.toHaveBeenCalled();
  });

  it("does not fail login when one recipient cannot be reached", async () => {
    messaging.sendText
      .mockRejectedValueOnce(new Error("delivery failed"))
      .mockResolvedValue({ status: "sent" });
    const service = new LoginBroadcastService(
      prisma as never,
      messaging as never,
      config as never,
    );

    await expect(service.sendForUser("user-1")).resolves.toBeUndefined();
    expect(messaging.sendText).toHaveBeenCalledTimes(3);
  });
});
