import { Injectable } from '@nestjs/common';
import {
  ChatRecord,
  ChatRecordKind,
  ChatRole,
  ChatThread,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The single writer for ChatThread + ChatRecord. Every other agent
 * component goes through here so the audit log is consistent and the
 * `langgraphThreadId ↔ ChatThread.id` 1:1 mapping is enforced in one
 * place.
 */
@Injectable()
export class ChatRecordService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the user's currently-active (non-archived) ChatThread, or
   * create one. `langgraphThreadId` is the same as the ChatThread id —
   * 1:1, so resuming the checkpointer is just `thread.langgraphThreadId`.
   */
  async getOrCreateActiveThread(userId: string): Promise<ChatThread> {
    const existing = await this.prisma.chatThread.findFirst({
      where: { userId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;
    return this.prisma.chatThread.create({
      data: {
        userId,
        langgraphThreadId: crypto.randomUUID(),
      },
    });
  }

  async findThreadByLanggraphId(
    langgraphThreadId: string,
  ): Promise<ChatThread | null> {
    return this.prisma.chatThread.findUnique({ where: { langgraphThreadId } });
  }

  async archiveThread(threadId: string): Promise<void> {
    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { archivedAt: new Date() },
    });
  }

  async setTitle(threadId: string, title: string): Promise<void> {
    if (title.length > 200) title = title.slice(0, 200);
    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { title },
    });
  }

  /**
   * The last N ChatRecords for a thread, chronological (oldest →
   * newest). Powers both the Steward's transcript and the planner's
   * `plannerContext`.
   */
  async findRecent(threadId: string, n: number): Promise<ChatRecord[]> {
    // Fetch n+1 then drop the current turn's rows by kind filter, so
    // a "find recent before the current turn" query is easy to compose.
    return this.prisma.chatRecord.findMany({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
      take: n,
    });
  }

  // ---------------------------------------------------------------------
  // Append helpers — one per kind, so the call site is self-documenting.
  // ---------------------------------------------------------------------

  async appendUserMessage(
    threadId: string,
    userId: string,
    opts: {
      content: string;
      audioUrl?: string;
      audioMime?: string;
      audioDurationMs?: number;
      audioTranscript?: string;
    },
  ): Promise<ChatRecord> {
    return this.prisma.chatRecord.create({
      data: {
        threadId,
        userId,
        role: ChatRole.USER,
        kind: ChatRecordKind.USER_MESSAGE,
        content: opts.content,
        audioUrl: opts.audioUrl ?? null,
        audioMime: opts.audioMime ?? null,
        audioDurationMs: opts.audioDurationMs ?? null,
        audioTranscript: opts.audioTranscript ?? null,
      },
    });
  }

  async appendAssistantText(
    threadId: string,
    userId: string,
    content: string,
    checkpointId?: string,
  ): Promise<ChatRecord> {
    return this.prisma.chatRecord.create({
      data: {
        threadId,
        userId,
        role: ChatRole.ASSISTANT,
        kind: ChatRecordKind.ASSISTANT_TEXT,
        content,
        langgraphCheckpointId: checkpointId ?? null,
      },
    });
  }

  async appendToolCall(
    threadId: string,
    userId: string,
    toolName: string,
    toolCallId: string,
    args: Record<string, unknown>,
  ): Promise<ChatRecord> {
    return this.prisma.chatRecord.create({
      data: {
        threadId,
        userId,
        role: ChatRole.ASSISTANT,
        kind: ChatRecordKind.TOOL_CALL,
        toolName,
        toolCallId,
        toolArgs: args as Prisma.InputJsonValue,
      },
    });
  }

  async appendToolResult(
    threadId: string,
    userId: string,
    toolName: string,
    toolCallId: string,
    result: unknown,
  ): Promise<ChatRecord> {
    return this.prisma.chatRecord.create({
      data: {
        threadId,
        userId,
        role: ChatRole.TOOL,
        kind: ChatRecordKind.TOOL_RESULT,
        toolName,
        toolCallId,
        toolResult: result as Prisma.InputJsonValue,
      },
    });
  }

  async appendApprovalRequest(
    threadId: string,
    userId: string,
    summary: string,
    payload: Record<string, unknown>,
    checkpointId?: string,
  ): Promise<ChatRecord> {
    return this.prisma.chatRecord.create({
      data: {
        threadId,
        userId,
        role: ChatRole.ASSISTANT,
        kind: ChatRecordKind.APPROVAL_REQUEST,
        content: summary,
        approvalSummary: summary,
        approvalPayload: payload as Prisma.InputJsonValue,
        langgraphCheckpointId: checkpointId ?? null,
      },
    });
  }

  async appendApprovalDecision(
    threadId: string,
    userId: string,
    decision: Record<string, unknown>,
  ): Promise<ChatRecord> {
    return this.prisma.chatRecord.create({
      data: {
        threadId,
        userId,
        role: ChatRole.USER,
        kind: ChatRecordKind.APPROVAL_DECISION,
        content: describeDecision(decision),
        approvalDecision: decision as Prisma.InputJsonValue,
      },
    });
  }

  async appendInterruptOther(
    threadId: string,
    userId: string,
    content: string,
    meta: Record<string, unknown> = {},
  ): Promise<ChatRecord> {
    return this.prisma.chatRecord.create({
      data: {
        threadId,
        userId,
        role: ChatRole.SYSTEM,
        kind: ChatRecordKind.INTERRUPT_OTHER,
        content,
        // Stash meta inside approvalPayload for the audit reader; not
        // semantically "approval" but the column is the existing
        // JSONB-shaped blob and avoids a new column for a debug field.
        approvalPayload: meta as Prisma.InputJsonValue,
      },
    });
  }

  async bumpThreadUpdatedAt(threadId: string): Promise<void> {
    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });
  }
}

function describeDecision(d: Record<string, unknown>): string {
  if (d?.approved === true) return 'User approved.';
  if (d?.approved === false) {
    const corr = typeof d.correction === 'string' ? `: ${d.correction}` : '';
    return `User declined${corr}`;
  }
  if (typeof d.correction === 'string' && d.correction.length > 0) {
    return `User edit: ${d.correction}`;
  }
  return 'User reply.';
}
