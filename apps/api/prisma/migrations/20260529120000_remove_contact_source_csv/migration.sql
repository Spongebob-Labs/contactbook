-- Remove CSV from ContactSource enum (no CSV contacts expected in production).

CREATE TYPE "ContactSource_new" AS ENUM (
  'GOOGLE',
  'ICLOUD',
  'VCARD',
  'CALDAV',
  'CONTACTBOOK'
);

ALTER TABLE "contacts"
  ALTER COLUMN "source" TYPE "ContactSource_new"
  USING (
    CASE
      WHEN "source"::text = 'CSV' THEN 'VCARD'::"ContactSource_new"
      ELSE "source"::text::"ContactSource_new"
    END
  );

ALTER TABLE "integration_states"
  ALTER COLUMN "source" TYPE "ContactSource_new"
  USING (
    CASE
      WHEN "source"::text = 'CSV' THEN 'VCARD'::"ContactSource_new"
      ELSE "source"::text::"ContactSource_new"
    END
  );

DROP TYPE "ContactSource";
ALTER TYPE "ContactSource_new" RENAME TO "ContactSource";
