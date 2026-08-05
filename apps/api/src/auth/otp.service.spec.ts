import { ConflictException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { OtpService } from "./otp.service";
import {
  RECIPIENT_INITIATION_REQUIRED,
  WhatsappProviderError,
} from "../messaging/whatsapp-errors";

describe("OtpService", () => {
  const tx = {
    otpSession: { update: jest.fn() },
    user: { update: jest.fn() },
  };
  const prisma = {
    otpSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const messaging = { sendOtp: jest.fn() };
  const config = { get: jest.fn(() => "919676240186") };
  const service = new OtpService(
    prisma as never,
    messaging as never,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation(() => "919676240186");
    prisma.otpSession.create.mockResolvedValue({ id: "otp-1" });
    prisma.otpSession.update.mockResolvedValue({});
    prisma.otpSession.delete.mockResolvedValue({});
    messaging.sendOtp.mockResolvedValue({
      providerMessageId: "wa-1",
      status: "sent",
    });
  });

  it("stores only a bcrypt hash and sends a six-digit code through the provider", async () => {
    await service.sendPhoneOtp("+12166772305", "user-1");

    const createCall = prisma.otpSession.create.mock.calls[0] as unknown as [
      { data: { codeHash: string } },
    ];
    const data = createCall[0].data;
    expect(data.codeHash).not.toMatch(/^\d{6}$/);
    expect(messaging.sendOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        toE164: "+12166772305",
        code: expect.stringMatching(/^\d{6}$/) as unknown,
        expiresInMinutes: 10,
        correlationId: "otp-1",
      }),
    );
  });

  it("allows repeated OTP requests while delivery is being debugged", async () => {
    await expect(
      service.sendPhoneOtp("+12166772305", null),
    ).resolves.toBeUndefined();
    await expect(
      service.sendPhoneOtp("+12166772305", null),
    ).resolves.toBeUndefined();
    expect(messaging.sendOtp).toHaveBeenCalledTimes(2);
  });

  it("does not send WhatsApp OTPs when dummy login is enabled", async () => {
    config.get.mockImplementation((key: string) =>
      key === "DUMMY_OTP_LOGIN_ENABLED" ? "true" : "919676240186",
    );

    await service.sendPhoneOtp("+12166772305", "user-1");

    expect(prisma.otpSession.create).toHaveBeenCalled();
    expect(messaging.sendOtp).not.toHaveBeenCalled();
  });

  it("accepts any six-digit OTP when dummy login is enabled", async () => {
    config.get.mockImplementation((key: string) =>
      key === "DUMMY_OTP_LOGIN_ENABLED" ? "true" : "919676240186",
    );
    prisma.otpSession.findFirst.mockResolvedValue({
      id: "otp-1",
      userId: "user-1",
      codeHash: await bcrypt.hash("123456", 4),
      attemptCount: 0,
    });

    await expect(
      service.verifyPhoneOtp("+12166772305", "654321"),
    ).resolves.toBe("user-1");
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: true },
    });
  });

  it("rejects non-six-digit OTPs when dummy login is enabled", async () => {
    config.get.mockImplementation((key: string) =>
      key === "DUMMY_OTP_LOGIN_ENABLED" ? "true" : "919676240186",
    );
    prisma.otpSession.findFirst.mockResolvedValue({
      id: "otp-1",
      userId: "user-1",
      codeHash: await bcrypt.hash("123456", 4),
      attemptCount: 0,
    });

    await expect(
      service.verifyPhoneOtp("+12166772305", "12345"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns a structured initiation response when OpenWA reports 463", async () => {
    messaging.sendOtp.mockRejectedValue(
      new WhatsappProviderError(RECIPIENT_INITIATION_REQUIRED, "initiate", {
        providerMessageId: "wa-463",
        providerErrorCode: "463",
      }),
    );

    await expect(service.sendPhoneOtp("+12166772305", null)).rejects.toEqual(
      expect.objectContaining<Partial<ConflictException>>({
        response: expect.objectContaining({
          code: RECIPIENT_INITIATION_REQUIRED,
          senderPhone: "+919676240186",
          initiationUrl: "https://wa.me/919676240186?text=START",
        }) as unknown,
      }),
    );
    expect(prisma.otpSession.delete).toHaveBeenCalledWith({
      where: { id: "otp-1" },
    });
  });

  it("verifies the local hash, consumes the OTP, and activates an existing user", async () => {
    const codeHash = await bcrypt.hash("123456", 4);
    prisma.otpSession.findFirst.mockResolvedValue({
      id: "otp-1",
      userId: "user-1",
      codeHash,
      attemptCount: 0,
    });

    await expect(
      service.verifyPhoneOtp("+12166772305", "123456"),
    ).resolves.toBe("user-1");
    expect(tx.otpSession.update).toHaveBeenCalledWith({
      where: { id: "otp-1" },
      data: { consumedAt: expect.any(Date) as unknown },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: true },
    });
  });

  it("increments failed verification attempts", async () => {
    prisma.otpSession.findFirst.mockResolvedValue({
      id: "otp-1",
      userId: null,
      codeHash: await bcrypt.hash("123456", 4),
      attemptCount: 2,
    });

    await expect(
      service.verifyPhoneOtp("+12166772305", "000000"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.otpSession.update).toHaveBeenCalledWith({
      where: { id: "otp-1" },
      data: { attemptCount: 3 },
    });
  });

  it("consumes the OTP on the fifth failed verification", async () => {
    prisma.otpSession.findFirst.mockResolvedValue({
      id: "otp-1",
      userId: null,
      codeHash: await bcrypt.hash("123456", 4),
      attemptCount: 4,
    });

    await expect(
      service.verifyPhoneOtp("+12166772305", "000000"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.otpSession.update).toHaveBeenCalledWith({
      where: { id: "otp-1" },
      data: { attemptCount: 5, consumedAt: expect.any(Date) as unknown },
    });
  });
});
