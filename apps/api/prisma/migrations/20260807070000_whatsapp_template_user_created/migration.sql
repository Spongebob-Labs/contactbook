-- User-created share templates: ownership column. NULL = global (visible to all);
-- set = visible/sendable only by the creator. Restrict blocks user deletion while
-- they own templates (batches reference templates with Restrict already).

-- AlterTable
ALTER TABLE "whatsapp_templates" ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "whatsapp_templates_createdByUserId_idx" ON "whatsapp_templates"("createdByUserId");

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
