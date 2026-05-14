import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import twilio from "twilio";

/**
 * Twilio WhatsApp Messages API expects `whatsapp:` + E.164 for both `from` and `to`.
 * Strips any repeated leading `whatsapp:` (case-insensitive), then adds exactly one prefix.
 */
function toWhatsAppChannelAddress(raw: string): string {
  let s = raw.trim();
  while (/^whatsapp:/i.test(s)) {
    s = s.replace(/^whatsapp:/i, "").trim();
  }
  return `whatsapp:${s}`;
}

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: ReturnType<typeof twilio> | null;
  private readonly whatsappFrom: string | undefined;

  constructor(private readonly config: ConfigService) {
    const sid = this.config.get<string>("TWILIO_ACCOUNT_SID");
    const token = this.config.get<string>("TWILIO_AUTH_TOKEN");
    const rawFrom = this.config.get<string>("TWILIO_WHATSAPP_FROM");
    this.whatsappFrom =
      rawFrom && rawFrom.trim().length > 0
        ? toWhatsAppChannelAddress(rawFrom)
        : undefined;
    this.client = sid && token ? twilio(sid, token) : null;
    if (!this.client) {
      this.logger.warn(
        "Twilio credentials missing; outbound WhatsApp is disabled.",
      );
    }
  }

  /** True when `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are both set (real sends). */
  isClientConfigured(): boolean {
    return this.client !== null;
  }

  validateWebhookSignature(
    signature: string | undefined,
    url: string,
    params: Record<string, string>,
  ): boolean {
    const token = this.config.get<string>("TWILIO_AUTH_TOKEN");
    if (!token) {
      this.logger.warn("TWILIO_AUTH_TOKEN missing; rejecting webhook.");
      return false;
    }
    if (!signature) {
      return false;
    }
    return twilio.validateRequest(token, signature, url, params);
  }

  async sendWhatsApp(toE164: string, body: string): Promise<void> {
    const to = toWhatsAppChannelAddress(toE164);
    const from = this.whatsappFrom;
    if (!this.client || !from) {
      this.logger.log(`[dry-run] WhatsApp to ${to}: ${body}`);
      return;
    }
    try {
      await this.client.messages.create({ from, to, body });
    } catch (err: unknown) {
      this.logger.warn(
        "Twilio WhatsApp send failed",
        err instanceof Error ? err.stack : err,
      );
      const code =
        err &&
        typeof err === "object" &&
        "code" in err &&
        typeof (err as { code: unknown }).code === "number"
          ? (err as { code: number }).code
          : undefined;
      const message =
        code === 63003 || code === 21211
          ? "This number could not receive a WhatsApp message. Install WhatsApp on this phone and try again, or check the number and country code."
          : "ContactBook sends login codes only over WhatsApp. We could not deliver a WhatsApp message to this number — WhatsApp is required.";
      throw new BadRequestException(message);
    }
  }

  /**
   * Sends a connection invite using WhatsApp Content API when `TWILIO_WA_CONNECTION_CONTENT_SID`
   * is set; otherwise falls back to plain text with keyword replies.
   */
  async sendConnectionInvite(
    toE164: string,
    requesterDisplayName: string,
    connectionId: string,
  ): Promise<void> {
    const to = toWhatsAppChannelAddress(toE164);
    const from = this.whatsappFrom;
    const contentSid = this.config.get<string>(
      "TWILIO_WA_CONNECTION_CONTENT_SID",
    );
    if (this.client && from && contentSid?.trim()) {
      try {
        await this.client.messages.create({
          from,
          to,
          contentSid: contentSid.trim(),
          contentVariables: JSON.stringify({
            name: requesterDisplayName,
            connection_id: connectionId,
          }),
        });
        return;
      } catch (err: unknown) {
        this.logger.warn(
          "WhatsApp Content invite failed; falling back to text.",
          err instanceof Error ? err.stack : err,
        );
      }
    }
    await this.sendWhatsApp(
      toE164,
      `ContactBook: ${requesterDisplayName} wants to connect. Reply ACCEPT-${connectionId} or DECLINE-${connectionId}. (Or use quick-reply buttons if your client shows them.)`,
    );
  }
}
