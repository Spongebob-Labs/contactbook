import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "../integration/twilio.service";

const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
  ) {}

  async sendPhoneOtp(userId: string, phoneE164: string): Promise<void> {
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

  async verifyPhoneOtp(
    userId: string,
    phoneE164: string,
    code: string,
  ): Promise<void> {
    const session = await this.prisma.otpSession.findFirst({
      where: {
        userId,
        phoneE164,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!session) {
      throw new UnauthorizedException("Invalid or expired code");
    }
    const ok = await bcrypt.compare(code, session.codeHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid or expired code");
    }
    await this.prisma.$transaction([
      this.prisma.otpSession.update({
        where: { id: session.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { phone: phoneE164, phoneVerifiedAt: new Date() },
      }),
    ]);
  }
}
