-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "publicToken" TEXT;

-- CreateTable
CREATE TABLE "card_scans" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_scans_cardId_createdAt_idx" ON "card_scans"("cardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cards_publicToken_key" ON "cards"("publicToken");

-- AddForeignKey
ALTER TABLE "card_scans" ADD CONSTRAINT "card_scans_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

