import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common/interfaces";
import type { Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiExcludeController } from "@nestjs/swagger";

const VERIFY_TOKEN = "whatsapp-verify-4b7c1a";
const APP_SECRET = "6384b035b017d20d3dc11e567900ffad";

@ApiExcludeController()
@Controller({ path: "webhooks/whatsapp-cloud", version: "1" })
export class WhatsappCloudController {
  private readonly logger = new Logger(WhatsappCloudController.name);

  @Get("webhook")
  verify(
    @Query("hub.mode") mode: string | undefined,
    @Query("hub.verify_token") token: string | undefined,
    @Query("hub.challenge") challenge: string | undefined,
  ): string {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      this.logger.log("Webhook verification succeeded");
      return challenge ?? "";
    }
    throw new ForbiddenException("Verification failed");
  }

  @Post("webhook")
  @HttpCode(200)
  // eslint-disable-next-line @typescript-eslint/require-await -- async kept for NestJS convention; business logic will be added later
  async handleEvent(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-hub-signature-256") signature: string | undefined,
  ): Promise<{ ok: true }> {
    const rawBody = req.rawBody;
    if (!rawBody || !isValidSignature(signature, rawBody, APP_SECRET)) {
      throw new ForbiddenException("Invalid signature");
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (body?.object !== "whatsapp_business_account") {
      return { ok: true };
    }

    const entries = (body.entry ?? []) as Array<{
      id?: string;
      changes?: Array<{
        value?: Record<string, unknown>;
        field?: string;
      }>;
    }>;

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        if (change.field === "messages") {
          this.handleMessagesField(change.value);
        }
      }
    }

    return { ok: true };
  }

  private handleMessagesField(
    value: Record<string, unknown> | undefined,
  ): void {
    if (!value) return;

    const metadata = value.metadata as
      | { display_phone_number?: string; phone_number_id?: string }
      | undefined;

    const contacts = (value.contacts ?? []) as Array<{
      profile?: { name?: string };
      wa_id?: string;
    }>;

    const messages = (value.messages ?? []) as Array<{
      from?: string;
      id?: string;
      timestamp?: string;
      type?: string;
      text?: { body?: string };
      image?: { id?: string; mime_type?: string; caption?: string };
      video?: { id?: string; mime_type?: string; caption?: string };
      audio?: { id?: string; mime_type?: string };
      document?: { id?: string; mime_type?: string; filename?: string };
      location?: {
        latitude?: number;
        longitude?: number;
        name?: string;
        address?: string;
      };
    }>;

    const statuses = (value.statuses ?? []) as Array<{
      id?: string;
      status?: string;
      timestamp?: string;
      recipient_id?: string;
      errors?: Array<{ code?: number; title?: string; message?: string }>;
    }>;

    for (const msg of messages) {
      const contact = contacts.find((c) => c.wa_id === msg.from);
      const contactName = contact?.profile?.name ?? "unknown";
      this.logger.log(
        `Inbound message from ${contactName} (${msg.from}): type=${msg.type} id=${msg.id}`,
      );
      if (msg.text?.body) {
        this.logger.log(`  text: ${msg.text.body}`);
      }
    }

    for (const status of statuses) {
      this.logger.log(
        `Status update: id=${status.id} status=${status.status} recipient=${status.recipient_id}`,
      );
      if (status.errors?.length) {
        for (const err of status.errors) {
          this.logger.warn(
            `  error: code=${err.code} title=${err.title} message=${err.message}`,
          );
        }
      }
    }

    if (metadata) {
      this.logger.debug(
        `Metadata: phone=${metadata.display_phone_number} phone_id=${metadata.phone_number_id}`,
      );
    }
  }
}

function isValidSignature(
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
