import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { RecipientsModule } from '../recipients/recipients.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { ShareLinksController } from './share-links.controller';
import { ShareLinksService } from './share-links.service';
import { PublicLinksController } from './public-links.controller';
import { WhatsAppTemplateController } from './whatsapp-template.controller';

@Module({
  imports: [AuthModule, MessagingModule, RecipientsModule],
  controllers: [
    CardsController,
    ShareLinksController,
    PublicLinksController,
    WhatsAppTemplateController,
  ],
  providers: [CardsService, ShareLinksService],
})
export class SharingModule {}
