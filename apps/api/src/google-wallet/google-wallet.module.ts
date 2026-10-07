import { Module, type OnModuleInit } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppConfigService } from '../config/app-config.service';
import { TaskHandlerRegistry } from '../outbox/task-handler.registry';
import {
  GOOGLE_WALLET_HTTP,
  createGoogleWalletHttp,
  type GoogleWalletHttp,
} from './google-wallet.client';
import { GoogleWalletController } from './google-wallet.controller';
import { GoogleWalletService } from './google-wallet.service';

/** `null` when GOOGLE_WALLET_* is unset — no client object, no network, ever. */
export function googleWalletHttpFactory(
  config: AppConfigService,
): GoogleWalletHttp | null {
  const cfg = config.googleWallet;
  if (!cfg) return null;
  return createGoogleWalletHttp({
    serviceAccountEmail: cfg.serviceAccountEmail,
    privateKeyPem: Buffer.from(cfg.serviceAccountKeyB64, 'base64').toString(
      'utf8',
    ),
  });
}

@Module({
  // AuthModule for JwtAuthGuard, and for the JwtService it re-exports (which
  // signs the save-URL JWT with the service account key).
  imports: [AuthModule],
  controllers: [GoogleWalletController],
  providers: [
    {
      provide: GOOGLE_WALLET_HTTP,
      useFactory: googleWalletHttpFactory,
      inject: [AppConfigService],
    },
    GoogleWalletService,
  ],
  exports: [GoogleWalletService],
})
export class GoogleWalletModule implements OnModuleInit {
  constructor(
    private readonly registry: TaskHandlerRegistry,
    private readonly googleWallet: GoogleWalletService,
  ) {}

  onModuleInit(): void {
    this.registry.register('google_wallet_push', async (payload) => {
      const { cardId } = payload as { cardId: string };
      await this.googleWallet.syncPassObject(cardId);
    });
  }
}
