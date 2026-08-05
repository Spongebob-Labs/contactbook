import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioOtpClient, TwilioSendError } from "./twilio-otp.client";

/** OTP lifetime — codes expire 5 minutes after they are issued. */
export const OTP_TTL_MS = 5 * 60 * 1000;
/** Minimum wait between two send requests for the same number (anti-spam). */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
/** Wrong-code guesses allowed before the active code is burned. */
export const OTP_MAX_ATTEMPTS = 5;
/** Number of decimal digits in a code. */
const OTP_DIGITS = 6;
const BCRYPT_ROUNDS = 10;

export interface SendOtpResult {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

@Injectable()
export class TwilioOtpService {
  private readonly logger = new Logger(TwilioOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: TwilioOtpClient,
  ) {}

  /**
   * Issues a fresh OTP for `phoneE164`, invalidating any prior active code, and
   * delivers it over WhatsApp. Enforces a per-number resend cooldown.
   *
   * @throws HttpException(429) when called again within the cooldown window.
   * @throws HttpException(4xx/5xx) mapped from Twilio when delivery fails.
   */
  async sendOtp(phoneE164: string): Promise<SendOtpResult> {
    await this.enforceResendCooldown(phoneE164);

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Single active code per number: consume any outstanding ones atomically,
    // then create the new session in the same transaction.
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.otpSession.updateMany({
        where: { phoneE164, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return tx.otpSession.create({
        data: { phoneE164, codeHash, expiresAt },
      });
    });

    try {
      const result = await this.client.sendOtpTemplate(phoneE164, code);
      this.logger.log(
        `OTP dispatched session=${session.id} sid=${result.sid} status=${result.status}`,
      );
    } catch (error) {
      // Delivery failed — do not leave a live code the user never received.
      await this.prisma.otpSession
        .delete({ where: { id: session.id } })
        .catch(() => undefined);
      throw toHttpException(error);
    }

    return {
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      resendAfterSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    };
  }

  /**
   * Verifies `code` against the latest active OTP for `phoneE164`.
   * Consumes the code on success (single use). Wrong guesses increment the
   * attempt counter and burn the code once the limit is reached.
   *
   * @throws UnauthorizedException when the code is missing, expired, locked, or wrong.
   */
  async verifyOtp(phoneE164: string, code: string): Promise<void> {
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

    await this.prisma.otpSession.update({
      where: { id: session.id },
      data: { consumedAt: new Date() },
    });
  }

  private async enforceResendCooldown(phoneE164: string): Promise<void> {
    const last = await this.prisma.otpSession.findFirst({
      where: { phoneE164 },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!last) {
      return;
    }
    const elapsedMs = Date.now() - last.createdAt.getTime();
    if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Please wait ${retryAfterSeconds}s before requesting another code.`,
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

/** Cryptographically-random, zero-padded numeric OTP. */
function generateOtpCode(): string {
  const max = 10 ** OTP_DIGITS;
  return String(randomInt(0, max)).padStart(OTP_DIGITS, "0");
}

/** Converts a Twilio transport error into the HTTP error we return to callers. */
function toHttpException(error: unknown): HttpException {
  if (error instanceof TwilioSendError) {
    return new HttpException(
      {
        statusCode: error.httpStatus,
        message: error.message,
        ...(error.twilioCode !== null ? { twilioCode: error.twilioCode } : {}),
      },
      error.httpStatus,
    );
  }
  if (error instanceof HttpException) {
    return error;
  }
  return new HttpException(
    {
      statusCode: HttpStatus.BAD_GATEWAY,
      message:
        "Could not send the verification code. Please try again shortly.",
    },
    HttpStatus.BAD_GATEWAY,
  );
}
