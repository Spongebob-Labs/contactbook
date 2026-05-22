-- Rename ImportSource -> ContactSource and add CALDAV
ALTER TYPE "ImportSource" RENAME TO "ContactSource";
ALTER TYPE "ContactSource" ADD VALUE IF NOT EXISTS 'CALDAV';

-- Rename legacy table
ALTER TABLE "contact_imports" RENAME TO "contacts";

-- New scalar columns
ALTER TABLE "contacts" ADD COLUMN "sourceRevision" TEXT;
ALTER TABLE "contacts" ADD COLUMN "displayName" TEXT;
ALTER TABLE "contacts" ADD COLUMN "middleName" TEXT;
ALTER TABLE "contacts" ADD COLUMN "namePrefix" TEXT;
ALTER TABLE "contacts" ADD COLUMN "nameSuffix" TEXT;
ALTER TABLE "contacts" ADD COLUMN "nickname" TEXT;
ALTER TABLE "contacts" ADD COLUMN "notes" TEXT;
ALTER TABLE "contacts" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill displayName from names where possible
UPDATE "contacts"
SET "displayName" = TRIM(CONCAT(COALESCE("firstName", ''), ' ', COALESCE("lastName", '')))
WHERE "displayName" IS NULL
  AND ("firstName" IS NOT NULL OR "lastName" IS NOT NULL);

-- Ensure externalId is non-null for unique constraint
UPDATE "contacts" SET "externalId" = "id" WHERE "externalId" IS NULL;
ALTER TABLE "contacts" ALTER COLUMN "externalId" SET NOT NULL;

-- Child tables
CREATE TABLE "contact_phones" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "contact_phones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_emails" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "contact_emails_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_organizations" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyName" TEXT,
    "department" TEXT,
    "title" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "contact_organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_addresses" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "street" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "contact_addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_urls" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "contact_urls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_phones_contactId_idx" ON "contact_phones"("contactId");
CREATE INDEX "contact_emails_contactId_idx" ON "contact_emails"("contactId");
CREATE INDEX "contact_organizations_contactId_idx" ON "contact_organizations"("contactId");
CREATE INDEX "contact_addresses_contactId_idx" ON "contact_addresses"("contactId");
CREATE INDEX "contact_urls_contactId_idx" ON "contact_urls"("contactId");

ALTER TABLE "contact_phones" ADD CONSTRAINT "contact_phones_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_emails" ADD CONSTRAINT "contact_emails_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_organizations" ADD CONSTRAINT "contact_organizations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_addresses" ADD CONSTRAINT "contact_addresses_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_urls" ADD CONSTRAINT "contact_urls_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate primary phone/email from legacy columns
INSERT INTO "contact_phones" ("id", "contactId", "value", "isPrimary", "sortOrder")
SELECT gen_random_uuid()::text, "id", "mainPhone", true, 0
FROM "contacts"
WHERE "mainPhone" IS NOT NULL AND TRIM("mainPhone") <> '';

INSERT INTO "contact_emails" ("id", "contactId", "value", "isPrimary", "sortOrder")
SELECT gen_random_uuid()::text, "id", "mainEmail", true, 0
FROM "contacts"
WHERE "mainEmail" IS NOT NULL AND TRIM("mainEmail") <> '';

-- Drop legacy JSON and redundant columns
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "mainPhone";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "mainEmail";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "rawJson";

CREATE INDEX "contacts_userId_displayName_idx" ON "contacts"("userId", "displayName");
