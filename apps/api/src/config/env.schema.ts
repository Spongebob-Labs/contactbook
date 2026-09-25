import * as dotenv from 'dotenv';
import { z } from 'zod';

/**
 * The single place `process.env` is read. Everything else injects AppConfig.
 *
 * Vars are required in production and optional in development, so a fresh clone
 * boots without Twilio credentials while a misconfigured deploy still crashes at
 * startup rather than 500-ing on the first request that needs the value.
 */
const base = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_ENV: z.string().default('local'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Supabase. DATABASE_URL is the transaction pooler (:6543) and MUST carry
  // pgbouncer=true; DIRECT_URL is session mode (:5432) and is used only by
  // `prisma migrate`. See docs/architecture/lld.md §1.0.
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  // Bumped from 15m to 7d 2026-09-25: the original short TTL forced a silent
  // refresh (or, on a client that doesn't retry 401s, a real re-login) far
  // more often than intended. Deploy.yml's staging environment doesn't set
  // JWT_ACCESS_TTL as a secret, so staging/production run on this default —
  // changing it here is the actual way to change it there, not a GitHub
  // secret update.
  JWT_ACCESS_TTL: z.string().default('7d'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // 32 bytes, base64. Guarded at boot rather than at first decrypt.
  FIELD_ENCRYPTION_KEY: z.string().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  // Approved Content Template SID for the OTP message. Required to actually
  // send in production; absent locally, the dev-fallback path returns the
  // code in the API response instead of calling Twilio.
  TWILIO_OTP_CONTENT_SID: z.string().optional(),

  GCP_PROJECT_ID: z.string().optional(),
  GCP_REGION: z.string().default('europe-west2'),

  // Profile photo storage. Uniform bucket-level access with allUsers granted
  // objectViewer — every uploaded object is public-read by design, since a
  // profile photo needs to render on public share pages. No signed URLs, no
  // per-object ACL calls needed.
  GCS_PROFILE_PHOTOS_BUCKET: z.string().optional(),
  // Overridable because a bucket can sit behind a CDN/custom domain; defaults
  // to the bucket's own public URL when unset.
  GCS_PUBLIC_BASE_URL: z.string().url().optional(),
  // Card logo storage. Optional even in production — falls back to
  // GCS_PROFILE_PHOTOS_BUCKET (same public-read bucket, a `card-logos/`
  // key prefix) when unset, so a dedicated bucket is a later upgrade, not a
  // prerequisite. See AppConfigService.gcs.cardLogosBucket.
  GCS_CARD_LOGOS_BUCKET: z.string().optional(),
  // Card cover photo storage — same fallback story as GCS_CARD_LOGOS_BUCKET,
  // a `card-covers/` key prefix distinguishing it in the shared bucket.
  GCS_CARD_COVERS_BUCKET: z.string().optional(),

  // 'inline' runs the task handler in-process on the next tick — used by local
  // dev and integration tests so neither needs a public URL or ngrok.
  TASK_TRANSPORT: z.enum(['cloud_tasks', 'inline']).default('inline'),
  TASKS_QUEUE_OUTBOUND: z.string().optional(),
  TASKS_QUEUE_PRIORITY: z.string().optional(),
  TASKS_TARGET_BASE_URL: z.string().url().optional(),
  // Both are required to authenticate a push: the audience proves the token was
  // minted for us, the SA email proves WHICH Google identity minted it. Checking
  // only the signature would let any Google service account call /internal/*.
  TASKS_OIDC_AUDIENCE: z.string().optional(),
  TASKS_INVOKER_SA: z.string().email().optional(),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SHARE_BASE_URL: z.string().url().default('http://localhost:3000'),

  // Undefined = "use the environment's default": on outside production, off
  // in it. Publishing full endpoint shapes is a minor info leak with no
  // upside once real users exist, so production requires an explicit opt-in
  // rather than inheriting whatever the default happened to be.
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),

  // 'none' is required for the cross-site Vercel-web / VM-api split, but
  // browsers reject SameSite=None without Secure — which breaks plain-http
  // localhost. Default 'lax' locally, set 'none' in production.
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).default('lax'),
  AUTH_COOKIE_DOMAIN: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
});

/** Required once NODE_ENV=production — absence is a boot failure, not a runtime 500. */
const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'FIELD_ENCRYPTION_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_FROM',
  'GCP_PROJECT_ID',
  'TASKS_QUEUE_OUTBOUND',
  'TASKS_QUEUE_PRIORITY',
  'TASKS_TARGET_BASE_URL',
  'TASKS_OIDC_AUDIENCE',
  'TASKS_INVOKER_SA',
  'TWILIO_OTP_CONTENT_SID',
  'GCS_PROFILE_PHOTOS_BUCKET',
] as const;

export const envSchema = base.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required when NODE_ENV=production`,
      });
    }
  }

  if (env.TASK_TRANSPORT !== 'cloud_tasks') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TASK_TRANSPORT'],
      message:
        "must be 'cloud_tasks' in production; 'inline' would drop every queued message on restart",
    });
  }

  if (env.FIELD_ENCRYPTION_KEY) {
    const len = Buffer.from(env.FIELD_ENCRYPTION_KEY, 'base64').length;
    if (len !== 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FIELD_ENCRYPTION_KEY'],
        message: `must decode to exactly 32 bytes, got ${len}`,
      });
    }
  }
});

export type Env = z.infer<typeof base>;

/** dotenv gives every declared var a string, so `FOO=` in a .env file is "",
 *  not absent. Without this, every `.optional()` field in the schema above
 *  rejects a blank line as an invalid value instead of treating it as unset —
 *  which is what every .env.example in this repo assumes blank lines mean. */
function blankToUndefined(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const cleaned: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    cleaned[key] = value === '' ? undefined : value;
  }
  return cleaned;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Explicit, rather than assumed. Historically @prisma/client's own import
  // side-effect loaded .env into process.env for free, which is why the app
  // "just worked" against a real Twilio account with no visible loading step
  // anywhere in this codebase. Prisma 7 dropped that side effect, which would
  // have silently broken every deploy the moment that upgrade landed had this
  // not been made explicit here — the one place env is read.
  //
  // `override: false` (the default) never clobbers a var the environment
  // already set — real deploys inject secrets via GitHub Actions / the shell,
  // not a committed .env, and those must always win.
  dotenv.config();
  const parsed = envSchema.safeParse(blankToUndefined(source));

  if (!parsed.success) {
    // Deliberately not a Nest logger call: this runs before DI exists, and the
    // process is about to die. Print every problem at once so a misconfigured
    // deploy is fixed in one pass instead of one variable per restart.
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    console.error(`Invalid environment configuration:\n${problems}`);
    process.exit(1);
  }

  return parsed.data;
}
