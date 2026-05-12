-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ContactImportSource" AS ENUM ('GOOGLE', 'ICLOUD', 'CSV');

-- CreateEnum
CREATE TYPE "ContactImportStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ProfileFieldValueType" AS ENUM ('STRING', 'URL', 'PHONE', 'EMAIL', 'JSON');

-- CreateEnum
CREATE TYPE "FieldAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TravelEventSource" AS ENUM ('GOOGLE_CALENDAR');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "WhatsappFlowState" AS ENUM ('IDLE', 'AWAITING_CONNECTION_ACCEPT', 'AWAITING_SENSITIVE_FIELD_APPROVAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "jobTitle" TEXT,
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_fields" (
    "id" TEXT NOT NULL,
    "contactCardId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "valueType" "ProfileFieldValueType" NOT NULL DEFAULT 'STRING',
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_card_tags" (
    "contactCardId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "contact_card_tags_pkey" PRIMARY KEY ("contactCardId","tagId")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "initiatorSharedCardId" TEXT NOT NULL,
    "recipientSharedCardId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "shareExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_imports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ContactImportSource" NOT NULL,
    "status" "ContactImportStatus" NOT NULL DEFAULT 'PENDING',
    "externalResourceName" TEXT NOT NULL,
    "etag" TEXT,
    "displayNameSnapshot" TEXT,
    "rawPerson" JSONB NOT NULL,
    "userOverrides" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "scopes" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "peopleSyncToken" TEXT,
    "calendarSyncToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "TravelEventSource" NOT NULL DEFAULT 'GOOGLE_CALENDAR',
    "calendarEventId" TEXT NOT NULL,
    "title" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "city" TEXT,
    "location" TEXT,
    "timeZone" TEXT,
    "raw" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whatsappSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_field_access_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "profileFieldId" TEXT NOT NULL,
    "status" "FieldAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "twilioCorrelationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensitive_field_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phoneE164" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phoneE164" TEXT NOT NULL,
    "state" "WhatsappFlowState" NOT NULL DEFAULT 'IDLE',
    "connectionId" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "contact_cards_userId_idx" ON "contact_cards"("userId");

-- CreateIndex
CREATE INDEX "profile_fields_contactCardId_idx" ON "profile_fields"("contactCardId");

-- CreateIndex
CREATE INDEX "tags_userId_idx" ON "tags"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_userId_slug_key" ON "tags"("userId", "slug");

-- CreateIndex
CREATE INDEX "connections_initiatorId_status_idx" ON "connections"("initiatorId", "status");

-- CreateIndex
CREATE INDEX "connections_recipientId_status_idx" ON "connections"("recipientId", "status");

-- CreateIndex
CREATE INDEX "contact_imports_userId_source_deletedAt_idx" ON "contact_imports"("userId", "source", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "contact_imports_userId_source_externalResourceName_key" ON "contact_imports"("userId", "source", "externalResourceName");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_userId_provider_key" ON "oauth_accounts"("userId", "provider");

-- CreateIndex
CREATE INDEX "travel_events_userId_start_idx" ON "travel_events"("userId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "travel_events_userId_calendarEventId_key" ON "travel_events"("userId", "calendarEventId");

-- CreateIndex
CREATE INDEX "sensitive_field_access_requests_ownerId_status_idx" ON "sensitive_field_access_requests"("ownerId", "status");

-- CreateIndex
CREATE INDEX "sensitive_field_access_requests_profileFieldId_idx" ON "sensitive_field_access_requests"("profileFieldId");

-- CreateIndex
CREATE INDEX "otp_sessions_phoneE164_expiresAt_idx" ON "otp_sessions"("phoneE164", "expiresAt");

-- CreateIndex
CREATE INDEX "whatsapp_sessions_phoneE164_state_idx" ON "whatsapp_sessions"("phoneE164", "state");

-- AddForeignKey
ALTER TABLE "contact_cards" ADD CONSTRAINT "contact_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_fields" ADD CONSTRAINT "profile_fields_contactCardId_fkey" FOREIGN KEY ("contactCardId") REFERENCES "contact_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_card_tags" ADD CONSTRAINT "contact_card_tags_contactCardId_fkey" FOREIGN KEY ("contactCardId") REFERENCES "contact_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_card_tags" ADD CONSTRAINT "contact_card_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_initiatorSharedCardId_fkey" FOREIGN KEY ("initiatorSharedCardId") REFERENCES "contact_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_recipientSharedCardId_fkey" FOREIGN KEY ("recipientSharedCardId") REFERENCES "contact_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_imports" ADD CONSTRAINT "contact_imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_events" ADD CONSTRAINT "travel_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_field_access_requests" ADD CONSTRAINT "sensitive_field_access_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_field_access_requests" ADD CONSTRAINT "sensitive_field_access_requests_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_field_access_requests" ADD CONSTRAINT "sensitive_field_access_requests_profileFieldId_fkey" FOREIGN KEY ("profileFieldId") REFERENCES "profile_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_sessions" ADD CONSTRAINT "otp_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
