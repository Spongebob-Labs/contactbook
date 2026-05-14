-- Split canonical E.164 stored in `users.phone` into `countryCode` + national `phone`.
-- Longer calling codes are applied first.

DROP INDEX IF EXISTS "users_phone_key";

ALTER TABLE "users" ADD COLUMN "countryCode" VARCHAR(8);

UPDATE "users" SET "countryCode" = '+966', "phone" = SUBSTRING("phone" FROM 5) WHERE "phone" LIKE '+966%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+971', "phone" = SUBSTRING("phone" FROM 5) WHERE "phone" LIKE '+971%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+972', "phone" = SUBSTRING("phone" FROM 5) WHERE "phone" LIKE '+972%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+880', "phone" = SUBSTRING("phone" FROM 5) WHERE "phone" LIKE '+880%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+86', "phone" = SUBSTRING("phone" FROM 4) WHERE "phone" LIKE '+86%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+81', "phone" = SUBSTRING("phone" FROM 4) WHERE "phone" LIKE '+81%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+82', "phone" = SUBSTRING("phone" FROM 4) WHERE "phone" LIKE '+82%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+61', "phone" = SUBSTRING("phone" FROM 4) WHERE "phone" LIKE '+61%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+91', "phone" = SUBSTRING("phone" FROM 4) WHERE "phone" LIKE '+91%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+44', "phone" = SUBSTRING("phone" FROM 4) WHERE "phone" LIKE '+44%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+33', "phone" = SUBSTRING("phone" FROM 4) WHERE "phone" LIKE '+33%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+49', "phone" = SUBSTRING("phone" FROM 4) WHERE "phone" LIKE '+49%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+39', "phone" = SUBSTRING("phone" FROM 4) WHERE "phone" LIKE '+39%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+34', "phone" = SUBSTRING("phone" FROM 4) WHERE "phone" LIKE '+34%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+358', "phone" = SUBSTRING("phone" FROM 5) WHERE "phone" LIKE '+358%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+7', "phone" = SUBSTRING("phone" FROM 3) WHERE "phone" LIKE '+7%' AND "countryCode" IS NULL;
UPDATE "users" SET "countryCode" = '+1', "phone" = SUBSTRING("phone" FROM 3) WHERE "phone" LIKE '+1%' AND "countryCode" IS NULL;

-- Rows that did not match a known prefix (or already stored national digits): default NANP.
UPDATE "users" SET "countryCode" = '+1', "phone" = regexp_replace("phone", '^\+', '', 'g') WHERE "countryCode" IS NULL;

ALTER TABLE "users" ALTER COLUMN "countryCode" SET NOT NULL;

CREATE UNIQUE INDEX "users_countryCode_phone_key" ON "users"("countryCode", "phone");
