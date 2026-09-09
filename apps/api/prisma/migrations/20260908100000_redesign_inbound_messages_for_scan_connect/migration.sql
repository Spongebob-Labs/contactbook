-- CreateEnum
CREATE TYPE "InboundMessageSource" AS ENUM ('WHATSAPP_MESSAGE', 'QR_SCAN_CONNECT');

-- AlterTable
ALTER TABLE "inbound_messages" ADD COLUMN     "resolvedOwnerId" TEXT,
ADD COLUMN     "source" "InboundMessageSource" NOT NULL DEFAULT 'WHATSAPP_MESSAGE',
ALTER COLUMN "providerMessageId" DROP NOT NULL,
ALTER COLUMN "rawPayload" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "inbound_messages_resolvedOwnerId_idx" ON "inbound_messages"("resolvedOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_messages_fromPhoneE164_toPhoneE164_key" ON "inbound_messages"("fromPhoneE164", "toPhoneE164");

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_resolvedOwnerId_fkey" FOREIGN KEY ("resolvedOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
