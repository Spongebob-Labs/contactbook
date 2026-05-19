-- Contact merge groups, dedup keys, and last-sync stats on integration_states

CREATE TABLE "contact_merge_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_merge_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_dedup_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mergeGroupId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "contact_dedup_keys_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "contacts" ADD COLUMN "mergeGroupId" TEXT;

ALTER TABLE "integration_states" ADD COLUMN "lastSyncAdded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "integration_states" ADD COLUMN "lastSyncUpdated" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "integration_states" ADD COLUMN "lastSyncDeleted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "integration_states" ADD COLUMN "lastSyncDuplicates" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "contact_merge_groups_userId_idx" ON "contact_merge_groups"("userId");

CREATE UNIQUE INDEX "contact_dedup_keys_userId_kind_value_key" ON "contact_dedup_keys"("userId", "kind", "value");

CREATE INDEX "contact_dedup_keys_mergeGroupId_idx" ON "contact_dedup_keys"("mergeGroupId");

CREATE INDEX "contacts_mergeGroupId_idx" ON "contacts"("mergeGroupId");

ALTER TABLE "contact_merge_groups" ADD CONSTRAINT "contact_merge_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_dedup_keys" ADD CONSTRAINT "contact_dedup_keys_mergeGroupId_fkey" FOREIGN KEY ("mergeGroupId") REFERENCES "contact_merge_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contacts" ADD CONSTRAINT "contacts_mergeGroupId_fkey" FOREIGN KEY ("mergeGroupId") REFERENCES "contact_merge_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
