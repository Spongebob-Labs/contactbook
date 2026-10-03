-- CreateTable
CREATE TABLE "wallet_registrations" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "deviceLibraryId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_registrations_cardId_idx" ON "wallet_registrations"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_registrations_deviceLibraryId_cardId_key" ON "wallet_registrations"("deviceLibraryId", "cardId");

-- AddForeignKey
ALTER TABLE "wallet_registrations" ADD CONSTRAINT "wallet_registrations_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
