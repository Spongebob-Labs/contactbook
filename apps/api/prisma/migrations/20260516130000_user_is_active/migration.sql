-- AlterTable
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users" SET "isActive" = true WHERE "phoneVerifiedAt" IS NOT NULL;

ALTER TABLE "users" DROP COLUMN "phoneVerifiedAt",
DROP COLUMN "jobTitle",
DROP COLUMN "company";
