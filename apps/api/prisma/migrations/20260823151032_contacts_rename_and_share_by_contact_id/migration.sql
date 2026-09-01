-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('MANUAL', 'IMPORTED', 'QR_SCAN', 'INBOUND');

-- DropForeignKey
ALTER TABLE "recipients" DROP CONSTRAINT "recipients_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "share_links" DROP CONSTRAINT "share_links_recipientId_fkey";

-- DropIndex
DROP INDEX "share_links_cardId_recipientId_key";

-- DropIndex
DROP INDEX "share_links_recipientId_status_idx";

-- AlterTable
ALTER TABLE "share_links" DROP COLUMN "recipientId",
ADD COLUMN     "contactId" TEXT NOT NULL;

-- DropTable
DROP TABLE "recipients";

-- DropEnum
DROP TYPE "RecipientSource";

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "displayName" TEXT,
    "notes" TEXT,
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
    "optedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_ownerId_createdAt_idx" ON "contacts"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_ownerId_phoneE164_key" ON "contacts"("ownerId", "phoneE164");

-- CreateIndex
CREATE INDEX "share_links_contactId_status_idx" ON "share_links"("contactId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_cardId_contactId_key" ON "share_links"("cardId", "contactId");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

