import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { ConnectionModule } from "./connection/connection.module";
import { HealthModule } from "./health/health.module";
import { IntegrationModule } from "./integration/integration.module";
import { JobsModule } from "./jobs/jobs.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProfileModule } from "./profile/profile.module";
import { SyncModule } from "./sync/sync.module";
import { TravelModule } from "./travel/travel.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // `.env.local` overrides `.env` (both gitignored or tracked per your setup)
      envFilePath: [".env.local", ".env"],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    SyncModule,
    IntegrationModule,
    ConnectionModule,
    TravelModule,
    JobsModule,
  ],
})
export class AppModule {}
