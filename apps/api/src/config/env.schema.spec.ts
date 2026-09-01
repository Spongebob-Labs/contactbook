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
});
