-- CreateEnum
CREATE TYPE "CardKind" AS ENUM ('WORK', 'PERSONAL', 'PAYMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RecipientSource" AS ENUM ('QR_SCAN', 'MANUAL', 'INBOUND');

-- CreateEnum
CREATE TYPE "ShareLinkStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "MessagePurpose" ADD VALUE 'CARD_SHARE';

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CardKind" NOT NULL DEFAULT 'CUSTOM',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_fields" (
    "cardId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "labelOverride" TEXT,

    CONSTRAINT "card_fields_pkey" PRIMARY KEY ("cardId","fieldId")
);

-- CreateTable
CREATE TABLE "recipients" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "displayName" TEXT,
    "notes" TEXT,
    "source" "RecipientSource" NOT NULL DEFAULT 'MANUAL',
    "optedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "ShareLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "purpose" "MessagePurpose" NOT NULL,
    "contentSid" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "bodyPreview" TEXT NOT NULL,
    "buttonLabel" TEXT,
    "variableSchema" JSONB NOT NULL,
    "approvalStatus" "TemplateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "rejectionReason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cards_userId_archivedAt_idx" ON "cards"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "card_fields_cardId_visible_position_idx" ON "card_fields"("cardId", "visible", "position");

-- CreateIndex
CREATE INDEX "recipients_ownerId_createdAt_idx" ON "recipients"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "recipients_ownerId_phoneE164_key" ON "recipients"("ownerId", "phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_recipientId_status_idx" ON "share_links"("recipientId", "status");

-- CreateIndex
CREATE INDEX "share_links_cardId_status_idx" ON "share_links"("cardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_cardId_recipientId_key" ON "share_links"("cardId", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_key_key" ON "whatsapp_templates"("key");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_contentSid_key" ON "whatsapp_templates"("contentSid");

-- CreateIndex
CREATE INDEX "whatsapp_templates_purpose_isActive_approvalStatus_idx" ON "whatsapp_templates"("purpose", "isActive", "approvalStatus");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_fields" ADD CONSTRAINT "card_fields_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_fields" ADD CONSTRAINT "card_fields_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "profile_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
