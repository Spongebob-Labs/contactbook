import { AuthService } from "./auth.service";

describe("AuthService login broadcast", () => {
  it("broadcasts after an existing user verifies their OTP", async () => {
    const user = {
      id: "user-1",
      email: "asha@example.com",
      phone: "9876543210",
      countryCode: "+91",
      firstName: "Asha",
      lastName: "Khan",
      isActive: true,
      profileOnboardingCompletedAt: new Date(),
    };
    const tx = { refreshToken: { create: jest.fn() } };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        findUniqueOrThrow: jest.fn().mockResolvedValue(user),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const jwt = { sign: jest.fn().mockReturnValue("access-token") };
    const otp = { verifyPhoneOtp: jest.fn().mockResolvedValue("user-1") };
    const config = {
      get: jest.fn((_key: string, fallback?: string) => fallback),
    };
    const loginBroadcast = {
      sendForUser: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuthService(
      prisma as never,
      jwt as never,
      otp as never,
      config as never,
      loginBroadcast as never,
    );

    await service.verifyWhatsappCode("9876543210", "+91", "123456");

    expect(loginBroadcast.sendForUser).toHaveBeenCalledWith("user-1");
  });
});
