-- Strict 1:1 card<->template mapping + DB<->Twilio sync state.
--
-- NOTE: the unique index on "contentSid" will fail if duplicates exist. Check first:
--   SELECT "contentSid" FROM "whatsapp_templates" GROUP BY 1 HAVING count(*) > 1;

-- CreateEnum
CREATE TYPE "WhatsappTemplateApprovalStatus" AS ENUM ('APPROVED', 'PENDING', 'RECEIVED', 'REJECTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WhatsappTemplateSyncStatus" AS ENUM ('NEVER_SYNCED', 'IN_SYNC', 'DRIFT_REPAIRED', 'MISSING_ON_TWILIO', 'SYNC_ERROR');

-- AlterTable
ALTER TABLE "whatsapp_templates"
  ADD COLUMN "buttonTitle" TEXT NOT NULL DEFAULT 'Save Contact',
  ADD COLUMN "headerImageUrl" TEXT,
  ADD COLUMN "approvalStatus" "WhatsappTemplateApprovalStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "syncStatus" "WhatsappTemplateSyncStatus" NOT NULL DEFAULT 'NEVER_SYNCED',
  ADD COLUMN "syncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_contentSid_key" ON "whatsapp_templates"("contentSid");

-- DropIndex
DROP INDEX "whatsapp_templates_useCase_isActive_isDefault_idx";

-- CreateIndex
CREATE INDEX "whatsapp_templates_useCase_isActive_approvalStatus_idx" ON "whatsapp_templates"("useCase", "isActive", "approvalStatus");
