-- Card privacy, travel profile, write-back metadata, WhatsApp card-access flow

CREATE TYPE "CardVisibility" AS ENUM ('PUBLIC', 'REQUEST_TO_VIEW');
CREATE TYPE "CardAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

ALTER TYPE "WhatsappFlowState" ADD VALUE IF NOT EXISTS 'AWAITING_CARD_ACCESS_APPROVAL';

ALTER TABLE "contact_cards"
  ADD COLUMN "visibility" "CardVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "isSensitive" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "integration_states"
  ADD COLUMN "lastWriteBackAt" TIMESTAMP(3),
  ADD COLUMN "lastWriteBackError" TEXT;

CREATE TABLE "card_access_requests" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "CardAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_access_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "card_access_grants" (
    "cardId" TEXT NOT NULL,
    "granteeId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "card_access_grants_pkey" PRIMARY KEY ("cardId","granteeId")
);

CREATE TABLE "user_travel_profiles" (
    "userId" TEXT NOT NULL,
    "homeCity" TEXT,
    "homeCountry" TEXT,
    "calendarSyncEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_travel_profiles_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "travel_notification_contacts" (
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "travel_notification_contacts_pkey" PRIMARY KEY ("userId","contactId")
);

CREATE TABLE "user_travel_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inTravel" BOOLEAN NOT NULL DEFAULT false,
    "detectedCity" TEXT,
    "detectedCountry" TEXT,
    "promptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_travel_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "card_access_requests_ownerId_status_idx" ON "card_access_requests"("ownerId", "status");
CREATE INDEX "card_access_requests_requesterId_cardId_idx" ON "card_access_requests"("requesterId", "cardId");
CREATE INDEX "user_travel_sessions_userId_updatedAt_idx" ON "user_travel_sessions"("userId", "updatedAt");

ALTER TABLE "card_access_requests" ADD CONSTRAINT "card_access_requests_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "contact_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_access_grants" ADD CONSTRAINT "card_access_grants_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "contact_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_travel_profiles" ADD CONSTRAINT "user_travel_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "travel_notification_contacts" ADD CONSTRAINT "travel_notification_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "travel_notification_contacts" ADD CONSTRAINT "travel_notification_contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_travel_sessions" ADD CONSTRAINT "user_travel_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
