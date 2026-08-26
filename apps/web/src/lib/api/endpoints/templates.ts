/**
 * `whatsapp-templates` — 3 endpoints.
 *
 * ⚠ Name collision worth being explicit about: these are **Twilio Content templates** for
 * outbound WhatsApp messages. They have nothing to do with the card design templates at
 * `/templates` in the marketing site or `@/card/templates` in the code. Different concept,
 * same word.
 *
 * This is an operator surface, not a user one: registering a template records a `contentSid`
 * that already exists in Twilio. Nothing here talks to Twilio or verifies approval — the
 * `approvalStatus` field is a human's transcription of what the Twilio Console says.
 *
 * It matters for the demo for exactly one reason: `shareCard()` cannot send a WhatsApp
 * message until an `APPROVED`, `isActive` `CARD_SHARE` template exists. If sharing fails
 * with `CARD_SHARE_TEMPLATE_NOT_CONFIGURED`, this is where to look.
 *
 * ⚠ There is no delete — `isActive: false` is how a template is retired.
 */

import "server-only";

import { authed } from "@/lib/api/server";
import type {
  ApiTemplatePurpose,
  CreateWhatsAppTemplateDto,
  UpdateWhatsAppTemplateDto,
  WhatsAppTemplateResponseDto,
} from "@/lib/api/schema";

export function listTemplates(options?: {
  purpose?: ApiTemplatePurpose;
}): Promise<WhatsAppTemplateResponseDto[]> {
  return authed({ method: "GET", path: "/templates", query: { purpose: options?.purpose } });
}

/** @throws `TEMPLATE_ALREADY_REGISTERED`. */
export function createTemplate(
  body: CreateWhatsAppTemplateDto,
): Promise<WhatsAppTemplateResponseDto> {
  return authed({ method: "POST", path: "/templates", body });
}

/** @throws `TEMPLATE_NOT_FOUND`. */
export function updateTemplate(
  id: string,
  body: UpdateWhatsAppTemplateDto,
): Promise<WhatsAppTemplateResponseDto> {
  return authed({ method: "PATCH", path: `/templates/${encodeURIComponent(id)}`, body });
}
