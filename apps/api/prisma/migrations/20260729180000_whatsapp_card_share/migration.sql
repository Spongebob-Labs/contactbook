-- CreateEnum
CREATE TYPE "WhatsappTemplateUseCase" AS ENUM ('CARD_SHARE', 'OTP', 'CONNECTION_INVITE');

-- CreateEnum
CREATE TYPE "CardShareDispatchStatus" AS ENUM ('PENDING', 'RETRYING', 'DISPATCHED', 'FAILED');

-- AlterEnum
ALTER TYPE "WhatsappProvider" ADD VALUE 'TWILIO';

-- AlterEnum
ALTER TYPE "WhatsappMessagePurpose" ADD VALUE 'CARD_SHARE';

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "useCase" "WhatsappTemplateUseCase" NOT NULL,
    "contentSid" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "bodyPreview" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vcard_assets" (
    "id" TEXT NOT NULL,
    "cardId" TEXT,
    "contentHash" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'text/vcard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vcard_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_share_batches" (
    "id" TEXT NOT NULL,
    "cardId" TEXT,
    "cardNameSnapshot" TEXT NOT NULL,
    "cardTypeSnapshot" "CardType" NOT NULL,
    "senderId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "vcardAssetId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_share_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_share_recipients" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "recipientCountryCode" VARCHAR(8) NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "recipientContactId" TEXT,
    "dispatchStatus" "CardShareDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "dispatchAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDispatchError" TEXT,
    "whatsappMessageId" TEXT,
    "deliveryStatus" "WhatsappMessageStatus",
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_share_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_key_key" ON "whatsapp_templates"("key");

-- CreateIndex
CREATE INDEX "whatsapp_templates_useCase_isActive_isDefault_idx" ON "whatsapp_templates"("useCase", "isActive", "isDefault");

-- CreateIndex
CREATE INDEX "vcard_assets_cardId_idx" ON "vcard_assets"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "vcard_assets_cardId_contentHash_key" ON "vcard_assets"("cardId", "contentHash");

-- CreateIndex
CREATE INDEX "card_share_batches_cardId_idx" ON "card_share_batches"("cardId");

-- CreateIndex
CREATE INDEX "card_share_batches_senderId_createdAt_idx" ON "card_share_batches"("senderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "card_share_recipients_whatsappMessageId_key" ON "card_share_recipients"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "card_share_recipients_dispatchStatus_nextAttemptAt_idx" ON "card_share_recipients"("dispatchStatus", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "card_share_recipients_recipientCountryCode_recipientPhone_idx" ON "card_share_recipients"("recipientCountryCode", "recipientPhone");

-- CreateIndex
CREATE UNIQUE INDEX "card_share_recipients_batchId_recipientCountryCode_recipien_key" ON "card_share_recipients"("batchId", "recipientCountryCode", "recipientPhone");

-- AddForeignKey
ALTER TABLE "vcard_assets" ADD CONSTRAINT "vcard_assets_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "contact_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_share_batches" ADD CONSTRAINT "card_share_batches_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "contact_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_share_batches" ADD CONSTRAINT "card_share_batches_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_share_batches" ADD CONSTRAINT "card_share_batches_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "whatsapp_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_share_batches" ADD CONSTRAINT "card_share_batches_vcardAssetId_fkey" FOREIGN KEY ("vcardAssetId") REFERENCES "vcard_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_share_recipients" ADD CONSTRAINT "card_share_recipients_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "card_share_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_share_recipients" ADD CONSTRAINT "card_share_recipients_recipientContactId_fkey" FOREIGN KEY ("recipientContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_share_recipients" ADD CONSTRAINT "card_share_recipients_whatsappMessageId_fkey" FOREIGN KEY ("whatsappMessageId") REFERENCES "whatsapp_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

