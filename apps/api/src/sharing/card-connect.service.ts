import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { maskPhone } from '../common/logging/redact';
import { ApiError } from '../common/errors/api-error';
import { OtpService, RequestOtpResult } from '../auth/otp.service';
import { ContactsService } from '../contacts/contacts.service';
import { ShareLinksService } from './share-links.service';

function isP2002(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

/**
 * Two ways for an anonymous scanner to connect to a card, both ending in the
 * exact same result — a live, notifiable ShareLink, the scanner's own copy
 * of the card sent over WhatsApp, and never a ContactBook account for doing
 * so (the "no recipient accounts" invariant):
 *
 * 1. **Type your number, verify an OTP** (`requestOtp`/`verifyAndConnect`).
 *    `OtpService.verifyChallenge()` proves phone ownership without
 *    `OtpService.verify()`'s `user.upsert()`.
 * 2. **"Send to my phone" — type your number, no verification at all**
 *    (`connectViaSend`). A deliberate product choice, not an oversight: zero
 *    friction, at the cost of trusting whatever number is typed. Logged
 *    under a DISTINCT source (`SEND_TO_PHONE`, not `QR_SCAN_CONNECT`) for
 *    exactly that reason — this table is also a trust record, and an
 *    unverified connect is a meaningfully weaker claim than a verified one.
 *    ⚠ Known gap: unlike path 1, there is no OtpService.request() in this
 *    path, so none of its rate limiting (5/hour, 60s cooldown per phone)
 *    applies here — nothing currently throttles how fast this endpoint can
 *    be hit with different numbers. The Cloud Tasks outbound queue still
 *    throttles the actual WhatsApp sends (10/s), but not the Contact/
 *    ShareLink/log writes. Worth adding real rate limiting if this sees
 *    real traffic.
 *
 * Both paths reuse the exact same completion machinery —
 * `ContactsService.upsertFromScan()` (source=QR_SCAN) plus
 * `ShareLinksService.ensureActiveLinkAndNotify()` — via the private
 * `connect()` below, so the scanner ends up with a live, notifiable
 * ShareLink exactly like anyone the owner shared with directly, regardless
 * of which path they took.
 */
@Injectable()
export class CardConnectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly otp: OtpService,
    private readonly contacts: ContactsService,
    private readonly shareLinks: ShareLinksService,
  ) {}

  async requestOtp(
    token: string,
    phoneE164: string,
  ): Promise<RequestOtpResult> {
    // Resolve first so we never send an OTP against a dead/unknown token —
    // same 404/410 posture as the public card page itself.
    await this.shareLinks.resolveActiveCard(token);
    return this.otp.request(phoneE164);
  }

  async verifyAndConnect(
    token: string,
    phoneE164: string,
    code: string,
  ): Promise<{ connected: true }> {
    // Proves phone ownership only — never creates or touches a User row.
    await this.otp.verifyChallenge(phoneE164, code);
    return this.connect(token, phoneE164, 'QR_SCAN_CONNECT');
  }

  /**
   * "Send to my phone" — no OTP request, no code to verify. The number
   * typed is trusted as-is. See the class doc comment for the tradeoff and
   * the known rate-limiting gap.
   */
  async connectViaSend(
    token: string,
    phoneE164: string,
  ): Promise<{ connected: true }> {
    return this.connect(token, phoneE164, 'SEND_TO_PHONE');
  }

  private async connect(
    token: string,
    phoneE164: string,
    source: 'QR_SCAN_CONNECT' | 'SEND_TO_PHONE',
  ): Promise<{ connected: true }> {
    const card = await this.shareLinks.resolveActiveCard(token);

    if (phoneE164 === card.user.phoneE164) {
      throw ApiError.conflict(
        'CANNOT_CONNECT_TO_SELF',
        "You can't connect to your own card.",
      );
    }

    const contact = await this.contacts.upsertFromScan(card.userId, phoneE164);
    const ownerName =
      [card.user.firstName, card.user.lastName].filter(Boolean).join(' ') ||
      'Someone';

    // SEND_TO_PHONE forces a fresh notify even on an already-ACTIVE link —
    // see ensureActiveLinkAndNotify's doc comment. QR_SCAN_CONNECT keeps the
    // default no-resend behavior: verifying twice is a safe no-op there, not
    // a repeat of an explicit "send it to me now" action.
    await this.shareLinks.ensureActiveLinkAndNotify(card, contact, ownerName, {
      forceNotify: source === 'SEND_TO_PHONE',
    });

    // Not folded into the ShareLink/outbox transaction above — this log is
    // an observational record, not the outbox-in-transaction guarantee
    // (architecture invariant #3 is specifically about a claimed send
    // really having happened). A rare partial failure here (connection
    // succeeds, log row missing) is an acceptable gap, not a correctness bug.
    try {
      await this.prisma.inboundMessage.create({
        data: {
          source,
          fromPhoneE164: phoneE164,
          toPhoneE164: card.user.phoneE164,
          resolvedOwnerId: card.userId,
        },
      });
      this.logger.info('sharing.qr_scan_connected', {
        source,
        fromPhoneE164: maskPhone(phoneE164),
        resolvedOwnerId: card.userId,
      });
    } catch (err) {
      if (isP2002(err)) {
        // This pair has connected before — "log once" by design, not an
        // error, and not source-specific: the unique constraint is on the
        // (from, to) pair regardless of which path logged it first.
        this.logger.info('sharing.qr_scan_connect_duplicate_ignored', {
          source,
          resolvedOwnerId: card.userId,
        });
      } else {
        throw err;
      }
    }

    return { connected: true };
  }
}
