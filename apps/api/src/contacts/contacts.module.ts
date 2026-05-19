import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OAuthTokensModule } from "../oauth-tokens/oauth-tokens.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ContactDedupService } from "./contact-dedup.service";
import { ContactSerializer } from "./contact.serializer";
import { ContactUpsertService } from "./contact-upsert.service";
import { ContactsSyncService } from "./contacts-sync.service";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { GoogleContactsSyncProvider } from "./providers/google-contacts-sync.provider";
import { IcloudContactsSyncProvider } from "./providers/icloud-contacts-sync.provider";

@Module({
  imports: [PrismaModule, OAuthTokensModule, ConfigModule],
  controllers: [ContactsController],
  providers: [
    ContactsService,
    ContactsSyncService,
    ContactSerializer,
    ContactUpsertService,
    ContactDedupService,
    GoogleContactsSyncProvider,
    IcloudContactsSyncProvider,
  ],
  exports: [
    ContactUpsertService,
    ContactsService,
    ContactSerializer,
    ContactsSyncService,
  ],
})
export class ContactsModule {}
