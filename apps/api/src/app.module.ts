import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppLogger } from './common/logging/app-logger.service';
import { LoggingModule } from './common/logging/logging.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { OutboxModule } from './outbox/outbox.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { ContactsModule } from './contacts/contacts.module';
import { SharingModule } from './sharing/sharing.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    PrismaModule,
    OutboxModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    ContactsModule,
    SharingModule,
    WebhooksModule,
    DashboardModule,
  ],
  providers: [
    {
      // Exactly one global filter. Not @UseFilters per controller.
      provide: APP_FILTER,
      useFactory: (logger: AppLogger) => new AllExceptionsFilter(logger),
      inject: [AppLogger],
    },
  ],
})
export class AppModule {}
