import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  Req,
  UseFilters,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RawBodyRequest } from "@nestjs/common/interfaces";
import type { Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiExcludeController } from "@nestjs/swagger";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";
import { WhatsappMessagingService } from "../messaging/whatsapp-messaging.service";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";
import { WebhookDlqService } from "./webhook-dlq.service";

@ApiExcludeController()
@UseFilters(ApiExceptionFilter)
@Controller({ path: "webhooks/openwa", version: "1" })
export class OpenWaWebhookController {
  constructor(
    private readonly messaging: WhatsappMessagingService,
    private readonly processor: WhatsappWebhookService,
    private readonly dlq: WebhookDlqService,
    private readonly config: ConfigService,
  ) {}

  @Post("whatsapp")
  @HttpCode(200)
  async whatsapp(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-openwa-signature") signature: string | undefined,
  ): Promise<{ ok: true }> {
    const rawBody = req.rawBody;
    const secret = this.config.get<string>("OPENWA_WEBHOOK_SECRET")?.trim();
    if (!rawBody || !secret || !validSignature(signature, rawBody, secret)) {
      throw new ForbiddenException("Invalid OpenWA signature");
    }
    const event = this.messaging.normalizeProviderEvent(req.body);
    if (!event) return { ok: true };
    if (event.type !== "message.received") {
      const updated = await this.messaging.recordDelivery(event);
      if (updated === 0) {
        throw new Error(
          `Delivery arrived before outbound message ${event.providerMessageId} was persisted`,
        );
      }
      return { ok: true };
    }
    const ledgerId = await this.messaging.claimInbound(event);
    if (!ledgerId) return { ok: true };
    try {
      await this.processor.handleInboundMessage(
        event.fromE164,
        event.text,
        event.location,
      );
      await this.messaging.markInboundProcessed(ledgerId);
    } catch (error) {
      await this.messaging.markInboundFailed(ledgerId, error);
      const publicBase = this.config
        .get<string>("APP_PUBLIC_URL", "http://localhost:8000")
        .replace(/\/$/, "");
      await this.dlq.enqueueOpenWa(
        event,
        ledgerId,
        { "x-openwa-signature": signature ?? "" },
        `${publicBase}${req.originalUrl}`,
      );
    }
    return { ok: true };
  }
}

function validSignature(
  signature: string | undefined,
  rawBody: Buffer,
  secret: string,
): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const actualHex = signature.slice("sha256=".length);
  if (!/^[0-9a-f]{64}$/i.test(actualHex)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const actual = Buffer.from(actualHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
