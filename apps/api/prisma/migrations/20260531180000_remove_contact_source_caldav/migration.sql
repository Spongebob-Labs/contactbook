-- Remove CALDAV from ContactSource (CalDAV is the iCloud sync protocol; use ICLOUD).

UPDATE "contacts" caldav
SET "deletedAt" = NOW()
WHERE caldav."source" = 'CALDAV'
  AND caldav."deletedAt" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "contacts" icloud
    WHERE icloud."userId" = caldav."userId"
      AND icloud."source" = 'ICLOUD'
      AND icloud."externalId" = caldav."externalId"
      AND icloud."deletedAt" IS NULL
  );

DELETE FROM "contact_provider_links" caldav
WHERE caldav."source" = 'CALDAV'
  AND EXISTS (
    SELECT 1
    FROM "contact_provider_links" icloud
    WHERE icloud."userId" = caldav."userId"
      AND icloud."source" = 'ICLOUD'
      AND icloud."externalId" = caldav."externalId"
  );

DELETE FROM "contact_groups" caldav
WHERE caldav."source" = 'CALDAV'
  AND EXISTS (
    SELECT 1
    FROM "contact_groups" icloud
    WHERE icloud."userId" = caldav."userId"
      AND icloud."source" = 'ICLOUD'
      AND icloud."externalId" IS NOT DISTINCT FROM caldav."externalId"
  );

DELETE FROM "integration_states" caldav
WHERE caldav."source" = 'CALDAV'
  AND EXISTS (
    SELECT 1
    FROM "integration_states" icloud
    WHERE icloud."userId" = caldav."userId"
      AND icloud."source" = 'ICLOUD'
  );

CREATE TYPE "ContactSource_new" AS ENUM (
  'GOOGLE',
  'ICLOUD',
  'VCARD',
  'CONTACTBOOK'
);

ALTER TABLE "contacts"
  ALTER COLUMN "source" TYPE "ContactSource_new"
  USING (
    CASE
      WHEN "source"::text = 'CALDAV' THEN 'ICLOUD'::"ContactSource_new"
      ELSE "source"::text::"ContactSource_new"
    END
  );

ALTER TABLE "integration_states"
  ALTER COLUMN "source" TYPE "ContactSource_new"
  USING (
    CASE
      WHEN "source"::text = 'CALDAV' THEN 'ICLOUD'::"ContactSource_new"
      ELSE "source"::text::"ContactSource_new"
    END
  );

ALTER TABLE "contact_provider_links"
  ALTER COLUMN "source" TYPE "ContactSource_new"
  USING (
    CASE
      WHEN "source"::text = 'CALDAV' THEN 'ICLOUD'::"ContactSource_new"
      ELSE "source"::text::"ContactSource_new"
    END
  );

ALTER TABLE "contact_groups"
  ALTER COLUMN "source" TYPE "ContactSource_new"
  USING (
    CASE
      WHEN "source"::text = 'CALDAV' THEN 'ICLOUD'::"ContactSource_new"
      ELSE "source"::text::"ContactSource_new"
    END
  );

DROP TYPE "ContactSource";
ALTER TYPE "ContactSource_new" RENAME TO "ContactSource";
