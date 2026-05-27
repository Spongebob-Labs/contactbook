-- ContactSource: CONTACTBOOK
ALTER TYPE "ContactSource" ADD VALUE IF NOT EXISTS 'CONTACTBOOK';

-- WhatsappFlowState: card selection states
ALTER TYPE "WhatsappFlowState" ADD VALUE IF NOT EXISTS 'AWAITING_RECIPIENT_CARD_SELECTION';
ALTER TYPE "WhatsappFlowState" ADD VALUE IF NOT EXISTS 'AWAITING_REQUESTER_CARD_SELECTION';

-- ConnectionInvite enums
CREATE TYPE "ConnectionInviteRecipientKind" AS ENUM ('CONTACT', 'EXTERNAL');
CREATE TYPE "ConnectionInviteStatus" AS ENUM ('PENDING', 'DECLINED', 'CONVERTED');

-- Connection: rename shared card column and add receiver card
ALTER TABLE "connections" RENAME COLUMN "sharedCardId" TO "requester_shared_card_id";
ALTER TABLE "connections" ADD COLUMN "receiver_shared_card_id" TEXT;

ALTER TABLE "connections" DROP CONSTRAINT IF EXISTS "connections_sharedCardId_fkey";
ALTER TABLE "connections" ADD CONSTRAINT "connections_requester_shared_card_id_fkey"
  FOREIGN KEY ("requester_shared_card_id") REFERENCES "contact_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connections" ADD CONSTRAINT "connections_receiver_shared_card_id_fkey"
  FOREIGN KEY ("receiver_shared_card_id") REFERENCES "contact_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ConnectionInvite table
CREATE TABLE "connection_invites" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "recipientKind" "ConnectionInviteRecipientKind" NOT NULL,
    "recipientContactId" TEXT,
    "recipientCountryCode" VARCHAR(8) NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "status" "ConnectionInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_invites_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "connection_invites_requesterId_recipientCountryCode_recipien_idx"
  ON "connection_invites"("requesterId", "recipientCountryCode", "recipientPhone");
CREATE INDEX "connection_invites_requesterId_recipientContactId_idx"
  ON "connection_invites"("requesterId", "recipientContactId");

ALTER TABLE "connection_invites" ADD CONSTRAINT "connection_invites_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
