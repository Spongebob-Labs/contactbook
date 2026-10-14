import { Injectable } from '@nestjs/common';
import { WhatsappService } from '../../messaging/whatsapp.service';
import { WhatsAppTemplateService } from '../../messaging/whatsapp-template.service';
import { ChatRecordService } from '../chat-record/chat-record.service';
import { AppLogger } from '../../common/logging/app-logger.service';

/**
 * Outbox handler for `send_whatsapp_agent_reply`. Renders the
 * `agent_reply_en` template (body = `{{1}}`, the entire reply is the
 * variable) and sends it. The deterministic formatter already turned
 * the synthesiser's markdown into WhatsApp flavor, so the template
 * just wraps it.
 *
 * If the template isn't registered / approved, we fall back to a
 * single freeform send (only works inside the 24h session window,
 * but better than nothing) — and log a clear warning.
 */
@Injectable()
export class SendWhatsappAgentReplyHandler {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly templates: WhatsAppTemplateService,
    private readonly records: ChatRecordService,
    private readonly logger: AppLogger,
  ) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const userId = payload.userId as string;
    const threadId = payload.threadId as string;
    const toPhoneE164 = payload.toPhoneE164 as string;
    const text = payload.text as string;
    const correlationId = (payload.correlationId as string) ?? threadId;

    const template = await this.templates.findActive('AGENT_REPLY');
    if (!template) {
      this.logger.warn('agent.reply_template_not_registered', { threadId });
      throw new Error(
        'AGENT_REPLY_TEMPLATE_NOT_REGISTERED — register an `agent_reply_en` template with purpose=AGENT_REPLY and approvalStatus=APPROVED.',
      );
    }

    const result = await this.whatsapp.sendTemplate({
      purpose: 'AGENT_REPLY',
      toE164: toPhoneE164,
      contentSid: template.contentSid,
      variables: { '1': text },
      correlationId,
    });
    if (!result.ok) {
      throw new Error(result.errorMessage ?? 'WhatsApp send failed');
    }

    // Record the final assistant text in the audit log.
    await this.records.appendAssistantText(threadId, userId, text);
  }
}
