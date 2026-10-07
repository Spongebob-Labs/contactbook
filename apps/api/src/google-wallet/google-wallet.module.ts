import { Module, type OnModuleInit } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TaskHandlerRegistry } from '../outbox/task-handler.registry';
import { GoogleWalletController } from './google-wallet.controller';
import { GoogleWalletService } from './google-wallet.service';

@Module({
  imports: [AuthModule],
  controllers: [GoogleWalletController],
  providers: [GoogleWalletService],
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
