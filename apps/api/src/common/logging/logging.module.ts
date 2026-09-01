import {
  Global,
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { AppLogger } from './app-logger.service';
import { LoggingMiddleware } from './logging.middleware';

@Global()
@Module({
  providers: [
    {
      provide: AppLogger,
      useFactory: (config: AppConfigService) =>
        new AppLogger(!config.isProduction, config.logLevel),
      inject: [AppConfigService],
    },
    LoggingMiddleware,
  ],
  exports: [AppLogger],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Health-check suppression lives inside LoggingMiddleware (UNLOGGED_PATHS),
    // not here. exclude() did not match once a global prefix and URI versioning
    // were in play, and failed silently.
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
