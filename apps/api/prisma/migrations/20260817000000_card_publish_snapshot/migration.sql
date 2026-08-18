-- AlterTable
-- Public share support for contact cards.
-- "slug" is nullable and unique: Postgres treats NULLs as distinct, so every
-- never-published card can share the NULL. Once minted the slug stays put even
-- while unpublished, so republishing restores the same public URL (and any QR
-- or Wallet pass already distributed keeps resolving).
ALTER TABLE "contact_cards"
  ADD COLUMN "slug"              TEXT,
  ADD COLUMN "publishedSnapshot" JSONB,
  ADD COLUMN "publishedAt"       TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "contact_cards_slug_key" ON "contact_cards"("slug");
