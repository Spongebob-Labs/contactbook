import { envSchema, loadEnv } from './env.schema';

const PROD_BASE = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@h:6543/db?pgbouncer=true',
  DIRECT_URL: 'postgresql://u:p@h:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  TWILIO_ACCOUNT_SID: 'AC1',
  TWILIO_AUTH_TOKEN: 't',
  TWILIO_WHATSAPP_FROM: '+14155550100',
  GCP_PROJECT_ID: 'p',
  TASK_TRANSPORT: 'cloud_tasks',
  TASKS_QUEUE_OUTBOUND: 'q1',
  TASKS_QUEUE_PRIORITY: 'q2',
  TASKS_TARGET_BASE_URL: 'https://api.example.com',
  TASKS_OIDC_AUDIENCE: 'https://api.example.com',
  TASKS_INVOKER_SA: 'invoker@p.iam.gserviceaccount.com',
  TWILIO_OTP_CONTENT_SID: 'HX' + '0'.repeat(32),
  GCS_PROFILE_PHOTOS_BUCKET: 'contactbook-profile-photos',
};

describe('envSchema', () => {
  it('accepts a complete production environment', () => {
    expect(envSchema.safeParse(PROD_BASE).success).toBe(true);
  });

  it('boots in development without any credentials', () => {
    expect(envSchema.safeParse({ NODE_ENV: 'development' }).success).toBe(true);
  });

  it('fails production when a required var is missing, and names every one', () => {
    const rest: Record<string, unknown> = { ...PROD_BASE };
    delete rest.TWILIO_AUTH_TOKEN;
    delete rest.GCP_PROJECT_ID;
    const res = envSchema.safeParse(rest);
    expect(res.success).toBe(false);
    const paths = res.success
      ? []
      : res.error.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['TWILIO_AUTH_TOKEN', 'GCP_PROJECT_ID']),
    );
  });

  // Regression: dotenv turns `FOO=` (a blank line) into "", not undefined.
  // Every .env.example in this repo ships optional vars blank on purpose, and
  // z.string().url().optional() rejects "" as neither absent nor a valid URL
  // — loadEnv() must treat a blank string as unset before validating.
  it('treats blank env values as unset rather than as invalid', () => {
    const withBlanks = loadEnv({
      NODE_ENV: 'development',
      TASKS_TARGET_BASE_URL: '',
      TASKS_INVOKER_SA: '',
      DATABASE_URL: '',
    });
    expect(withBlanks.TASKS_TARGET_BASE_URL).toBeUndefined();
    expect(withBlanks.TASKS_INVOKER_SA).toBeUndefined();
  });

  // inline transport runs handlers in-process; in production that would drop
  // every queued message on restart.
  it('refuses the inline task transport in production', () => {
    const res = envSchema.safeParse({ ...PROD_BASE, TASK_TRANSPORT: 'inline' });
    expect(res.success).toBe(false);
  });

  it('rejects an encryption key that is not 32 bytes', () => {
    const res = envSchema.safeParse({
      ...PROD_BASE,
      FIELD_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64'),
    });
    expect(res.success).toBe(false);
  });

  // Google Wallet: all four or none, in any environment — the same rule as
  // WALLET_*. A half-configured server must fail the boot, not half-work.
  describe('GOOGLE_WALLET_* (all-or-none)', () => {
    const GOOGLE_WALLET = {
      GOOGLE_WALLET_ISSUER_ID: '3388000000022000000',
      GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL:
        'wallet@contactbook-test.iam.gserviceaccount.com',
      GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_B64:
        Buffer.from('not-a-real-key').toString('base64'),
      GOOGLE_WALLET_CLASS_SUFFIX: 'card',
    };

    it('accepts none of them — the feature is simply off', () => {
      expect(envSchema.safeParse({ NODE_ENV: 'development' }).success).toBe(
        true,
      );
      expect(envSchema.safeParse(PROD_BASE).success).toBe(true);
    });

    it('accepts all four together, in development and in production', () => {
      expect(
        envSchema.safeParse({ NODE_ENV: 'development', ...GOOGLE_WALLET })
          .success,
      ).toBe(true);
      expect(
        envSchema.safeParse({ ...PROD_BASE, ...GOOGLE_WALLET }).success,
      ).toBe(true);
    });

    it.each(Object.keys(GOOGLE_WALLET))(
      'rejects a partial set and names the missing var (%s)',
      (missing) => {
        const partial: Record<string, unknown> = {
          NODE_ENV: 'development',
          ...GOOGLE_WALLET,
        };
        delete partial[missing];
        const res = envSchema.safeParse(partial);
        expect(res.success).toBe(false);
        const paths = res.success
          ? []
          : res.error.issues.map((i) => i.path.join('.'));
        expect(paths).toEqual([missing]);
      },
    );

    it('names every missing var at once when only one is set', () => {
      const res = envSchema.safeParse({
        NODE_ENV: 'development',
        GOOGLE_WALLET_CLASS_SUFFIX: 'card',
      });
      expect(res.success).toBe(false);
      const paths = res.success
        ? []
        : res.error.issues.map((i) => i.path.join('.')).sort();
      expect(paths).toEqual([
        'GOOGLE_WALLET_ISSUER_ID',
        'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL',
        'GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_B64',
      ]);
    });

    it('treats blank values as unset, so an empty rendered .env stays off', () => {
      const env = loadEnv({
        NODE_ENV: 'development',
        GOOGLE_WALLET_ISSUER_ID: '',
        GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: '',
        GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_B64: '',
        GOOGLE_WALLET_CLASS_SUFFIX: '',
      });
      expect(env.GOOGLE_WALLET_ISSUER_ID).toBeUndefined();
      expect(env.GOOGLE_WALLET_CLASS_SUFFIX).toBeUndefined();
    });

    it('rejects a class suffix Google would refuse as part of an ID', () => {
      const res = envSchema.safeParse({
        NODE_ENV: 'development',
        ...GOOGLE_WALLET,
        GOOGLE_WALLET_CLASS_SUFFIX: 'my card/1',
      });
      expect(res.success).toBe(false);
    });
  });
});
