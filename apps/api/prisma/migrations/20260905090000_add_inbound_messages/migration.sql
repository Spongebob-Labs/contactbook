-- CreateTable
CREATE TABLE "inbound_messages" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "providerMessageId" TEXT NOT NULL,
    "fromPhoneE164" TEXT NOT NULL,
    "toPhoneE164" TEXT NOT NULL,
    "body" TEXT,
    "profileName" TEXT,
    "rawPayload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_messages_providerMessageId_key" ON "inbound_messages"("providerMessageId");

-- CreateIndex
CREATE INDEX "inbound_messages_fromPhoneE164_receivedAt_idx" ON "inbound_messages"("fromPhoneE164", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "inbound_messages_receivedAt_idx" ON "inbound_messages"("receivedAt" DESC);

