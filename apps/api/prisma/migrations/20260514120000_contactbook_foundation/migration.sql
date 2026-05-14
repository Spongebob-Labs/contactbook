-- CreateEnum
CREATE TYPE "FieldCategory" AS ENUM ('IDENTITY', 'PERSONAL', 'WORK', 'BUSINESS', 'SOCIAL', 'FINANCIAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('PHONE', 'LANDLINE', 'FAX', 'EMAIL', 'ADDRESS', 'URL', 'SOCIAL_LINK', 'PHOTO', 'TEXT', 'DATE', 'JOB_TITLE', 'COMPANY', 'REG_NUMBER', 'DEPARTMENT', 'RELATION', 'STATUS', 'LOCATION_TRACKING', 'BANK_ACCOUNT', 'DIGITAL_WALLET', 'CRYPTO_WALLET', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('BUSINESS', 'PERSONAL', 'PAYMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('GOOGLE', 'ICLOUD', 'CSV', 'VCARD');

-- AlterEnum
BEGIN;
CREATE TYPE "ConnectionStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
ALTER TABLE "public"."connections" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "connections" ALTER COLUMN "status" TYPE "ConnectionStatus_new" USING ("status"::text::"ConnectionStatus_new");
ALTER TYPE "ConnectionStatus" RENAME TO "ConnectionStatus_old";
ALTER TYPE "ConnectionStatus_new" RENAME TO "ConnectionStatus";
DROP TYPE "public"."ConnectionStatus_old";
ALTER TABLE "connections" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "WhatsappFlowState_new" AS ENUM ('IDLE', 'AWAITING_CONNECTION_ACCEPT');
ALTER TABLE "public"."whatsapp_sessions" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "whatsapp_sessions" ALTER COLUMN "state" TYPE "WhatsappFlowState_new" USING ("state"::text::"WhatsappFlowState_new");
ALTER TYPE "WhatsappFlowState" RENAME TO "WhatsappFlowState_old";
ALTER TYPE "WhatsappFlowState_new" RENAME TO "WhatsappFlowState";
DROP TYPE "public"."WhatsappFlowState_old";
ALTER TABLE "whatsapp_sessions" ALTER COLUMN "state" SET DEFAULT 'IDLE';
COMMIT;

-- DropForeignKey
ALTER TABLE "connections" DROP CONSTRAINT "connections_initiatorId_fkey";

-- DropForeignKey
ALTER TABLE "connections" DROP CONSTRAINT "connections_initiatorSharedCardId_fkey";

-- DropForeignKey
ALTER TABLE "connections" DROP CONSTRAINT "connections_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "connections" DROP CONSTRAINT "connections_recipientSharedCardId_fkey";

-- DropForeignKey
ALTER TABLE "contact_card_tags" DROP CONSTRAINT "contact_card_tags_contactCardId_fkey";

-- DropForeignKey
ALTER TABLE "contact_card_tags" DROP CONSTRAINT "contact_card_tags_tagId_fkey";

-- DropForeignKey
ALTER TABLE "profile_fields" DROP CONSTRAINT "profile_fields_contactCardId_fkey";

-- DropForeignKey
ALTER TABLE "sensitive_field_access_requests" DROP CONSTRAINT "sensitive_field_access_requests_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "sensitive_field_access_requests" DROP CONSTRAINT "sensitive_field_access_requests_profileFieldId_fkey";

-- DropForeignKey
ALTER TABLE "sensitive_field_access_requests" DROP CONSTRAINT "sensitive_field_access_requests_requesterId_fkey";

-- DropIndex
DROP INDEX "connections_initiatorId_status_idx";

-- DropIndex
DROP INDEX "connections_recipientId_status_idx";

-- DropIndex
DROP INDEX "contact_imports_userId_source_externalResourceName_key";

-- DropIndex
DROP INDEX "profile_fields_contactCardId_idx";

-- DropIndex
DROP INDEX "tags_userId_slug_key";

-- DropIndex
DROP INDEX "travel_events_userId_calendarEventId_key";

-- DropIndex
DROP INDEX "travel_events_userId_start_idx";

-- DropIndex
DROP INDEX "users_countryCode_phone_key";

-- AlterTable
ALTER TABLE "connections" DROP COLUMN "acceptedAt",
DROP COLUMN "initiatorId",
DROP COLUMN "initiatorSharedCardId",
DROP COLUMN "recipientId",
DROP COLUMN "recipientSharedCardId",
DROP COLUMN "shareExpiresAt",
ADD COLUMN     "hasSharedBack" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiverId" TEXT NOT NULL,
ADD COLUMN     "requesterId" TEXT NOT NULL,
ADD COLUMN     "sharedCardId" TEXT;

-- AlterTable
ALTER TABLE "contact_cards" DROP COLUMN "isArchived",
DROP COLUMN "sortOrder",
ADD COLUMN     "type" "CardType" NOT NULL DEFAULT 'CUSTOM';

-- AlterTable
ALTER TABLE "contact_imports" DROP COLUMN "displayNameSnapshot",
DROP COLUMN "errorMessage",
DROP COLUMN "etag",
DROP COLUMN "externalResourceName",
DROP COLUMN "lastSyncedAt",
DROP COLUMN "processedAt",
DROP COLUMN "rawPerson",
DROP COLUMN "status",
DROP COLUMN "updatedAt",
DROP COLUMN "userOverrides",
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "mainEmail" TEXT,
ADD COLUMN     "mainPhone" TEXT,
ADD COLUMN     "rawJson" JSONB,
DROP COLUMN "source",
ADD COLUMN     "source" "ImportSource" NOT NULL;

-- AlterTable
ALTER TABLE "oauth_accounts" DROP COLUMN "createdAt",
DROP COLUMN "peopleSyncToken",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "profile_fields" DROP COLUMN "contactCardId",
DROP COLUMN "key",
DROP COLUMN "metadata",
DROP COLUMN "sortOrder",
DROP COLUMN "valueType",
ADD COLUMN     "groupId" TEXT NOT NULL,
ADD COLUMN     "type" "FieldType" NOT NULL,
ALTER COLUMN "label" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tags" DROP COLUMN "createdAt",
DROP COLUMN "slug",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "travel_events" DROP COLUMN "calendarEventId",
DROP COLUMN "detectedAt",
DROP COLUMN "end",
DROP COLUMN "location",
DROP COLUMN "source",
DROP COLUMN "start",
DROP COLUMN "timeZone",
DROP COLUMN "updatedAt",
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "externalCalendarEventId" TEXT,
ADD COLUMN     "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifiedContacts" JSONB,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "city" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "countryCode",
DROP COLUMN "name",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL;

-- DropTable
DROP TABLE "contact_card_tags";

-- DropTable
DROP TABLE "sensitive_field_access_requests";

-- DropEnum
DROP TYPE "ContactImportSource";

-- DropEnum
DROP TYPE "ContactImportStatus";

-- DropEnum
DROP TYPE "FieldAccessRequestStatus";

-- DropEnum
DROP TYPE "ProfileFieldValueType";

-- DropEnum
DROP TYPE "TravelEventSource";

-- CreateTable
CREATE TABLE "field_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FieldCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_field_mappings" (
    "cardId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,

    CONSTRAINT "card_field_mappings_pkey" PRIMARY KEY ("cardId","fieldId")
);

-- CreateTable
CREATE TABLE "address_details" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT NOT NULL,

    CONSTRAINT "address_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_account_details" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "iban" TEXT,
    "swiftBic" TEXT,
    "routingNumber" TEXT,
    "ifsc" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "bank_account_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_wallet_details" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handleOrLink" TEXT NOT NULL,

    CONSTRAINT "digital_wallet_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto_wallet_details" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "crypto_wallet_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL,
    "syncToken" TEXT,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ConnectionToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ConnectionToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "field_groups_userId_category_idx" ON "field_groups"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "address_details_fieldId_key" ON "address_details"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_account_details_fieldId_key" ON "bank_account_details"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "digital_wallet_details_fieldId_key" ON "digital_wallet_details"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_wallet_details_fieldId_key" ON "crypto_wallet_details"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_states_userId_source_key" ON "integration_states"("userId", "source");

-- CreateIndex
CREATE INDEX "_ConnectionToTag_B_index" ON "_ConnectionToTag"("B");

-- CreateIndex
CREATE INDEX "connections_requesterId_status_idx" ON "connections"("requesterId", "status");

-- CreateIndex
CREATE INDEX "connections_receiverId_status_idx" ON "connections"("receiverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connections_requesterId_receiverId_key" ON "connections"("requesterId", "receiverId");

-- CreateIndex
CREATE INDEX "contact_imports_userId_source_deletedAt_idx" ON "contact_imports"("userId", "source", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "contact_imports_userId_source_externalId_key" ON "contact_imports"("userId", "source", "externalId");

-- CreateIndex
CREATE INDEX "profile_fields_groupId_idx" ON "profile_fields"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_userId_name_key" ON "tags"("userId", "name");

-- CreateIndex
CREATE INDEX "travel_events_userId_startDate_idx" ON "travel_events"("userId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "travel_events_userId_externalCalendarEventId_key" ON "travel_events"("userId", "externalCalendarEventId");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- AddForeignKey
ALTER TABLE "field_groups" ADD CONSTRAINT "field_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_fields" ADD CONSTRAINT "profile_fields_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "field_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_field_mappings" ADD CONSTRAINT "card_field_mappings_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "contact_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_field_mappings" ADD CONSTRAINT "card_field_mappings_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "profile_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_sharedCardId_fkey" FOREIGN KEY ("sharedCardId") REFERENCES "contact_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_details" ADD CONSTRAINT "address_details_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "profile_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account_details" ADD CONSTRAINT "bank_account_details_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "profile_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_wallet_details" ADD CONSTRAINT "digital_wallet_details_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "profile_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_wallet_details" ADD CONSTRAINT "crypto_wallet_details_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "profile_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_states" ADD CONSTRAINT "integration_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConnectionToTag" ADD CONSTRAINT "_ConnectionToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConnectionToTag" ADD CONSTRAINT "_ConnectionToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
