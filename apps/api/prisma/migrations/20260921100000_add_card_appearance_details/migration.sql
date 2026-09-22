-- AlterTable: add the new nullable columns and the two new defaults first —
-- none of this needs a backfill.
ALTER TABLE "cards" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "headline" TEXT,
ALTER COLUMN "finish" SET DEFAULT 'gradient',
ALTER COLUMN "texture" SET DEFAULT 'none';

-- Backfill BEFORE constraining templateId NOT NULL — every card written
-- before this migration has templateId = NULL (it was nullable, no
-- back-populating happened at write time). Skipping this step and going
-- straight to SET NOT NULL would fail the exact way the earlier
-- publicToken migration did (see check-not-null-migrations.ts).
UPDATE "cards" SET "templateId" = 'meridian' WHERE "templateId" IS NULL;

ALTER TABLE "cards" ALTER COLUMN "templateId" SET NOT NULL,
ALTER COLUMN "templateId" SET DEFAULT 'meridian';
