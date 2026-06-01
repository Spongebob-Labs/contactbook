-- Remove card-level access requests; sharing is connection-only via WhatsApp card pick.

DROP TABLE IF EXISTS "card_access_grants";
DROP TABLE IF EXISTS "card_access_requests";

ALTER TABLE "contact_cards" DROP COLUMN IF EXISTS "visibility";

DROP TYPE IF EXISTS "CardAccessRequestStatus";
DROP TYPE IF EXISTS "CardVisibility";
