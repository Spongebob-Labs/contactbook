-- CreateEnum
CREATE TYPE "FieldCategory" AS ENUM ('IDENTITY', 'PERSONAL', 'WORK', 'BUSINESS', 'SOCIAL', 'FINANCIAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('PHONE', 'LANDLINE', 'FAX', 'EMAIL', 'ADDRESS', 'URL', 'SOCIAL_LINK', 'PHOTO', 'TEXT', 'DATE', 'JOB_TITLE', 'COMPANY', 'REG_NUMBER', 'DEPARTMENT', 'RELATION', 'STATUS', 'LOCATION_TRACKING', 'BANK_ACCOUNT', 'DIGITAL_WALLET', 'CRYPTO_WALLET', 'CUSTOM');

-- CreateTable
CREATE TABLE "profile_fields" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FieldCategory" NOT NULL,
    "type" "FieldType" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_fields_userId_archivedAt_position_idx" ON "profile_fields"("userId", "archivedAt", "position");

-- AddForeignKey
ALTER TABLE "profile_fields" ADD CONSTRAINT "profile_fields_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
