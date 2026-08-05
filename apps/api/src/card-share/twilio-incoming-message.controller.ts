import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request } from "express";
import { TWILIO_INCOMING_MESSAGE_PATH } from "./twilio-card-share.provider";
import { isValidTwilioSignature } from "./twilio-signature.util";
import { CardShareVcfReplyService } from "./card-share-vcf-reply.service";

/**
 * Receives inbound WhatsApp messages forwarded by Twilio.
 *
 * This is the entry point for the second leg of the two-message card-share flow: when a
 * recipient taps the quick-reply button on a card-share template, WhatsApp sends their reply
 * to our number, Twilio fires a POST here, and we respond by sending the VCF document so
 * the recipient sees the native "Add to Contacts" button.
 *
 * Webhook URL (configure in Twilio console → phone number → "A MESSAGE COMES IN"):
 *   POST  ${APP_PUBLIC_URL}/api/v1/webhooks/twilio/incoming
 *
 * The handler always returns HTTP 200. Errors inside handleQuickReply() are caught and
 * logged — Twilio retries on 4xx/5xx, which would spam the user with duplicate VCF files.
 *
 * Not a public API surface — excluded from Swagger.
 */
@ApiExcludeController()
@Controller({ path: "webhooks/twilio/incoming", version: "1" })
export class TwilioIncomingMessageController {
  private readonly logger = new Logger(TwilioIncomingMessageController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly vcfReply: CardShareVcfReplyService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleIncoming(
    @Req() req: Request,
    @Headers("x-twilio-signature") signature: string | undefined,
  ): Promise<{ ok: true }> {
    const authToken = this.config.get<string>("TWILIO_AUTH_TOKEN");
    const publicBase = this.config
      .get<string>("APP_PUBLIC_URL")
      ?.replace(/\/+$/, "");

    if (!authToken || !publicBase) {
      throw new ForbiddenException("Twilio webhook is not configured");
    }

    const params = (req.body ?? {}) as Record<string, string>;
    const fullUrl = `${publicBase}${TWILIO_INCOMING_MESSAGE_PATH}`;

    if (!isValidTwilioSignature(authToken, fullUrl, params, signature)) {
      throw new ForbiddenException("Invalid Twilio signature");
    }

    // Twilio prefixes all WhatsApp numbers with "whatsapp:"
    const fromRaw = params.From ?? "";
    const fromE164 = fromRaw.startsWith("whatsapp:")
      ? fromRaw.slice("whatsapp:".length)
      : fromRaw;

    if (!fromE164.startsWith("+")) {
      this.logger.warn(
        `Unexpected incoming From format: "${fromRaw}" — ignoring.`,
      );
      return { ok: true };
    }

    try {
      await this.vcfReply.handleQuickReply(fromE164);
    } catch (err) {
      // Catch any unhandled error so we always return 200 and never trigger Twilio retries.
      this.logger.error(
        `Unhandled error in VCF reply handler for ${fromE164}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return { ok: true };
  }
}
