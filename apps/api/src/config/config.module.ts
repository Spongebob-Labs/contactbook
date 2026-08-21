import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { loadEnv } from './env.schema';

/**
 * Global so no feature module has to import it. The env is parsed exactly once,
 * at module construction — i.e. at boot, before the server listens.
 */
@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useFactory: () => new AppConfigService(loadEnv()),
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}
