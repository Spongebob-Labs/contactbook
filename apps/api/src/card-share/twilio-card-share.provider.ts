import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  WhatsappDeliveryStatus,
  WhatsappSendResult,
} from "../messaging/whatsapp-provider";
import {
  CLIENT_ERROR_TWILIO_CODES,
  mapHttpStatus,
  TwilioSendError,
} from "../twilio-otp/twilio-error-mapping";

export { TwilioSendError };

const MESSAGES_ENDPOINT = (accountSid: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    accountSid,
  )}/Messages.json`;

// NestJS applies both app.setGlobalPrefix("api") and URI versioning (main.ts), so the
// real route is /api/v1/... — these constants must match exactly, since they're used both
// to build URLs sent to Twilio and to reconstruct signed URLs for webhook verification
// (see twilio-signature.util.ts).
export const TWILIO_STATUS_CALLBACK_PATH = "/api/v1/webhooks/twilio/status";
export const TWILIO_INCOMING_MESSAGE_PATH = "/api/v1/webhooks/twilio/incoming";

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** Normalized `whatsapp:+<e164>` sender. */
  whatsappFrom: string;
  /** Base URL Twilio can reach to deliver the status callback, e.g. https://api.contactbook.app. */
  apiPublicBaseUrl: string;
}

export type CardShareSendInput = {
  toE164: string;
  contentSid: string;
  senderDisplayName: string;
  cardName: string;
  note: string | null;
  /** GCS object key (e.g. "cardId/hash.vcf") — appended to the GCS base URL baked into
   *  the template's URL button. Omit for quick-reply templates that have no URL button. */
  vcardObjectKey?: string;
};

/** Client-safe message; hides internal detail for non-client errors. */
function mapClientMessage(twilioCode: number | null): string {
  if (twilioCode !== null && CLIENT_ERROR_TWILIO_CODES.has(twilioCode)) {
    return "This number can't receive a WhatsApp card share message. Check the number and try again.";
  }
  return "Could not send the WhatsApp card share message. Please try again shortly.";
}

/** Maps Twilio's raw send-response status to the ledger's WhatsappDeliveryStatus. */
export function mapTwilioSendStatus(raw: string): WhatsappDeliveryStatus {
  switch (raw) {
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "undelivered":
    case "failed":
    case "canceled":
      return "failed";
    case "queued":
    case "accepted":
    case "sending":
    case "sent":
    default:
      return "sent";
  }
}

@Injectable()
export class TwilioCardShareProvider {
  private readonly logger = new Logger(TwilioCardShareProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return this.readConfig() !== null;
  }

  /**
   * Sends the card-share template through Twilio's WhatsApp Content API. The template is a
   * twilio/call-to-action type with a URL button; variable 4 is the .vcf object key appended
   * to the GCS base URL baked into the button at template-creation time — see
   * docs/whatsapp-card-share/twilio-vcard.md for the full variable numbering.
   * @throws TwilioSendError on misconfiguration or an upstream failure.
   */
  async send(input: CardShareSendInput): Promise<WhatsappSendResult> {
    const cfg = this.readConfigOrThrow();
    const body = new URLSearchParams({
      To: `whatsapp:${input.toE164}`,
      From: cfg.whatsappFrom,
      ContentSid: input.contentSid,
      ContentVariables: JSON.stringify({
        "1": input.senderDisplayName,
        "2": input.cardName,
        // WhatsApp rejects empty-string template variables (Twilio error 21656), so an
        // absent note falls back to a single space rather than "".
        "3": input.note?.trim() ? input.note : " ",
        // Variable 4 is only included for URL-button templates (the GCS base URL is baked
        // into the button; we only send the path suffix). Quick-reply templates omit {{4}}.
        ...(input.vcardObjectKey ? { "4": input.vcardObjectKey } : {}),
      }),
      StatusCallback: `${cfg.apiPublicBaseUrl}${TWILIO_STATUS_CALLBACK_PATH}`,
    });

    let res: Response;
    try {
      res = await fetch(MESSAGES_ENDPOINT(cfg.accountSid), {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${cfg.accountSid}:${cfg.authToken}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(this.requestTimeoutMs()),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new TwilioSendError(`Could not reach Twilio: ${reason}`, 502);
    }

    const payload = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      const twilioCode =
        typeof payload["code"] === "number" ? payload["code"] : null;
      const message =
        typeof payload["message"] === "string"
          ? payload["message"]
          : `Twilio returned HTTP ${res.status}`;
      const moreInfo =
        typeof payload["more_info"] === "string"
          ? payload["more_info"]
          : undefined;
      this.logger.warn(
        `Twilio card-share send failed: http=${res.status} code=${twilioCode ?? "?"} message=${message}`,
      );
      throw new TwilioSendError(
        mapClientMessage(twilioCode),
        mapHttpStatus(res.status, twilioCode),
        twilioCode,
        moreInfo,
      );
    }

    const providerMessageId =
      typeof payload["sid"] === "string" ? payload["sid"] : "";
    const rawStatus =
      typeof payload["status"] === "string" ? payload["status"] : "queued";

    return {
      providerMessageId,
      status: mapTwilioSendStatus(rawStatus),
    };
  }

  /**
   * Sends a raw VCF document (no template) to an already-open 24-hour WhatsApp session.
   * WhatsApp renders VCF files as a native contact card with an "Add to Contacts" button.
   *
   * Must only be called after the recipient has sent a message to our number first (e.g. via
   * a quick-reply button tap), which opens the session window required to send non-template
   * messages.
   *
   * @returns The Twilio message SID.
   */
  async sendVcfDocument(input: {
    toE164: string;
    vcfUrl: string;
  }): Promise<string> {
    const cfg = this.readConfigOrThrow();
    const body = new URLSearchParams({
      To: `whatsapp:${input.toE164}`,
      From: cfg.whatsappFrom,
      MediaUrl: input.vcfUrl,
    });

    let res: Response;
    try {
      res = await fetch(MESSAGES_ENDPOINT(cfg.accountSid), {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${cfg.accountSid}:${cfg.authToken}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(this.requestTimeoutMs()),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new TwilioSendError(`Could not reach Twilio: ${reason}`, 502);
    }

    const payload = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      const twilioCode =
        typeof payload["code"] === "number" ? payload["code"] : null;
      const message =
        typeof payload["message"] === "string"
          ? payload["message"]
          : `Twilio returned HTTP ${res.status}`;
      this.logger.warn(
        `Twilio VCF document send failed: http=${res.status} code=${twilioCode ?? "?"} message=${message}`,
      );
      throw new TwilioSendError(
        mapClientMessage(twilioCode),
        mapHttpStatus(res.status, twilioCode),
        twilioCode,
      );
    }

    const sid = typeof payload["sid"] === "string" ? payload["sid"] : "";
    return sid;
  }

  private requestTimeoutMs(): number {
    const parsed = Number(
      this.config.get<string>("TWILIO_REQUEST_TIMEOUT_MS", "10000"),
    );
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 10_000;
  }

  private readConfigOrThrow(): TwilioConfig {
    const cfg = this.readConfig();
    if (!cfg) {
      throw new TwilioSendError(
        "WhatsApp card share is temporarily unavailable.",
        503,
      );
    }
    return cfg;
  }

  private readConfig(): TwilioConfig | null {
    const accountSid = this.config.get<string>("TWILIO_ACCOUNT_SID");
    const authToken = this.config.get<string>("TWILIO_AUTH_TOKEN");
    const whatsappFromRaw = this.config.get<string>("TWILIO_WHATSAPP_FROM");
    const apiPublicBaseUrl = this.config
      .get<string>("APP_PUBLIC_URL")
      ?.replace(/\/+$/, "");
    if (!accountSid || !authToken || !whatsappFromRaw || !apiPublicBaseUrl) {
      return null;
    }
    const whatsappFrom = whatsappFromRaw.startsWith("whatsapp:")
      ? whatsappFromRaw
      : `whatsapp:${whatsappFromRaw}`;
    return { accountSid, authToken, whatsappFrom, apiPublicBaseUrl };
  }
}
