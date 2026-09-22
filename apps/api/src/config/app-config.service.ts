import { Injectable } from '@nestjs/common';
import type { Env } from './env.schema';

/**
 * Typed, grouped view over the validated environment. Inject this; never read
 * `process.env` anywhere else in the codebase.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly env: Env) {}

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
  get nodeEnv(): Env['NODE_ENV'] {
    return this.env.NODE_ENV;
  }
  get appEnv(): string {
    return this.env.APP_ENV;
  }
  get port(): number {
    return this.env.PORT;
  }
  get logLevel(): Env['LOG_LEVEL'] {
    return this.env.LOG_LEVEL;
  }
  get shareBaseUrl(): string {
    return this.env.SHARE_BASE_URL;
  }

  /**
   * The transaction pooler (:6543), not the direct/session URL. Migrate uses
   * DIRECT_URL instead, via prisma.config.ts — this getter is only ever
   * consumed by PrismaService for the running app's own connection pool.
   */
  get databaseUrl(): string | undefined {
    return this.env.DATABASE_URL;
  }

  get swaggerEnabled(): boolean {
    return this.env.SWAGGER_ENABLED ?? !this.isProduction;
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  get gcp() {
    return {
      projectId: this.env.GCP_PROJECT_ID,
      region: this.env.GCP_REGION,
    };
  }

  get tasks() {
    return {
      transport: this.env.TASK_TRANSPORT,
      queueOutbound: this.env.TASKS_QUEUE_OUTBOUND,
      queuePriority: this.env.TASKS_QUEUE_PRIORITY,
      targetBaseUrl: this.env.TASKS_TARGET_BASE_URL,
      oidcAudience: this.env.TASKS_OIDC_AUDIENCE,
      invokerServiceAccount: this.env.TASKS_INVOKER_SA,
    };
  }

  get twilio() {
    return {
      accountSid: this.env.TWILIO_ACCOUNT_SID,
      authToken: this.env.TWILIO_AUTH_TOKEN,
      whatsappFrom: this.env.TWILIO_WHATSAPP_FROM,
      otpContentSid: this.env.TWILIO_OTP_CONTENT_SID,
    };
  }

  get authCookie() {
    return {
      sameSite: this.env.AUTH_COOKIE_SAME_SITE,
      domain: this.env.AUTH_COOKIE_DOMAIN,
      // SameSite=None is only valid alongside Secure; localhost http breaks
      // if we force Secure there, so it follows sameSite rather than isProduction.
      secure: this.env.AUTH_COOKIE_SAME_SITE === 'none',
    };
  }

  get jwt() {
    return {
      accessSecret: this.env.JWT_ACCESS_SECRET,
      refreshSecret: this.env.JWT_REFRESH_SECRET,
      accessTtl: this.env.JWT_ACCESS_TTL,
      refreshTtl: this.env.JWT_REFRESH_TTL,
    };
  }

  get fieldEncryptionKey(): string | undefined {
    return this.env.FIELD_ENCRYPTION_KEY;
  }

  get gcs() {
    return {
      profilePhotosBucket: this.env.GCS_PROFILE_PHOTOS_BUCKET,
      // Falls back to the profile-photos bucket when no dedicated one is
      // set — the common case is one shared public-read bucket with a
      // `card-logos/` key prefix distinguishing the two; a genuinely
      // separate bucket is a one-var upgrade later, not a prerequisite now.
      cardLogosBucket:
        this.env.GCS_CARD_LOGOS_BUCKET ?? this.env.GCS_PROFILE_PHOTOS_BUCKET,
      // Same fallback reasoning as cardLogosBucket — one shared bucket by
      // default, objects distinguished by the `card-covers/` key prefix.
      cardCoversBucket:
        this.env.GCS_CARD_COVERS_BUCKET ?? this.env.GCS_PROFILE_PHOTOS_BUCKET,
      publicBaseUrl:
        this.env.GCS_PUBLIC_BASE_URL ??
        (this.env.GCS_PROFILE_PHOTOS_BUCKET
          ? `https://storage.googleapis.com/${this.env.GCS_PROFILE_PHOTOS_BUCKET}`
          : undefined),
    };
  }
  get sentryDsn(): string | undefined {
    return this.env.SENTRY_DSN;
  }
}
