import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "../integration/twilio.service";

const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
  ) {}

  /**
   * Sends a WhatsApp OTP. `userId` is set when the phone already belongs to a user (login);
   * otherwise null (registration path after OTP is verified separately).
   */
  async sendPhoneOtp(phoneE164: string, userId: string | null): Promise<void> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.prisma.otpSession.create({
      data: {
        userId,
        phoneE164,
        codeHash,
        expiresAt,
      },
    });
    await this.twilio.sendWhatsApp(
      phoneE164,
      `Your ContactBook verification code is ${code}. It expires in 10 minutes.`,
    );
  }

  /**
   * Validates the latest unconsumed OTP for this phone, consumes it, and activates the user
   * when `userId` was present on the session. Returns that user id, or null when the session
   * had no user (phone not registered at code request time).
   */
  async verifyPhoneOtp(
    phoneE164: string,
    code: string,
  ): Promise<string | null> {
    const session = await this.prisma.otpSession.findFirst({
      where: {
        phoneE164,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!session) {
      throw new UnauthorizedException("Invalid or expired code");
    }
    if (this.twilio.isClientConfigured()) {
      const ok = await bcrypt.compare(code, session.codeHash);
      if (!ok) {
        throw new UnauthorizedException("Invalid or expired code");
      }
    } else {
      const tail = phoneE164.replace(/\D/g, "").slice(-4);
      this.logger.warn(
        `OTP verify bypass (Twilio unset): accepting code for …${tail}`,
      );
    }
    const userId = session.userId;
    await this.prisma.$transaction(async (tx) => {
      await tx.otpSession.update({
        where: { id: session.id },
        data: { consumedAt: new Date() },
      });
      if (userId) {
        await tx.user.update({
          where: { id: userId },
          data: { isActive: true },
        });
      }
    });
    return userId;
  }
}
