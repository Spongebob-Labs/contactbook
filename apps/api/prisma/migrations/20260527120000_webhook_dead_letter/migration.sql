-- CreateEnum
CREATE TYPE "WebhookDlqStatus" AS ENUM ('PENDING', 'RETRYING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "webhook_dead_letters" (
    "id"          TEXT NOT NULL,
    "source"      TEXT NOT NULL DEFAULT 'twilio_whatsapp',
    "payload"     JSONB NOT NULL,
    "headers"     JSONB NOT NULL,
    "webhookUrl"  TEXT NOT NULL,
    "status"      "WebhookDlqStatus" NOT NULL DEFAULT 'PENDING',
    "attempts"    INTEGER NOT NULL DEFAULT 0,
    "lastError"   TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "resolvedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_dead_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_dead_letters_status_nextRetryAt_idx"
    ON "webhook_dead_letters"("status", "nextRetryAt");
