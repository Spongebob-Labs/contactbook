-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill required email + country before tightening constraints
UPDATE "users" SET "email" = lower('legacy+' || "id" || '@contactbook.invalid') WHERE "email" IS NULL;

ALTER TABLE "users" ADD COLUMN "countryCode" CHAR(2) NOT NULL DEFAULT 'US';

ALTER TABLE "users" ALTER COLUMN "countryCode" DROP DEFAULT;

ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
