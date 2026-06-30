import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappMessagingService } from "../messaging/whatsapp-messaging.service";
import {
  RECIPIENT_INITIATION_REQUIRED,
  WhatsappProviderError,
} from "../messaging/whatsapp-errors";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUESTS_PER_HOUR = 5;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: WhatsappMessagingService,
    private readonly config: ConfigService,
  ) {}

  async sendPhoneOtp(phoneE164: string, userId: string | null): Promise<void> {
    await this.assertRequestAllowed(phoneE164);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = await bcrypt.hash(code, 10);
    const session = await this.prisma.otpSession.create({
      data: {
        userId,
        phoneE164,
        codeHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    try {
      await this.messaging.sendOtp({
        toE164: phoneE164,
        code,
        expiresInMinutes: OTP_TTL_MS / 60_000,
        correlationId: session.id,
      });
    } catch (error) {
      await this.prisma.otpSession.delete({ where: { id: session.id } });
      if (
        error instanceof WhatsappProviderError &&
        error.code === RECIPIENT_INITIATION_REQUIRED
      ) {
        const senderPhone = normalizeSender(
          this.config.get<string>("OPENWA_SENDER_PHONE") ?? "919676240186",
        );
        throw new ConflictException({
          code: RECIPIENT_INITIATION_REQUIRED,
          message:
            "Message the ContactBook WhatsApp number with START, then request a new verification code.",
          senderPhone,
          initiationUrl: `https://wa.me/${senderPhone.slice(1)}?text=START`,
        });
      }
      throw error;
    }
  }

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
    if (!session || session.attemptCount >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException("Invalid or expired code");
    }
    const valid = await bcrypt.compare(code, session.codeHash);
    if (!valid) {
      const attemptCount = session.attemptCount + 1;
      await this.prisma.otpSession.update({
        where: { id: session.id },
        data: {
          attemptCount,
          ...(attemptCount >= OTP_MAX_ATTEMPTS
            ? { consumedAt: new Date() }
            : {}),
        },
      });
      throw new UnauthorizedException("Invalid or expired code");
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

  private async assertRequestAllowed(phoneE164: string): Promise<void> {
    const now = Date.now();
    const recent = await this.prisma.otpSession.count({
      where: { phoneE164, createdAt: { gte: new Date(now - 60_000) } },
    });
    if (recent > 0) throw rateLimitException();
    const hourly = await this.prisma.otpSession.count({
      where: { phoneE164, createdAt: { gte: new Date(now - 60 * 60_000) } },
    });
    if (hourly >= OTP_REQUESTS_PER_HOUR) throw rateLimitException();
  }
}

function rateLimitException(): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: "Too many verification code requests",
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

function normalizeSender(value: string): string {
  const digits = value.replace(/\D/g, "");
  return `+${digits}`;
}
