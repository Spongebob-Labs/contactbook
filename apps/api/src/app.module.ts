import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { CardModule } from "./card/card.module";
import { ContactsModule } from "./contacts/contacts.module";
import { GroupsModule } from "./groups/groups.module";
import { TagsModule } from "./tags/tags.module";
import { ConnectionModule } from "./connection/connection.module";
import { HealthModule } from "./health/health.module";
import { IntegrationModule } from "./integration/integration.module";
import { JobsModule } from "./jobs/jobs.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProfileModule } from "./profile/profile.module";
import { StorageModule } from "./storage/storage.module";
import { SyncModule } from "./sync/sync.module";
import { TravelModule } from "./travel/travel.module";
import { WhatsappCloudModule } from "./whatsapp-cloud/whatsapp-cloud.module";
import { LoggerModule } from "./common/logger/logger.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // `.env.local` overrides `.env` (both gitignored or tracked per your setup)
      envFilePath: [".env.local", ".env"],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    GroupsModule,
    TagsModule,
    ContactsModule,
    CardModule,
    SyncModule,
    IntegrationModule,
    ConnectionModule,
    TravelModule,
    JobsModule,
    WhatsappCloudModule,
    LoggerModule,
  ],
})
export class AppModule {}
