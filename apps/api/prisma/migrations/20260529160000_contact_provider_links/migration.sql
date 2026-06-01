-- Provenance registry: every provider (source + externalId) that sourced or updated a contact.

CREATE TABLE "contact_provider_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "source" "ContactSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceRevision" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "firstLinkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_provider_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_provider_links_userId_source_externalId_key" ON "contact_provider_links"("userId", "source", "externalId");
CREATE UNIQUE INDEX "contact_provider_links_contactId_source_key" ON "contact_provider_links"("contactId", "source");
CREATE INDEX "contact_provider_links_userId_source_idx" ON "contact_provider_links"("userId", "source");

ALTER TABLE "contact_provider_links" ADD CONSTRAINT "contact_provider_links_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill primary links from existing contacts.
INSERT INTO "contact_provider_links" (
    "id",
    "userId",
    "contactId",
    "source",
    "externalId",
    "sourceRevision",
    "isPrimary",
    "firstLinkedAt",
    "lastUpdatedAt"
)
SELECT
    gen_random_uuid()::text,
    c."userId",
    c."id",
    c."source",
    c."externalId",
    c."sourceRevision",
    true,
    c."createdAt",
    c."updatedAt"
FROM "contacts" c
WHERE c."deletedAt" IS NULL
ON CONFLICT ("userId", "source", "externalId") DO NOTHING;
