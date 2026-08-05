-- AlterTable
ALTER TABLE "card_share_recipients"
  ADD COLUMN "vcf_sent_at"     TIMESTAMPTZ,
  ADD COLUMN "vcf_message_sid" TEXT;
