-- CreateEnum
CREATE TYPE "WhatsappProvider" AS ENUM ('OPENWA');
CREATE TYPE "WhatsappMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "WhatsappMessagePurpose" AS ENUM (
    'OTP',
    'CONNECTION_INVITE',
    'SIGNUP_INVITE',
    'CARD_SELECTION',
    'CONNECTION_UPDATE',
    'TRAVEL_NOTIFICATION',
    'CONVERSATION'
);
CREATE TYPE "WhatsappMessageStatus" AS ENUM (
    'PENDING',
    'SENT',
    'DELIVERED',
    'READ',
    'FAILED',
    'RECEIVED',
    'PROCESSING',
    'PROCESSED'
);

-- AlterTable
ALTER TABLE "otp_sessions" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "webhook_dead_letters" ALTER COLUMN "source" SET DEFAULT 'openwa_whatsapp';

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "provider" "WhatsappProvider" NOT NULL,
    "providerMessageId" TEXT,
    "deduplicationKey" TEXT,
    "eventType" TEXT,
    "direction" "WhatsappMessageDirection" NOT NULL,
    "purpose" "WhatsappMessagePurpose" NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "correlationId" TEXT,
    "status" "WhatsappMessageStatus" NOT NULL DEFAULT 'PENDING',
    "providerErrorCode" TEXT,
    "providerErrorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_messages_deduplicationKey_key"
    ON "whatsapp_messages"("deduplicationKey");
CREATE INDEX "whatsapp_messages_status_createdAt_idx"
    ON "whatsapp_messages"("status", "createdAt");
CREATE INDEX "whatsapp_messages_phoneE164_createdAt_idx"
    ON "whatsapp_messages"("phoneE164", "createdAt");
CREATE INDEX "whatsapp_messages_correlationId_idx"
    ON "whatsapp_messages"("correlationId");
