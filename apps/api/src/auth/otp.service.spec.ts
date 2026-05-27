import { UnauthorizedException } from "@nestjs/common";
import { OtpService } from "./otp.service";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "../integration/twilio.service";
import * as bcrypt from "bcrypt";

interface MockTx {
  otpSession: { update: jest.Mock };
  user: { update: jest.Mock };
}

const makePrisma = (mockTx: MockTx) => ({
  otpSession: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest
    .fn()
    .mockImplementation((cb: (tx: MockTx) => Promise<unknown>) => cb(mockTx)),
});

const makeTwilio = () => ({
  isVerifyConfigured: jest.fn(),
  isClientConfigured: jest.fn(),
  sendVerificationOtp: jest.fn(),
  verifyVerificationOtp: jest.fn(),
  sendWhatsApp: jest.fn(),
});

describe("OtpService", () => {
  let prisma: {
    otpSession: {
      create: jest.Mock;
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mockTx: MockTx;
  let twilio: {
    isVerifyConfigured: jest.Mock;
    isClientConfigured: jest.Mock;
    sendVerificationOtp: jest.Mock;
    verifyVerificationOtp: jest.Mock;
    sendWhatsApp: jest.Mock;
  };
  let service: OtpService;

  beforeEach(() => {
    mockTx = {
      otpSession: { update: jest.fn() },
      user: { update: jest.fn() },
    };
    prisma = makePrisma(mockTx);
    twilio = makeTwilio();
    service = new OtpService(
      prisma as unknown as PrismaService,
      twilio as unknown as TwilioService,
    );
  });

  describe("sendPhoneOtp", () => {
    it("should use Twilio Verify when it is configured", async () => {
      twilio.isVerifyConfigured.mockReturnValue(true);
      prisma.otpSession.create.mockResolvedValue({});

      await service.sendPhoneOtp("+12166772305", "user-id-123");

      expect(prisma.otpSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-id-123",
          phoneE164: "+12166772305",
          codeHash: "twilio-verify",
        }) as unknown,
      });
      expect(twilio.sendVerificationOtp).toHaveBeenCalledWith("+12166772305");
      expect(twilio.sendWhatsApp).not.toHaveBeenCalled();
    });

    it("should generate a local OTP when Twilio Verify is not configured", async () => {
      twilio.isVerifyConfigured.mockReturnValue(false);
      prisma.otpSession.create.mockResolvedValue({});

      await service.sendPhoneOtp("+12166772305", "user-id-123");

      expect(prisma.otpSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-id-123",
          phoneE164: "+12166772305",
          codeHash: expect.not.stringContaining("twilio-verify") as unknown,
        }) as unknown,
      });
      expect(twilio.sendWhatsApp).toHaveBeenCalledWith(
        "+12166772305",
        expect.stringContaining(
          "Your ContactBook verification code is",
        ) as unknown,
      );
      expect(twilio.sendVerificationOtp).not.toHaveBeenCalled();
    });
  });

  describe("verifyPhoneOtp", () => {
    const session = {
      id: "session-id-123",
      userId: "user-id-123",
      phoneE164: "+12166772305",
      codeHash: "hashed-code",
    };

    it("should throw UnauthorizedException if no active session is found", async () => {
      prisma.otpSession.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyPhoneOtp("+12166772305", "123456"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should verify via Twilio Verify when configured", async () => {
      prisma.otpSession.findFirst.mockResolvedValue(session);
      twilio.isVerifyConfigured.mockReturnValue(true);
      twilio.verifyVerificationOtp.mockResolvedValue(true);

      const userId = await service.verifyPhoneOtp("+12166772305", "123456");

      expect(twilio.verifyVerificationOtp).toHaveBeenCalledWith(
        "+12166772305",
        "123456",
      );
      expect(userId).toBe("user-id-123");
      expect(mockTx.otpSession.update).toHaveBeenCalledWith({
        where: { id: session.id },
        data: { consumedAt: expect.any(Date) as unknown },
      });
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: "user-id-123" },
        data: { isActive: true },
      });
    });

    it("should throw UnauthorizedException if Twilio Verify returns false", async () => {
      prisma.otpSession.findFirst.mockResolvedValue(session);
      twilio.isVerifyConfigured.mockReturnValue(true);
      twilio.verifyVerificationOtp.mockResolvedValue(false);

      await expect(
        service.verifyPhoneOtp("+12166772305", "123456"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should verify via local bcrypt when Twilio Verify is unset but Twilio is configured", async () => {
      const code = "123456";
      const codeHash = await bcrypt.hash(code, 10);
      const customSession = { ...session, codeHash };

      prisma.otpSession.findFirst.mockResolvedValue(customSession);
      twilio.isVerifyConfigured.mockReturnValue(false);
      twilio.isClientConfigured.mockReturnValue(true);

      const userId = await service.verifyPhoneOtp("+12166772305", code);

      expect(userId).toBe("user-id-123");
      expect(mockTx.otpSession.update).toHaveBeenCalledWith({
        where: { id: session.id },
        data: { consumedAt: expect.any(Date) as unknown },
      });
    });

    it("should bypass verification check when Twilio is entirely unset (dry-run)", async () => {
      prisma.otpSession.findFirst.mockResolvedValue(session);
      twilio.isVerifyConfigured.mockReturnValue(false);
      twilio.isClientConfigured.mockReturnValue(false);

      const userId = await service.verifyPhoneOtp("+12166772305", "wrong-code");

      expect(userId).toBe("user-id-123");
      expect(mockTx.otpSession.update).toHaveBeenCalledWith({
        where: { id: session.id },
        data: { consumedAt: expect.any(Date) as unknown },
      });
    });
  });
});
