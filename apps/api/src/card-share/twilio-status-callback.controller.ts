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
import { WhatsappProvider as WhatsappProviderName } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  toStoredStatus,
  WhatsappMessagingService,
} from "../messaging/whatsapp-messaging.service";
import {
  mapTwilioSendStatus,
  TWILIO_STATUS_CALLBACK_PATH,
} from "./twilio-card-share.provider";
import { isValidTwilioSignature } from "./twilio-signature.util";

/**
 * Twilio's StatusCallback target for card-share sends (set per-send in
 * TwilioCardShareProvider). Not a public API surface — excluded from Swagger, and the
 * global ValidationPipe's forbidNonWhitelisted rule doesn't apply here since we read
 * `@Req()` raw rather than a validated `@Body() dto`: Twilio's payload carries many more
 * fields (AccountSid, ApiVersion, ChannelToAddress, ...) than we care about.
 */
@ApiExcludeController()
@Controller({ path: "webhooks/twilio/status", version: "1" })
export class TwilioStatusCallbackController {
  private readonly logger = new Logger(TwilioStatusCallbackController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly messaging: WhatsappMessagingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleStatus(
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
    const fullUrl = `${publicBase}${TWILIO_STATUS_CALLBACK_PATH}`;
    if (!isValidTwilioSignature(authToken, fullUrl, params, signature)) {
      throw new ForbiddenException("Invalid Twilio signature");
    }

    const messageSid = params.MessageSid;
    const messageStatus = params.MessageStatus;
    if (!messageSid || !messageStatus) {
      return { ok: true };
    }

    const deliveryStatus = mapTwilioSendStatus(messageStatus);
    const { ids } = await this.messaging.recordDelivery(
      {
        type: deliveryStatus === "failed" ? "message.failed" : "message.ack",
        providerMessageId: messageSid,
        status: deliveryStatus,
        errorCode: params.ErrorCode,
      },
      WhatsappProviderName.TWILIO,
    );

    if (ids.length === 0) {
      this.logger.warn(
        `Twilio status callback for unknown/already-terminal message sid=${messageSid} status=${messageStatus}`,
      );
      return { ok: true };
    }

    const now = new Date();
    const storedStatus = toStoredStatus(deliveryStatus);
    await this.prisma.cardShareRecipient.updateMany({
      where: { whatsappMessageId: { in: ids } },
      data: {
        deliveryStatus: storedStatus,
        ...(deliveryStatus === "delivered" ? { deliveredAt: now } : {}),
        ...(deliveryStatus === "read" ? { readAt: now } : {}),
        ...(deliveryStatus === "failed" ? { failedAt: now } : {}),
      },
    });

    return { ok: true };
  }
}
