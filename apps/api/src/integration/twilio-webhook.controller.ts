import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Req,
} from "@nestjs/common";
import { ApiExcludeController, ApiOperation } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import type { RawBodyRequest } from "@nestjs/common/interfaces";
import type { Request } from "express";
import { TwilioService } from "./twilio.service";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";
import { WebhookDlqService } from "./webhook-dlq.service";

@ApiExcludeController()
@Controller({ path: "webhooks/twilio", version: "1" })
export class TwilioWebhookController {
  constructor(
    private readonly twilio: TwilioService,
    private readonly processor: WhatsappWebhookService,
    private readonly dlq: WebhookDlqService,
    private readonly config: ConfigService,
  ) {}

  @Post("whatsapp")
  @HttpCode(200)
  @ApiOperation({ summary: "Twilio inbound WhatsApp (form-urlencoded)" })
  async whatsapp(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-twilio-signature") signature: string | undefined,
  ): Promise<string> {
    const enabled = this.config.get<string>("TWILIO_INBOUND_WEBHOOK_ENABLED");
    if (enabled !== "true") {
      throw new NotFoundException("Inbound webhook not enabled on this environment.");
    }
    const publicBase = this.config
      .get<string>("APP_PUBLIC_URL", "http://localhost:8000")
      .replace(/\/$/, "");
    const url = `${publicBase}${req.originalUrl}`;
    const params: Record<string, string> = {};
    const body = req.body as Record<string, unknown>;
    for (const [k, v] of Object.entries(body ?? {})) {
      if (v === undefined || v === null) {
        params[k] = "";
      } else if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        params[k] = String(v);
      } else {
        params[k] = JSON.stringify(v);
      }
    }
    const ok = this.twilio.validateWebhookSignature(signature, url, params);
    if (!ok) {
      throw new ForbiddenException("Invalid Twilio signature");
    }
    const from = params.From ?? "";
    const inboundText =
      (params.ButtonText && params.ButtonText.trim()) || (params.Body ?? "");
    await this.processor.handleInboundMessage(from, inboundText);
    return "";
  }

  /**
   * Twilio calls this URL when the primary webhook fails to respond with a 2xx.
   * We validate the signature, persist the payload to the dead-letter queue,
   * and immediately return 200 so Twilio considers it delivered.
   * A cron job (WebhookDlqService.retryPending) replays the message later.
   */
  @Post("whatsapp/fallback")
  @HttpCode(200)
  @ApiOperation({ summary: "Twilio inbound WhatsApp fallback (dead-letter capture)" })
  async whatsappFallback(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-twilio-signature") signature: string | undefined,
  ): Promise<string> {
    const publicBase = this.config
      .get<string>("APP_PUBLIC_URL", "http://localhost:8000")
      .replace(/\/$/, "");
    const url = `${publicBase}${req.originalUrl}`;
    const params: Record<string, string> = {};
    const body = req.body as Record<string, unknown>;
    for (const [k, v] of Object.entries(body ?? {})) {
      if (v === undefined || v === null) {
        params[k] = "";
      } else if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        params[k] = String(v);
      } else {
        params[k] = JSON.stringify(v);
      }
    }
    const ok = this.twilio.validateWebhookSignature(signature, url, params);
    if (!ok) {
      throw new ForbiddenException("Invalid Twilio signature");
    }
    await this.dlq.enqueue(
      params,
      { "x-twilio-signature": signature ?? "" },
      url,
    );
    return "";
  }
}
