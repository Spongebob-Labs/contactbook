-- Phase 0: WhatsApp-native LangGraph agent.
-- Adds: ChatThread + ChatRecord (audit log), Reminder (with cron dispatch),
-- three new MessagePurpose values (REMINDER, AGENT_REPLY, AGENT_APPROVAL),
-- the three enums those tables need, and a dedicated `langgraph` schema
-- for the LangGraph PostgresSaver checkpointer (keeps the Prisma-managed
-- `public` schema clean — the checkpointer manages its own tables there).

-- ==========================================
-- 1. The langgraph schema (checkpointer tables land here)
-- ==========================================
CREATE SCHEMA IF NOT EXISTS langgraph;

-- ==========================================
-- 2. New enum values on MessagePurpose
-- ==========================================
-- Postgres 12+ allows ALTER TYPE ... ADD VALUE inside a transaction.
-- The dev DB is Postgres 16 (docker-compose.dev.yml) so this is safe.
ALTER TYPE "MessagePurpose" ADD VALUE IF NOT EXISTS 'REMINDER';
ALTER TYPE "MessagePurpose" ADD VALUE IF NOT EXISTS 'AGENT_REPLY';
ALTER TYPE "MessagePurpose" ADD VALUE IF NOT EXISTS 'AGENT_APPROVAL';

-- ==========================================
-- 3. New enums for chat_records + reminders
-- ==========================================
-- These three CREATE TYPE statements are wrapped in DO blocks with
-- existence checks because the previous (failed) migration attempt
-- may have committed them before failing at a later step. DO
-- blocks make the migration safely re-runnable from any state.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatRole') THEN
    CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL', 'SYSTEM');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatRecordKind') THEN
    CREATE TYPE "ChatRecordKind" AS ENUM (
      'USER_MESSAGE',
      'ASSISTANT_TEXT',
      'TOOL_CALL',
      'TOOL_RESULT',
      'APPROVAL_REQUEST',
      'APPROVAL_DECISION',
      'INTERRUPT_OTHER'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderStatus') THEN
    CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'FAILED');
  END IF;
END $$;

-- ==========================================
-- 4. chat_threads
-- ==========================================
CREATE TABLE "chat_threads" (
    "id"                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId"             TEXT         NOT NULL,  -- TEXT, not UUID: matches users.id (text in Supabase)
    "title"              TEXT,
    "langgraphThreadId"  TEXT         NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt"         TIMESTAMP(3),

    CONSTRAINT "chat_threads_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "chat_threads_langgraphThreadId_key"
    ON "chat_threads"("langgraphThreadId");

CREATE INDEX "chat_threads_userId_updatedAt_idx"
    ON "chat_threads"("userId", "updatedAt" DESC);

CREATE INDEX "chat_threads_userId_archivedAt_idx"
    ON "chat_threads"("userId", "archivedAt");

-- ==========================================
-- 5. chat_records
-- ==========================================
CREATE TABLE "chat_records" (
    "id"                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "threadId"                UUID         NOT NULL,
    "userId"                  TEXT         NOT NULL,  -- TEXT, not UUID: matches users.id (text in Supabase)
    "role"                    "ChatRole"   NOT NULL,
    "kind"                    "ChatRecordKind" NOT NULL,
    "content"                 TEXT,

    "audioUrl"                TEXT,
    "audioMime"               TEXT,
    "audioDurationMs"         INTEGER,
    "audioTranscript"         TEXT,

    "toolName"                TEXT,
    "toolCallId"              TEXT,
    "toolArgs"                JSONB,
    "toolResult"              JSONB,

    "approvalSummary"         TEXT,
    "approvalPayload"         JSONB,
    "approvalDecision"        JSONB,

    "langgraphCheckpointId"   TEXT,

    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_records_threadId_fkey"
        FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE,
    CONSTRAINT "chat_records_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "chat_records_threadId_createdAt_idx"
    ON "chat_records"("threadId", "createdAt");

CREATE INDEX "chat_records_userId_createdAt_idx"
    ON "chat_records"("userId", "createdAt" DESC);

CREATE INDEX "chat_records_toolCallId_idx"
    ON "chat_records"("toolCallId");

CREATE INDEX "chat_records_threadId_kind_idx"
    ON "chat_records"("threadId", "kind");

-- ==========================================
-- 6. reminders
-- ==========================================
CREATE TABLE "reminders" (
    "id"               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId"           TEXT              NOT NULL,  -- TEXT, not UUID: matches users.id (text in Supabase)
    "text"             TEXT              NOT NULL,
    "scheduledFor"     TIMESTAMP(3)      NOT NULL,
    "status"           "ReminderStatus"  NOT NULL DEFAULT 'PENDING',
    "sentAt"           TIMESTAMP(3),
    "failedAt"         TIMESTAMP(3),
    "errorMessage"     TEXT,
    "twilioMessageId"  TEXT,
    "outboxId"         TEXT,
    "createdAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "reminders_status_scheduledFor_idx"
    ON "reminders"("status", "scheduledFor");

CREATE INDEX "reminders_userId_status_scheduledFor_idx"
    ON "reminders"("userId", "status", "scheduledFor");
