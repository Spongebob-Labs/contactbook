import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { TwilioSendError } from './whatsapp-error';

const MESSAGES_URL = (accountSid: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

export interface SendTemplateInput {
  toE164: string;
  contentSid: string;
  variables: Record<string, string>;
}

export interface SendTemplateResult {
  providerMessageId: string;
  status: string;
}

export interface SendFreeformInput {
  toE164: string;
  body: string;
}

export type SendFreeformResult = SendTemplateResult;

/**
 * Thin wrapper over Twilio's Messages API.
 * No retry logic here — that lives in the outbox. This makes exactly one
 * attempt and either returns a result or throws a classified error.
 */
@Injectable()
export class TwilioClient {
  constructor(private readonly config: AppConfigService) {}

  isConfigured(): boolean {
    const t = this.config.twilio;
    return Boolean(t.accountSid && t.authToken && t.whatsappFrom);
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
    const { accountSid, authToken, whatsappFrom } = this.config.twilio;
    if (!accountSid || !authToken || !whatsappFrom) {
      throw new TwilioSendError('Twilio is not configured', 503, null);
    }

    const from = whatsappFrom.startsWith('whatsapp:')
      ? whatsappFrom
      : `whatsapp:${whatsappFrom}`;
    const to = input.toE164.startsWith('whatsapp:')
      ? input.toE164
      : `whatsapp:${input.toE164}`;

    const body = new URLSearchParams({
      From: from,
      To: to,
      ContentSid: input.contentSid,
      ContentVariables: JSON.stringify(input.variables),
    });

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    let res: Response;
    try {
      res = await fetch(MESSAGES_URL(accountSid), {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      throw new TwilioSendError(
        isTimeout ? 'Twilio request timed out' : 'Twilio request failed',
        502,
        null,
        isTimeout,
      );
    }

    const json = (await res.json().catch(() => ({}))) as {
      sid?: string;
      status?: string;
      code?: number;
      message?: string;
    };

    if (!res.ok) {
      throw new TwilioSendError(
        json.message ?? `Twilio responded ${res.status}`,
        res.status,
        json.code ?? null,
      );
    }

    return {
      providerMessageId: json.sid ?? '',
      status: json.status ?? 'queued',
    };
  }

  /**
   * Sends a free-form text reply. Only valid within the 24-hour session
   * window opened by the user's last inbound message — use this only when
   * replying to a WhatsApp message we just received, never to initiate.
   */
  async sendFreeform(input: SendFreeformInput): Promise<SendFreeformResult> {
    const { accountSid, authToken, whatsappFrom } = this.config.twilio;
    if (!accountSid || !authToken || !whatsappFrom) {
      throw new TwilioSendError('Twilio is not configured', 503, null);
    }

    const from = whatsappFrom.startsWith('whatsapp:')
      ? whatsappFrom
      : `whatsapp:${whatsappFrom}`;
    const to = input.toE164.startsWith('whatsapp:')
      ? input.toE164
      : `whatsapp:${input.toE164}`;

    const body = new URLSearchParams({ From: from, To: to, Body: input.body });
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    let res: Response;
    try {
      res = await fetch(MESSAGES_URL(accountSid), {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      throw new TwilioSendError(
        isTimeout ? 'Twilio request timed out' : 'Twilio request failed',
        502,
        null,
        isTimeout,
      );
    }

    const json = (await res.json().catch(() => ({}))) as {
      sid?: string;
      status?: string;
      code?: number;
      message?: string;
    };

    if (!res.ok) {
      throw new TwilioSendError(
        json.message ?? `Twilio responded ${res.status}`,
        res.status,
        json.code ?? null,
      );
    }

    return {
      providerMessageId: json.sid ?? '',
      status: json.status ?? 'queued',
    };
  }
}
