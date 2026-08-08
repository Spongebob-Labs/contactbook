import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { WhatsappModule } from "../messaging/whatsapp.module";
import { CardShareController } from "./card-share.controller";
import { CardShareBatchController } from "./card-share-batch.controller";
import { WhatsappTemplateController } from "./whatsapp-template.controller";
import { CardShareService } from "./card-share.service";
import { VCardGeneratorService } from "./vcard-generator.service";
import { WhatsappTemplateService } from "./whatsapp-template.service";
import { WhatsappTemplateSyncService } from "./whatsapp-template-sync.service";
import { TwilioCardShareProvider } from "./twilio-card-share.provider";
import { CardShareDispatchService } from "./card-share-dispatch.service";
import { CardShareVcfReplyService } from "./card-share-vcf-reply.service";
import { TwilioStatusCallbackController } from "./twilio-status-callback.controller";
import { TwilioIncomingMessageController } from "./twilio-incoming-message.controller";
import { TwilioContentApiService } from "./twilio-content-api.service";
import { VcardDownloadController } from "./vcard-download.controller";

@Module({
  imports: [PrismaModule, StorageModule, WhatsappModule],
  controllers: [
    CardShareController,
    CardShareBatchController,
    WhatsappTemplateController,
    TwilioStatusCallbackController,
    TwilioIncomingMessageController,
    VcardDownloadController,
  ],
  providers: [
    CardShareService,
    VCardGeneratorService,
    WhatsappTemplateService,
    WhatsappTemplateSyncService,
    TwilioCardShareProvider,
    TwilioContentApiService,
    CardShareDispatchService,
    CardShareVcfReplyService,
  ],
})
export class CardShareModule {}
