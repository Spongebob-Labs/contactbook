import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import twilio from "twilio";

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: ReturnType<typeof twilio> | null;
  private readonly whatsappFrom: string | undefined;

  constructor(private readonly config: ConfigService) {
    const sid = this.config.get<string>("TWILIO_ACCOUNT_SID");
    const token = this.config.get<string>("TWILIO_AUTH_TOKEN");
    this.whatsappFrom = this.config.get<string>("TWILIO_WHATSAPP_FROM");
    this.client = sid && token ? twilio(sid, token) : null;
    if (!this.client) {
      this.logger.warn(
        "Twilio credentials missing; outbound WhatsApp is disabled.",
      );
    }
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
    const to = toE164.startsWith("whatsapp:") ? toE164 : `whatsapp:${toE164}`;
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
}
