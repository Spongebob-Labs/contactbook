-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "share_links" ADD COLUMN     "lastNotifiedVersion" INTEGER;

-- CreateTable
CREATE TABLE "card_versions" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "diff" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_versions_cardId_version_idx" ON "card_versions"("cardId", "version" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "card_versions_cardId_version_key" ON "card_versions"("cardId", "version");

-- AddForeignKey
ALTER TABLE "card_versions" ADD CONSTRAINT "card_versions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

