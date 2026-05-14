-- DropIndex
DROP INDEX IF EXISTS "users_phone_key";

-- CreateIndex
CREATE UNIQUE INDEX "users_countryCode_phone_key" ON "users"("countryCode", "phone");
