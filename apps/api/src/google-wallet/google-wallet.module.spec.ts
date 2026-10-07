import {
  GoogleWalletModule,
  googleWalletHttpFactory,
} from './google-wallet.module';
import type { GoogleWalletService } from './google-wallet.service';
import { TaskHandlerRegistry } from '../outbox/task-handler.registry';
import type { AppConfigService } from '../config/app-config.service';

describe('GoogleWalletModule', () => {
  it("registers the 'google_wallet_push' outbox handler, which syncs that card's pass", async () => {
    const registry = new TaskHandlerRegistry();
    const syncPassObject = jest.fn().mockResolvedValue(undefined);
    new GoogleWalletModule(registry, {
      syncPassObject,
    } as unknown as GoogleWalletService).onModuleInit();

    const handler = registry.get('google_wallet_push');
    expect(handler).toBeDefined();
    await handler!({ cardId: 'card-1' });
    expect(syncPassObject).toHaveBeenCalledWith('card-1');
  });

  it('lets a failed sync reject, so the dispatcher records it and keeps the row', async () => {
    const registry = new TaskHandlerRegistry();
    const syncPassObject = jest.fn().mockRejectedValue(new Error('503'));
    new GoogleWalletModule(registry, {
      syncPassObject,
    } as unknown as GoogleWalletService).onModuleInit();
    await expect(
      registry.get('google_wallet_push')!({ cardId: 'card-1' }),
    ).rejects.toThrow('503');
  });

  it("does not take Apple's kind, so both modules can register side by side", () => {
    const registry = new TaskHandlerRegistry();
    registry.register('wallet_push', jest.fn());
    expect(() =>
      new GoogleWalletModule(
        registry,
        {} as unknown as GoogleWalletService,
      ).onModuleInit(),
    ).not.toThrow();
  });
});

describe('googleWalletHttpFactory', () => {
  it('builds no client at all when Google Wallet is not configured', () => {
    expect(
      googleWalletHttpFactory({
        googleWallet: undefined,
      } as unknown as AppConfigService),
    ).toBeNull();
  });

  it('builds a client when it is — without touching the network', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const http = googleWalletHttpFactory({
      googleWallet: {
        issuerId: '3388000000022000000',
        serviceAccountEmail: 'wallet@contactbook-test.iam.gserviceaccount.com',
        serviceAccountKeyB64: Buffer.from('not-a-real-key').toString('base64'),
        classSuffix: 'card',
      },
    } as unknown as AppConfigService);
    expect(typeof http?.request).toBe('function');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
