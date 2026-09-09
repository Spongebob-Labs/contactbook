import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { TaskEnqueuer } from '../outbox/task-enqueuer';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';

const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_REQUESTS_PER_HOUR = 5;
const BCRYPT_ROUNDS = 10;

function generateCode(): string {
  // crypto.randomInt, not Math.random — this gates account access.
  return randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, '0');
}

export interface RequestOtpResult {
  /** Only ever set outside production when Twilio isn't configured, so the
   *  whole login flow is testable before real credentials exist. Never logged. */
  devCode?: string;
}

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly enqueuer: TaskEnqueuer,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  async request(phoneE164: string): Promise<RequestOtpResult> {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.otpChallenge.findMany({
      where: { phoneE164, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { createdAt: true },
    });

    const countThisHour = await this.prisma.otpChallenge.count({
      where: { phoneE164, createdAt: { gte: since } },
    });

    if (countThisHour >= MAX_REQUESTS_PER_HOUR) {
      throw ApiError.conflict(
        'OTP_RATE_LIMITED',
        'Too many codes requested. Try again later.',
      );
    }

    const lastRequestAt = recent[0]?.createdAt;
    if (lastRequestAt) {
      const secondsSince = (Date.now() - lastRequestAt.getTime()) / 1000;
      if (secondsSince < RESEND_COOLDOWN_SECONDS) {
        throw ApiError.conflict(
          'OTP_COOLDOWN',
          'Please wait before requesting another code.',
          {
            retryAfterSeconds: Math.ceil(
              RESEND_COOLDOWN_SECONDS - secondsSince,
            ),
          },
        );
      }
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    const shouldUseDevFallback =
      !this.config.isProduction && !this.hasTwilioConfigured();

    const outboxId = await this.prisma.$transaction(async (tx) => {
      const challenge = await tx.otpChallenge.create({
        data: { phoneE164, codeHash, expiresAt },
      });

      if (shouldUseDevFallback) {
        // Nothing to enqueue: dev fallback returns the code directly instead
        // of sending it. Never do this when Twilio IS configured, even in dev
        // — that would silently mask a real send failure.
        return null;
      }

      const outboxRow = await this.outbox.enqueue(tx, {
        dedupeKey: `otp:${challenge.id}`,
        kind: 'send_whatsapp_otp',
        payload: { challengeId: challenge.id, phoneE164, code },
      });
      return outboxRow.id;
    });

    if (outboxId) {
      this.enqueuer.enqueue(outboxId, 'priority');
      // Logged under the exact key `phoneE164` — the logger's redact() masks
      // any key matching its PHONE_KEYS set automatically. No need to mask here.
      this.logger.info('otp.requested', { phoneE164 });
    } else {
      this.logger.info('otp.requested_dev_fallback', { phoneE164 });
    }

    return shouldUseDevFallback ? { devCode: code } : {};
  }

  /**
   * Validates a code and consumes the challenge — full stop. Deliberately
   * does NOT touch `User`: this is the primitive a flow needs when it wants
   * "prove you control this phone number" without that proof also being a
   * login (see sharing/card-connect.service.ts — a QR-scan verifier must
   * never gain a ContactBook account just by connecting to someone's card).
   * `verify()` below is `verifyChallenge()` plus the login-specific
   * user.upsert(), kept as its own method so AuthController's flow is
   * unchanged.
   */
  async verifyChallenge(phoneE164: string, code: string): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phoneE164, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw ApiError.notFound(
        'OTP_NOT_FOUND',
        'No active code for this number. Request a new one.',
      );
    }

    if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw ApiError.conflict(
        'OTP_ATTEMPTS_EXCEEDED',
        'Too many incorrect attempts. Request a new code.',
      );
    }

    const matches = await bcrypt.compare(code, challenge.codeHash);

    if (!matches) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw ApiError.conflict('OTP_INVALID', 'That code is incorrect.');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }

  async verify(phoneE164: string, code: string): Promise<{ userId: string }> {
    await this.verifyChallenge(phoneE164, code);

    const user = await this.prisma.user.upsert({
      where: { phoneE164 },
      create: { phoneE164 },
      update: {},
    });

    this.logger.info('otp.verified', { userId: user.id });
    return { userId: user.id };
  }

  private hasTwilioConfigured(): boolean {
    const t = this.config.twilio;
    return Boolean(t.accountSid && t.authToken && t.whatsappFrom);
  }
}
