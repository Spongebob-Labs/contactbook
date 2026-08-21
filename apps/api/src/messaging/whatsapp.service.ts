import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { TwilioClient } from './twilio-client';
import {
  TwilioSendError,
  classifyTwilioError,
  type WhatsappErrorClass,
} from './whatsapp-error';

export interface SendResult {
  ok: boolean;
  errorClass?: WhatsappErrorClass;
  errorMessage?: string;
}

/**
 * Records a Message row FIRST (PENDING), then attempts the send, then patches
 * the row with the outcome. The ledger exists even if the send never
 * completes — a crash mid-send leaves an honestly-PENDING row rather than no
 * record at all.
 */
@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioClient,
    private readonly logger: AppLogger,
  ) {}

  isConfigured(): boolean {
    return this.twilio.isConfigured();
  }

  async sendOtpTemplate(input: {
    toE164: string;
    contentSid: string;
    variables: Record<string, string>;
    correlationId: string;
  }): Promise<SendResult> {
    const message = await this.prisma.message.create({
      data: {
        direction: 'OUTBOUND',
        purpose: 'OTP',
        phoneE164: input.toE164,
        correlationId: input.correlationId,
        status: 'PENDING',
      },
    });

    try {
      const result = await this.twilio.sendTemplate({
        toE164: input.toE164,
        contentSid: input.contentSid,
        variables: input.variables,
      });

      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'SENT',
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
        },
      });

      this.logger.info('whatsapp.otp_sent', {
        messageId: message.id,
        purpose: 'OTP',
      });
      return { ok: true };
    } catch (err) {
      const twilioErr =
        err instanceof TwilioSendError
          ? err
          : new TwilioSendError(String(err), 502, null);
      const errorClass = classifyTwilioError(twilioErr);

      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorCode: twilioErr.twilioCode ? String(twilioErr.twilioCode) : null,
          errorMessage: twilioErr.message,
          errorClass,
        },
      });

      const logFn = errorClass === 'CONFIG' ? 'error' : 'warn';
      this.logger[logFn]('whatsapp.send_failed', {
        messageId: message.id,
        purpose: 'OTP',
        errorClass,
        errorCode: twilioErr.twilioCode,
      });

      return { ok: false, errorClass, errorMessage: twilioErr.message };
    }
  }
}
