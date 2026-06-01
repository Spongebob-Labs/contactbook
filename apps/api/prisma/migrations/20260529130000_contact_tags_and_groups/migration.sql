-- Repurpose tags for contacts; add contact groups.

DROP TABLE IF EXISTS "_ConnectionToTag";

CREATE TABLE "contact_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "ContactSource",
    "externalId" TEXT,

    CONSTRAINT "contact_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_groups_userId_name_key" ON "contact_groups"("userId", "name");
CREATE UNIQUE INDEX "contact_groups_userId_source_externalId_key" ON "contact_groups"("userId", "source", "externalId");
CREATE INDEX "contact_groups_userId_idx" ON "contact_groups"("userId");

ALTER TABLE "contact_groups" ADD CONSTRAINT "contact_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_ContactTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContactTags_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_ContactTags_B_index" ON "_ContactTags"("B");

ALTER TABLE "_ContactTags" ADD CONSTRAINT "_ContactTags_A_fkey" FOREIGN KEY ("A") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ContactTags" ADD CONSTRAINT "_ContactTags_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_ContactGroups" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContactGroups_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_ContactGroups_B_index" ON "_ContactGroups"("B");

ALTER TABLE "_ContactGroups" ADD CONSTRAINT "_ContactGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ContactGroups" ADD CONSTRAINT "_ContactGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "contact_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
