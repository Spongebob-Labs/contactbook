-- CreateEnum
CREATE TYPE "BotState" AS ENUM ('AWAITING_CARD_SELECTION');

-- CreateTable
CREATE TABLE "bot_sessions" (
    "id" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "state" "BotState" NOT NULL,
    "context" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_sessions_phoneE164_key" ON "bot_sessions"("phoneE164");

-- CreateIndex
CREATE INDEX "bot_sessions_expiresAt_idx" ON "bot_sessions"("expiresAt");
