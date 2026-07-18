import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { OTP_RESEND_COOLDOWN_MS, TwilioOtpService } from "./twilio-otp.service";
import { TwilioSendError } from "./twilio-otp.client";

describe("TwilioOtpService", () => {
  const tx = {
    otpSession: { updateMany: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    otpSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const client = { sendOtpTemplate: jest.fn() };
  const service = new TwilioOtpService(prisma as never, client as never);

  const PHONE = "+12166772305";

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.otpSession.findFirst.mockResolvedValue(null);
    prisma.otpSession.update.mockResolvedValue({});
    prisma.otpSession.delete.mockResolvedValue({});
    tx.otpSession.updateMany.mockResolvedValue({ count: 0 });
    tx.otpSession.create.mockResolvedValue({ id: "otp-1" });
    client.sendOtpTemplate.mockResolvedValue({ sid: "SM1", status: "queued" });
  });

  describe("sendOtp", () => {
    it("stores a bcrypt hash (never plaintext), consumes prior codes, and sends the template", async () => {
      const result = await service.sendOtp(PHONE);

      const createArg = tx.otpSession.create.mock.calls[0] as unknown as [
        { data: { codeHash: string; expiresAt: Date; phoneE164: string } },
      ];
      const data = createArg[0].data;
      expect(data.phoneE164).toBe(PHONE);
      expect(data.codeHash).not.toMatch(/^\d{6}$/); // hashed, not the raw code
      // 5-minute expiry
      expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(4 * 60_000);
      expect(data.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
        5 * 60_000,
      );
      // prior active codes invalidated in the same transaction
      expect(tx.otpSession.updateMany).toHaveBeenCalledWith({
        where: { phoneE164: PHONE, consumedAt: null },
        data: { consumedAt: expect.any(Date) as unknown },
      });
      // code sent to Twilio is a fresh 6-digit string
      expect(client.sendOtpTemplate).toHaveBeenCalledWith(
        PHONE,
        expect.stringMatching(/^\d{6}$/) as unknown,
      );
      expect(result).toEqual({ expiresInSeconds: 300, resendAfterSeconds: 60 });
    });

    it("enforces the resend cooldown with a 429 and does not call Twilio", async () => {
      prisma.otpSession.findFirst.mockResolvedValue({ createdAt: new Date() });

      await expect(service.sendOtp(PHONE)).rejects.toMatchObject({
        // HttpException with TOO_MANY_REQUESTS status
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
      expect(client.sendOtpTemplate).not.toHaveBeenCalled();
    });

    it("allows a new code once the cooldown has elapsed", async () => {
      prisma.otpSession.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1),
      });

      await expect(service.sendOtp(PHONE)).resolves.toEqual({
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      });
      expect(client.sendOtpTemplate).toHaveBeenCalledTimes(1);
    });

    it("rolls back the stored code and surfaces the mapped status when delivery fails", async () => {
      client.sendOtpTemplate.mockRejectedValue(
        new TwilioSendError("bad number", 400, 21211),
      );

      await expect(service.sendOtp(PHONE)).rejects.toMatchObject({
        status: 400,
      });
      expect(prisma.otpSession.delete).toHaveBeenCalledWith({
        where: { id: "otp-1" },
      });
    });

    it("wraps unknown delivery errors as 502", async () => {
      client.sendOtpTemplate.mockRejectedValue(new Error("boom"));

      await expect(service.sendOtp(PHONE)).rejects.toMatchObject({
        status: HttpStatus.BAD_GATEWAY,
      });
      expect(prisma.otpSession.delete).toHaveBeenCalled();
    });
  });

  describe("verifyOtp", () => {
    it("consumes the code on a correct guess", async () => {
      prisma.otpSession.findFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: await bcrypt.hash("123456", 4),
        attemptCount: 0,
      });

      await expect(service.verifyOtp(PHONE, "123456")).resolves.toBeUndefined();
      expect(prisma.otpSession.update).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: { consumedAt: expect.any(Date) as unknown },
      });
    });

    it("rejects and increments the attempt counter on a wrong guess", async () => {
      prisma.otpSession.findFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: await bcrypt.hash("123456", 4),
        attemptCount: 2,
      });

      await expect(service.verifyOtp(PHONE, "000000")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.otpSession.update).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: { attemptCount: 3 },
      });
    });

    it("burns the code on the fifth failed attempt", async () => {
      prisma.otpSession.findFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: await bcrypt.hash("123456", 4),
        attemptCount: 4,
      });

      await expect(service.verifyOtp(PHONE, "000000")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.otpSession.update).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: { attemptCount: 5, consumedAt: expect.any(Date) as unknown },
      });
    });

    it("rejects when there is no active (unexpired, unconsumed) code", async () => {
      prisma.otpSession.findFirst.mockResolvedValue(null);

      await expect(service.verifyOtp(PHONE, "123456")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.otpSession.update).not.toHaveBeenCalled();
    });

    it("rejects a locked code (attempts already exhausted) without a bcrypt compare", async () => {
      prisma.otpSession.findFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: await bcrypt.hash("123456", 4),
        attemptCount: 5,
      });

      await expect(service.verifyOtp(PHONE, "123456")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.otpSession.update).not.toHaveBeenCalled();
    });
  });

  it("keeps HttpException identity so the exception filter maps 429/4xx correctly", async () => {
    prisma.otpSession.findFirst.mockResolvedValue({ createdAt: new Date() });
    await expect(service.sendOtp(PHONE)).rejects.toBeInstanceOf(HttpException);
  });
});
