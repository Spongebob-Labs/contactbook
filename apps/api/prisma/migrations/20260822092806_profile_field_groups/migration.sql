-- CreateEnum
CREATE TYPE "FieldGroupCategory" AS ENUM ('WORK', 'BUSINESS', 'SOCIAL', 'FINANCIAL');

-- AlterTable
ALTER TABLE "profile_fields" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "profileOnboardingCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "profile_field_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FieldGroupCategory" NOT NULL,
    "tag" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_field_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_field_groups_userId_category_archivedAt_position_idx" ON "profile_field_groups"("userId", "category", "archivedAt", "position");

-- CreateIndex
CREATE INDEX "profile_fields_groupId_position_idx" ON "profile_fields"("groupId", "position");

-- AddForeignKey
ALTER TABLE "profile_field_groups" ADD CONSTRAINT "profile_field_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_fields" ADD CONSTRAINT "profile_fields_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "profile_field_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
