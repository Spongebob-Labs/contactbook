import { Injectable } from '@nestjs/common';
import { WhatsappService } from '../../messaging/whatsapp.service';
import { WhatsAppTemplateService } from '../../messaging/whatsapp-template.service';
import { ReminderService } from '../reminders/reminder.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppLogger } from '../../common/logging/app-logger.service';

/**
 * Outbox handler for `send_whatsapp_reminder`. Renders the
 * `reminder_en` template (body `"🔔 Reminder: {{1}}"`, where `{{1}}`
 * is the reminder text) and sends it to the user who set the
 * reminder. On success, marks the Reminder SENT + stores the
 * Twilio message id. On failure, pushes the Reminder back to
 * PENDING so the next minute's tick retries.
 */
@Injectable()
export class SendWhatsappReminderHandler {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly templates: WhatsAppTemplateService,
    private readonly reminders: ReminderService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const reminderId = payload.reminderId as string;
    const userId = payload.userId as string;
    const text = payload.text as string;
    const correlationId = (payload.correlationId as string) ?? reminderId;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // User vanished (deleted, deactivated) — mark FAILED and move on.
      await this.reminders.markRetry(reminderId, 'user not found');
      return;
    }

    const template = await this.templates.findActive('REMINDER');
    if (!template) {
      this.logger.warn('reminders.template_not_registered', { reminderId });
      // Don't retry forever on a misconfig — mark FAILED and surface.
      await this.prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: 'REMINDER_TEMPLATE_NOT_REGISTERED',
        },
      });
      throw new Error(
        'REMINDER_TEMPLATE_NOT_REGISTERED — register a `reminder_en` template with purpose=REMINDER and approvalStatus=APPROVED.',
      );
    }

    const result = await this.whatsapp.sendTemplate({
      purpose: 'REMINDER',
      toE164: user.phoneE164,
      contentSid: template.contentSid,
      variables: { '1': text },
      correlationId,
    });

    if (!result.ok) {
      // Transient: push back to PENDING for the next tick.
      await this.reminders.markRetry(
        reminderId,
        result.errorMessage ?? 'send failed',
      );
      throw new Error(result.errorMessage ?? 'WhatsApp send failed');
    }

    // Success: mark SENT. The Twilio message id is on the Message row
    // (the canonical send ledger), but we also denormalise it onto
    // the Reminder for fast audit reads.
    const message = await this.prisma.message.findFirst({
      where: { correlationId, direction: 'OUTBOUND', purpose: 'REMINDER' },
      orderBy: { createdAt: 'desc' },
    });
    await this.reminders.markSent(
      reminderId,
      message?.providerMessageId ?? null,
      (payload as { outboxId?: string }).outboxId ?? null,
    );
  }
}
