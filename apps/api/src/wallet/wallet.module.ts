import { Module, type OnModuleInit } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TaskHandlerRegistry } from '../outbox/task-handler.registry';
import { WalletPassController } from './wallet-pass.controller';
import { WalletWebServiceController } from './wallet-web-service.controller';
import { WalletPassService } from './wallet-pass.service';

@Module({
  imports: [AuthModule],
  controllers: [WalletPassController, WalletWebServiceController],
  providers: [WalletPassService],
  exports: [WalletPassService],
})
export class WalletModule implements OnModuleInit {
  constructor(
    private readonly registry: TaskHandlerRegistry,
    private readonly walletPass: WalletPassService,
  ) {}

  onModuleInit(): void {
    this.registry.register('wallet_push', async (payload) => {
      const { cardId } = payload as { cardId: string };
      await this.walletPass.pushToCard(cardId);
    });
  }
}
