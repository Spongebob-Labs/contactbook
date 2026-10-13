import { Injectable } from '@nestjs/common';
import { WhatsappService } from '../../messaging/whatsapp.service';
import { WhatsAppTemplateService } from '../../messaging/whatsapp-template.service';
import { AppLogger } from '../../common/logging/app-logger.service';

/**
 * Outbox handler for `send_whatsapp_agent_approval`. Renders the
 * `agent_approval_en` template — body `"Approve this action?\n\n*{{1}}*"`
 * with two quick-reply buttons (✅ Approve / ❌ Decline), where
 * `{{1}}` is the action summary the tool produced.
 *
 * The Twilio template MUST be created in Twilio Console with the two
 * buttons. Until then, the handler throws and the dispatcher marks
 * the outbox row retryable — same posture as the not-yet-configured
 * CARD_SHARE template mentioned in CardsController.share.
 */
@Injectable()
export class SendWhatsappAgentApprovalHandler {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly templates: WhatsAppTemplateService,
    private readonly logger: AppLogger,
  ) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const toPhoneE164 = payload.toPhoneE164 as string;
    const summary = payload.summary as string;
    const correlationId =
      (payload.correlationId as string) ?? (payload.threadId as string);

    const template = await this.templates.findActive('AGENT_APPROVAL');
    if (!template) {
      this.logger.warn('agent.approval_template_not_registered', {
        threadId: correlationId,
      });
      throw new Error(
        'AGENT_APPROVAL_TEMPLATE_NOT_REGISTERED — register an `agent_approval_en` template with two quick-reply buttons and approvalStatus=APPROVED.',
      );
    }

    const result = await this.whatsapp.sendTemplate({
      purpose: 'AGENT_APPROVAL',
      toE164: toPhoneE164,
      contentSid: template.contentSid,
      variables: { '1': summary },
      correlationId,
    });
    if (!result.ok) {
      throw new Error(result.errorMessage ?? 'WhatsApp send failed');
    }
  }
}
