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
 * The QR-scan "Save & connect" flow: a stranger scans a card's QR, types
 * their own phone number, verifies it over WhatsApp OTP — and, unlike the
 * login flow, never gets a ContactBook account for doing so. This is the
 * "no recipient accounts" invariant in practice: OtpService.verifyChallenge()
 * proves phone ownership without OtpService.verify()'s user.upsert().
 *
 * A successful connect reuses the exact same machinery an owner-initiated
 * share does — ContactsService.upsertFromScan() (source=QR_SCAN) plus
 * ShareLinksService.ensureActiveLinkAndNotify() — so the scanner ends up
 * with a live, notifiable ShareLink exactly like anyone the owner shared
 * with directly, including the "here's your card" WhatsApp message.
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

    await this.shareLinks.ensureActiveLinkAndNotify(card, contact, ownerName);

    // Not folded into the ShareLink/outbox transaction above — this log is
    // an observational record, not the outbox-in-transaction guarantee
    // (architecture invariant #3 is specifically about a claimed send
    // really having happened). A rare partial failure here (connection
    // succeeds, log row missing) is an acceptable gap, not a correctness bug.
    try {
      await this.prisma.inboundMessage.create({
        data: {
          source: 'QR_SCAN_CONNECT',
          fromPhoneE164: phoneE164,
          toPhoneE164: card.user.phoneE164,
          resolvedOwnerId: card.userId,
        },
      });
      this.logger.info('sharing.qr_scan_connected', {
        fromPhoneE164: maskPhone(phoneE164),
        resolvedOwnerId: card.userId,
      });
    } catch (err) {
      if (isP2002(err)) {
        // This pair has connected before — "log once" by design, not an error.
        this.logger.info('sharing.qr_scan_connect_duplicate_ignored', {
          resolvedOwnerId: card.userId,
        });
      } else {
        throw err;
      }
    }

    return { connected: true };
  }
}
