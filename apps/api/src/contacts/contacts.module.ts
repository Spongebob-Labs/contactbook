import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GroupsModule } from "../groups/groups.module";
import { OAuthTokensModule } from "../oauth-tokens/oauth-tokens.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TagsModule } from "../tags/tags.module";
import { ContactLabelsService } from "./contact-labels.service";
import { ContactSourceCredentialsService } from "./contact-source-credentials.service";
import { ContactSourceWritebackService } from "./contact-source-writeback.service";
import { ContactDedupService } from "./contact-dedup.service";
import { ContactProviderLinkService } from "./contact-provider-link.service";
import { ContactSerializer } from "./contact.serializer";
import { ContactUpsertService } from "./contact-upsert.service";
import { ContactsSyncService } from "./contacts-sync.service";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { GoogleContactsSyncProvider } from "./providers/google-contacts-sync.provider";
import { IcloudContactsSyncProvider } from "./providers/icloud-contacts-sync.provider";
import { VcardContactsImportService } from "./vcard-contacts-import.service";

@Module({
  imports: [
    PrismaModule,
    OAuthTokensModule,
    ConfigModule,
    TagsModule,
    GroupsModule,
  ],
  controllers: [ContactsController],
  providers: [
    ContactsService,
    ContactsSyncService,
    ContactSerializer,
    ContactUpsertService,
    ContactDedupService,
    ContactProviderLinkService,
    ContactLabelsService,
    ContactSourceCredentialsService,
    ContactSourceWritebackService,
    GoogleContactsSyncProvider,
    IcloudContactsSyncProvider,
    VcardContactsImportService,
  ],
  exports: [
    ContactUpsertService,
    ContactsService,
    ContactSerializer,
    ContactsSyncService,
    ContactLabelsService,
  ],
})
export class ContactsModule {}
