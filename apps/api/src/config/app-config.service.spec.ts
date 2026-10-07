import { AppConfigService } from './app-config.service';
import { envSchema } from './env.schema';

function configFor(source: Record<string, string>): AppConfigService {
  return new AppConfigService(
    envSchema.parse({ NODE_ENV: 'development', ...source }),
  );
}

describe('AppConfigService.googleWallet', () => {
  it('is undefined when no GOOGLE_WALLET_* var is set (feature off)', () => {
    expect(configFor({}).googleWallet).toBeUndefined();
  });

  it('groups the four vars when they are set', () => {
    const keyB64 = Buffer.from('not-a-real-key').toString('base64');
    expect(
      configFor({
        GOOGLE_WALLET_ISSUER_ID: '3388000000022000000',
        GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL:
          'wallet@contactbook-test.iam.gserviceaccount.com',
        GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_B64: keyB64,
        GOOGLE_WALLET_CLASS_SUFFIX: 'card',
      }).googleWallet,
    ).toEqual({
      issuerId: '3388000000022000000',
      serviceAccountEmail: 'wallet@contactbook-test.iam.gserviceaccount.com',
      serviceAccountKeyB64: keyB64,
      classSuffix: 'card',
    });
  });

  it('is independent of Apple Wallet: neither turns the other on', () => {
    expect(configFor({}).wallet).toBeUndefined();
    const google = configFor({
      GOOGLE_WALLET_ISSUER_ID: '3388000000022000000',
      GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL:
        'wallet@contactbook-test.iam.gserviceaccount.com',
      GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_B64: 'a2V5',
      GOOGLE_WALLET_CLASS_SUFFIX: 'card',
    });
    expect(google.wallet).toBeUndefined();
    expect(google.googleWallet).toBeDefined();
  });
});
