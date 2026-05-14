-- Generic OAuthAccount columns; table name stays `oauth_accounts`.
ALTER TYPE "OAuthProvider" ADD VALUE 'MICROSOFT';
ALTER TYPE "OAuthProvider" ADD VALUE 'ICLOUD';

ALTER TABLE "oauth_accounts" ADD COLUMN "providerAccountId" TEXT;
ALTER TABLE "oauth_accounts" ADD COLUMN "providerState" JSONB;

UPDATE "oauth_accounts"
SET "providerState" = jsonb_build_object(
  'google',
  jsonb_build_object('calendarSyncToken', to_jsonb("calendarSyncToken"))
)
WHERE "calendarSyncToken" IS NOT NULL;

ALTER TABLE "oauth_accounts" DROP COLUMN "calendarSyncToken";
