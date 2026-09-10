-- CreateEnum
CREATE TYPE "InboundMessageSource" AS ENUM ('WHATSAPP_MESSAGE', 'QR_SCAN_CONNECT');

-- AlterTable
ALTER TABLE "inbound_messages" ADD COLUMN     "resolvedOwnerId" TEXT,
ADD COLUMN     "source" "InboundMessageSource" NOT NULL DEFAULT 'WHATSAPP_MESSAGE',
ALTER COLUMN "providerMessageId" DROP NOT NULL,
ALTER COLUMN "rawPayload" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "inbound_messages_resolvedOwnerId_idx" ON "inbound_messages"("resolvedOwnerId");

-- Defensive dedup: this table has been live since 20260905090000 and has had
-- real Twilio webhook traffic since — a phone messaging our number twice
-- produces two rows under the OLD schema (deduped only on exact
-- MessageSid), which the new (fromPhoneE164, toPhoneE164) unique constraint
-- below would reject outright. Collapse any existing duplicate pairs down to
-- their earliest row first, so this migration is safe against whatever real
-- data is already in a shared environment, not just an empty local table.
DELETE FROM "inbound_messages"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("fromPhoneE164", "toPhoneE164") "id"
  FROM "inbound_messages"
  ORDER BY "fromPhoneE164", "toPhoneE164", "receivedAt" ASC, "id" ASC
);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_messages_fromPhoneE164_toPhoneE164_key" ON "inbound_messages"("fromPhoneE164", "toPhoneE164");

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_resolvedOwnerId_fkey" FOREIGN KEY ("resolvedOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
