import { Module, type OnModuleInit } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { WhatsappService } from '../messaging/whatsapp.service';
import { WhatsAppTemplateService } from '../messaging/whatsapp-template.service';
import { ContactsModule } from '../contacts/contacts.module';
import { TaskHandlerRegistry } from '../outbox/task-handler.registry';
import { ApiError } from '../common/errors/api-error';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { ShareLinksController } from './share-links.controller';
import { ShareLinksService } from './share-links.service';
import { PublicLinksController } from './public-links.controller';
import { WhatsAppTemplateController } from './whatsapp-template.controller';

@Module({
  imports: [AuthModule, MessagingModule, ContactsModule],
  controllers: [
    CardsController,
    ShareLinksController,
    PublicLinksController,
    WhatsAppTemplateController,
  ],
  providers: [CardsService, ShareLinksService],
})
export class SharingModule implements OnModuleInit {
  constructor(
    private readonly registry: TaskHandlerRegistry,
    private readonly whatsapp: WhatsappService,
    private readonly templates: WhatsAppTemplateService,
  ) {}

  onModuleInit(): void {
    // The one place that knows how to turn an outbox row of kind
    // 'send_whatsapp_card_share' into an actual Twilio call — mirrors
    // AuthModule's 'send_whatsapp_otp' registration exactly. Registered here
    // rather than in OutboxModule for the same reason: the outbox has no
    // business knowing what a card-share template looks like.
    this.registry.register('send_whatsapp_card_share', async (payload) => {
      const { shareLinkId, contactPhoneE164, ownerName, shareToken } =
        payload as {
          shareLinkId: string;
          contactPhoneE164: string;
          ownerName: string;
          shareToken: string;
        };

      const template = await this.templates.findActive('CARD_SHARE');
      if (!template) {
        throw ApiError.forbidden(
          'CARD_SHARE_TEMPLATE_NOT_CONFIGURED',
          'No active, approved WhatsAppTemplate for purpose=CARD_SHARE — register one via ' +
            'POST /templates once it exists and is approved in Twilio Console.',
        );
      }

      const result = await this.whatsapp.sendTemplate({
        purpose: 'CARD_SHARE',
        toE164: contactPhoneE164,
        contentSid: template.contentSid,
        // Positional mapping documented on the template row itself
        // (variableSchema) — {"1": "ownerName", "2": "shareToken"} is the
        // convention established when the first CARD_SHARE template is
        // registered, not enforced here.
        variables: { '1': ownerName, '2': shareToken },
        correlationId: shareLinkId,
      });

      if (!result.ok) {
        // Thrown, not swallowed: the outbox's catch block records this as a
        // retryable failure (status back to PENDING) unless the error class
        // says otherwise.
        throw new Error(result.errorMessage ?? 'WhatsApp send failed');
      }
    });
  }
}
