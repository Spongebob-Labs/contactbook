-- Deploy-order warning: this migration will FAIL if any "cards" row still has
-- a NULL "publicToken". It must not reach `prisma migrate deploy` in the same
-- release as 20260828120000_add_card_public_token_nullable — run
-- scripts/backfill-card-public-tokens.ts against the target database after
-- that migration lands and before this one does. See that migration's sibling
-- folder and apps/api/scripts/backfill-card-public-tokens.ts for the full
-- nullable -> backfill -> required sequence this is part of.

-- AlterTable
ALTER TABLE "cards" ALTER COLUMN "publicToken" SET NOT NULL;

