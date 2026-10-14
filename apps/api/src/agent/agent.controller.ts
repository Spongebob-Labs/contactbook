import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Command } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { ChatRecord, ChatThread, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { ChatRecordService } from './chat-record/chat-record.service';
import { ContextBuilder } from './guardrails/context.builder';
import { StewardService } from './guardrails/steward.service';
import { GraphFactory } from './graph/graph.factory';
import { AgentConfig } from './agent.config';
import {
  AgentRecordDto,
  AgentResumeDto,
  AgentRunResponseDto,
  AgentSendMessageDto,
  AgentThreadSummaryDto,
  AgentTraceMessage,
  AgentToolResult,
  ListThreadRecordsQueryDto,
  OpenThreadResponseDto,
  ThreadIdParamDto,
} from './dto/agent-test.dto';
import type { StewardVerdict } from './guardrails/steward.schema';
import type { Request } from 'express';

/**
 * The agent's authenticated-user HTTP surface.
 *
 * The agent is triggered in production by the Twilio inbound webhook
 * (see AgentProcessInboundHandler), which is a public route. THIS
 * controller is the parallel, JWT-guarded surface that lets a user
 * drive the same agent from `curl` / a test script / a future web
 * chat — no phone in hand, no Twilio in the loop, no WhatsApp send.
 *
 * **What this does, by route:**
 *
 *   POST   /api/v1/agent/threads                       — get or create the caller's active thread
 *   GET    /api/v1/agent/threads                       — list the caller's threads
 *   GET    /api/v1/agent/threads/:threadId             — get one (must be caller's)
 *   DELETE /api/v1/agent/threads/:threadId             — archive one (soft delete)
 *   GET    /api/v1/agent/threads/:threadId/records     — paginated audit log
 *   POST   /api/v1/agent/threads/:threadId/messages    — drive the agent (sync, returns full state)
 *   POST   /api/v1/agent/threads/:threadId/resume      — resume a paused graph (HITL)
 *
 * **What this does NOT do:**
 *
 *   - It never enqueues `send_whatsapp_agent_reply` /
 *     `send_whatsapp_agent_approval` / `send_whatsapp_reminder` outbox
 *     rows. The test surface stops at the LLM call. The cron
 *     dispatcher still runs (it claims due reminders on its own),
 *     but no agent-related Twilio sends are triggered by these
 *     routes.
 *   - It does not bypass the Steward. Every inbound goes through
 *     the same guardrail (pre-filter → LLM verdict → forced rules)
 *     as a WhatsApp message would.
 *   - It is not admin. userId always comes from `req.user.id`; a
 *     caller can only operate on their own threads. Threads that
 *     belong to another user return 404 (not 403, to avoid leaking
 *     existence).
 *
 * **Testing flow (curl):**
 *
 *   1. Sign in, get a JWT.
 *   2. POST /agent/threads → get a threadId.
 *   3. POST /agent/threads/:id/messages with `{ "content": "what's in my profile" }`
 *      → response has the Steward verdict, the planner's tool call, the
 *      tool result, and the final answer. Read the `messages` array to
 *      see the full ReAct trace.
 *   4. POST /agent/threads/:id/messages with `{ "content": "remind me tomorrow at 9am to call mom" }`
 *      → response has `interrupt: { kind: "approval_required", ... }`. The
 *      tool's interrupt() paused the graph; the checkpointer saved.
 *   5. POST /agent/threads/:id/resume with `{ "decision": { "approved": true } }`
 *      → graph resumes, the reminder is created, response has the final
 *      answer.
 *   6. GET /agent/threads/:id/records → the full audit log (user msg,
 *      steward call, tool call, tool result, approval request, approval
 *      decision, assistant text).
 */
@ApiTags('agent')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'agent', version: '1' })
export class AgentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: ChatRecordService,
    private readonly steward: StewardService,
    private readonly context: ContextBuilder,
    private readonly graph: GraphFactory,
    private readonly cfg: AgentConfig,
    private readonly logger: AppLogger,
  ) {}

  // ---------------------------------------------------------------------
  // Thread management
  // ---------------------------------------------------------------------

  @Post('threads')
  @HttpCode(200)
  @ApiOperation({
    summary: "Get or create the caller's active ChatThread",
    description:
      'Returns the most-recent non-archived thread for the caller, or ' +
      'creates a new one. The thread.id is what subsequent /messages and ' +
      '/resume routes operate on.',
  })
  @ApiOkResponse({ type: OpenThreadResponseDto })
  async openThread(@Req() req: Request): Promise<OpenThreadResponseDto> {
    const userId = this.requireUserId(req);
    const existing = await this.prisma.chatThread.findFirst({
      where: { userId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      return { threadId: existing.id, created: false };
    }
    const created = await this.records.getOrCreateActiveThread(userId);
    return { threadId: created.id, created: true };
  }

  @Get('threads')
  @ApiOperation({
    summary: "List the caller's threads, most recent first",
  })
  @ApiOkResponse({ type: [AgentThreadSummaryDto] })
  async listThreads(@Req() req: Request): Promise<AgentThreadSummaryDto[]> {
    const userId = this.requireUserId(req);
    const rows = await this.prisma.chatThread.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => this.toThreadSummary(r));
  }

  @Get('threads/:threadId')
  @ApiOperation({ summary: 'Get one thread (must be the caller\u2019s)' })
  @ApiOkResponse({ type: AgentThreadSummaryDto })
  @ApiNotFoundResponse({ description: 'Thread not found or not owned by caller.' })
  async getThread(
    @Req() req: Request,
    @Param() params: ThreadIdParamDto,
  ): Promise<AgentThreadSummaryDto> {
    const userId = this.requireUserId(req);
    const thread = await this.requireOwnedThread(userId, params.threadId);
    return this.toThreadSummary(thread);
  }

  @Delete('threads/:threadId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Archive a thread',
    description:
      'Soft-delete: sets archivedAt on the thread. The next POST /threads ' +
      'returns a brand-new thread with a fresh LangGraph checkpointer ' +
      'state (the archived thread\u2019s checkpointer state is retained for ' +
      'audit, never resumed). Records and history are kept.',
  })
  @ApiResponse({ status: 204, description: 'Archived.' })
  @ApiNotFoundResponse({
    description: 'Thread not found or not owned by caller.',
  })
  async archiveThread(
    @Req() req: Request,
    @Param() params: ThreadIdParamDto,
  ): Promise<void> {
    const userId = this.requireUserId(req);
    await this.requireOwnedThread(userId, params.threadId);
    await this.records.archiveThread(params.threadId);
    this.logger.info('agent.thread_archived', {
      threadId: params.threadId,
      userId,
    });
  }

  @Get('threads/:threadId/records')
  @ApiOperation({
    summary: 'Paginated audit log for a thread',
    description:
      'Returns ChatRecord rows for the thread, oldest → newest. Use ' +
      '`?limit=N&before=ISO_TIMESTAMP` for cursor pagination. The ' +
      '`before` cursor is the `createdAt` of the last record from the ' +
      'previous page.',
  })
  @ApiOkResponse({ type: [AgentRecordDto] })
  async listRecords(
    @Req() req: Request,
    @Param() params: ThreadIdParamDto,
    @Query() query: ListThreadRecordsQueryDto,
  ): Promise<AgentRecordDto[]> {
    const userId = this.requireUserId(req);
    await this.requireOwnedThread(userId, params.threadId);
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const where: Prisma.ChatRecordWhereInput = { threadId: params.threadId };
    if (query.before) {
      const before = new Date(query.before);
      if (isNaN(before.getTime())) {
        throw ApiError.badRequest(
          'INVALID_BEFORE_CURSOR',
          '`before` must be a valid ISO 8601 timestamp.',
        );
      }
      where.createdAt = { lt: before };
    }
    const rows = await this.prisma.chatRecord.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => this.toRecordDto(r));
  }

  // ---------------------------------------------------------------------
  // The two interesting routes
  // ---------------------------------------------------------------------

  @Post('threads/:threadId/messages')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send a user message and run the agent (synchronous)',
    description:
      'Runs the Steward, then the LangGraph (planner → tools → ' +
      'synthesiser), then returns the full state. If the graph ' +
      'paused on an interrupt (HITL approval), the response carries ' +
      'the interrupt payload — call /resume with the decision to ' +
      'continue. If the graph ran to completion, the response carries ' +
      'the final answer (markdown).',
  })
  @ApiBody({ type: AgentSendMessageDto })
  @ApiOkResponse({ type: AgentRunResponseDto })
  async sendMessage(
    @Req() req: Request,
    @Param() params: ThreadIdParamDto,
    @Body() body: AgentSendMessageDto,
  ): Promise<AgentRunResponseDto> {
    const userId = this.requireUserId(req);
    const thread = await this.requireOwnedThread(userId, params.threadId);
    const startedAt = Date.now();

    // 1. Write the user message to the audit log (same as the
    //    production handler does). This is the canonical record of
    //    the turn, regardless of which path (Twilio webhook vs this
    //    controller) drove the agent.
    await this.records.appendUserMessage(thread.id, userId, {
      content: body.content,
    });

    // 2. Pre-filter (cheap, no LLM).
    const preFilter = this.steward.preFilter(body.content);
    if (preFilter && !preFilter.allow) {
      await this.records.appendInterruptOther(
        thread.id,
        userId,
        preFilter.reason ?? 'pre_filter_reject',
        {
          topicCategory: preFilter.topicCategory,
          injectionRisk: preFilter.injectionRisk,
          source: 'pre_filter',
        },
      );
      return this.buildGuardrailRejectResponse(thread, preFilter, startedAt);
    }

    // 3. The Steward's transcript = everything BEFORE the current
    //    turn. Drop the row we just wrote (it's at the tail).
    const recent = await this.context.findRecent(thread.id);
    const prior = recent.slice(0, Math.max(0, recent.length - 1));

    // 4. Steward LLM call.
    const verdict = await this.steward.judge(prior, body.content);
    if (!verdict.allow) {
      await this.records.appendInterruptOther(
        thread.id,
        userId,
        verdict.reason ?? 'steward_reject',
        {
          topicCategory: verdict.topicCategory,
          injectionRisk: verdict.injectionRisk,
          source: 'steward_llm',
        },
      );
      return this.buildGuardrailRejectResponse(thread, verdict, startedAt);
    }

    // 5. Invoke the graph. userId + threadId are surfaced into
    //    state via the input — the executor reads them from there.
    //    The checkpointer persists per `thread_id` (= thread.langgraphThreadId).
    const result = await this.graph.run(
      {
        messages: [new HumanMessage(verdict.sanitizedMessage)],
        plannerBrief: verdict.plannerBrief,
        threadId: thread.id,
        userId,
      },
      { configurable: { thread_id: thread.langgraphThreadId, userId } },
    );

    return this.buildRunResponse(thread, verdict, result, startedAt);
  }

  @Post('threads/:threadId/resume')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resume a paused graph with a decision',
    description:
      'Continues a graph that hit an interrupt() (HITL approval or a ' +
      'chained approval). The `decision` object is passed back to the ' +
      'paused tool via Command({ resume: decision }). Typical shapes: ' +
      '`{ "approved": true }`, `{ "approved": false }`, or ' +
      '`{ "approved": true, "text": "edited text" }` for a tool that ' +
      'accepts edits.',
  })
  @ApiBody({ type: AgentResumeDto })
  @ApiOkResponse({ type: AgentRunResponseDto })
  async resume(
    @Req() req: Request,
    @Param() params: ThreadIdParamDto,
    @Body() body: AgentResumeDto,
  ): Promise<AgentRunResponseDto> {
    const userId = this.requireUserId(req);
    const thread = await this.requireOwnedThread(userId, params.threadId);
    const startedAt = Date.now();

    // 1. Record the decision in the audit log BEFORE resuming, so
    //    even if the resume crashes the user's choice is captured.
    await this.records.appendApprovalDecision(thread.id, userId, body.decision);

    // 2. Resume the graph. Command({ resume }) returns from the
    //    interrupt() call inside the tool that paused. If that tool
    //    calls another interrupt (chained approvals), the second
    //    one pauses the graph again and we surface it in the response.
    const result = await this.graph.run(
      new Command({ resume: body.decision }),
      { configurable: { thread_id: thread.langgraphThreadId, userId } },
    );

    // The Steward's verdict shape is irrelevant on resume — the
    // graph resumes from the checkpointer, not from a fresh turn.
    // We pass a placeholder verdict so the response shape is uniform.
    const placeholderVerdict: StewardVerdict = {
      allow: true,
      reason: null,
      sanitizedMessage: '',
      injectionRisk: 'none',
      topicCategory: 'conversational',
      plannerBrief: 'Resumed from interrupt.',
    };

    return this.buildRunResponse(thread, placeholderVerdict, result, startedAt);
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private requireUserId(req: Request): string {
    // Same convention as the rest of the codebase: JwtAuthGuard
    // populates req.user at runtime, even though the express Request
    // type doesn't formally declare it. The non-null assertion
    // matches profile/contacts/cards controllers.
    return req.user!.id;
  }

  private async requireOwnedThread(userId: string, threadId: string): Promise<ChatThread> {
    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread || thread.userId !== userId) {
      // 404, not 403, to avoid leaking existence of other users' threads.
      throw ApiError.notFound('THREAD_NOT_FOUND', 'No thread with that id for this user.');
    }
    return thread;
  }

  private toThreadSummary(t: ChatThread): AgentThreadSummaryDto {
    return {
      id: t.id,
      title: t.title,
      langgraphThreadId: t.langgraphThreadId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      archivedAt: t.archivedAt,
    };
  }

  private toRecordDto(r: ChatRecord): AgentRecordDto {
    return {
      id: r.id,
      role: r.role,
      kind: r.kind,
      content: r.content,
      toolName: r.toolName,
      toolCallId: r.toolCallId,
      toolArgs: r.toolArgs,
      toolResult: r.toolResult,
      approvalSummary: r.approvalSummary,
      approvalPayload: r.approvalPayload,
      approvalDecision: r.approvalDecision,
      createdAt: r.createdAt,
    };
  }

  /**
   * Build the response for a completed (or interrupted) graph run.
   *
   * Inspects the result for an interrupt, then for the final answer.
   * Also walks `result.messages` to surface the ReAct trace in a
   * shape the test surface can render.
   */
  private async buildRunResponse(
    thread: ChatThread,
    verdict: StewardVerdict,
    result: unknown,
    startedAt: number,
  ): Promise<AgentRunResponseDto> {
    const finalAnswer = (result as { finalAnswer?: string | null }).finalAnswer ?? null;
    const interruptRaw = (result as { __interrupt__?: Array<{ id?: string; value?: unknown }> })
      .__interrupt__;
    const lastInterrupt =
      Array.isArray(interruptRaw) && interruptRaw.length > 0
        ? interruptRaw[interruptRaw.length - 1]
        : null;

    // The user-facing markdown that would go through the WhatsApp
    // formatter. The formatter isn't called here (it'd just round-trip
    // the same text), but a curl reader can pipe it through the
    // formatter locally if they want the exact-on-WhatsApp shape.
    const userMessage = (verdict.sanitizedMessage ?? '').toString();

    // Walk the ReAct trace.
    const messages: AgentTraceMessage[] = [];
    const toolResults: AgentToolResult[] = [];
    const rawMessages = (result as { messages?: unknown[] }).messages ?? [];
    for (const m of rawMessages) {
      const msg = m as {
        _getType?: () => string;
        content?: unknown;
        tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
        tool_call_id?: string;
        name?: string;
      };
      const t = msg._getType?.() ?? 'unknown';
      if (t === 'human') {
        messages.push({
          role: 'user',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        });
      } else if (t === 'ai') {
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content) && msg.content.length > 0
              ? JSON.stringify(msg.content)
              : null;
        if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          for (const call of msg.tool_calls) {
            messages.push({
              role: 'assistant',
              content,
              toolName: call.name,
              toolCallId: call.id,
              toolArgs: call.args,
            });
          }
        } else {
          messages.push({ role: 'assistant', content });
        }
      } else if (t === 'tool') {
        let parsed: unknown = msg.content;
        if (typeof msg.content === 'string') {
          try {
            parsed = JSON.parse(msg.content);
          } catch {
            parsed = msg.content;
          }
        }
        messages.push({
          role: 'tool',
          content: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
          toolName: msg.name,
          toolCallId: msg.tool_call_id,
          toolResult: parsed,
        });
        toolResults.push({
          name: msg.name ?? '?',
          toolCallId: msg.tool_call_id ?? '?',
          result: parsed,
        });
      } else if (t === 'system') {
        messages.push({
          role: 'system',
          content: typeof msg.content === 'string' ? msg.content : null,
        });
      }
    }

    // If the graph paused on an interrupt, write an APPROVAL_REQUEST
    // row so the audit log shows it. We only write if a tool was
    // interrupted (kind === 'approval_required'); guardrail rejects
    // are already written above as INTERRUPT_OTHER.
    let interrupt: AgentRunResponseDto['interrupt'];
    if (lastInterrupt) {
      const v = (lastInterrupt.value ?? {}) as {
        kind?: string;
        action?: string;
        summary?: string;
        payload?: Record<string, unknown>;
        reason?: string;
      };
      if (v.kind === 'approval_required' && v.summary) {
        await this.records.appendApprovalRequest(
          thread.id,
          thread.userId,
          v.summary,
          v.payload ?? {},
        );
        interrupt = {
          id: lastInterrupt.id ?? 'unknown',
          value: {
            kind: 'approval_required',
            action: v.action,
            summary: v.summary,
            payload: v.payload,
          },
        };
      } else {
        // Non-approval interrupt (shouldn't happen with our current
        // tools, but surface it anyway for future-proofing).
        interrupt = {
          id: lastInterrupt.id ?? 'unknown',
          value: {
            kind: v.kind ?? 'unknown',
            reason: v.reason,
            payload: v.payload,
          },
        };
      }
    }

    // If the graph produced a final answer, write ASSISTANT_TEXT.
    if (finalAnswer) {
      await this.records.appendAssistantText(thread.id, thread.userId, finalAnswer);
    }

    this.logger.info('agent.controller_run', {
      threadId: thread.id,
      userId: thread.userId,
      hasInterrupt: !!interrupt,
      hasFinalAnswer: !!finalAnswer,
      toolCallCount: toolResults.length,
      durationMs: Date.now() - startedAt,
    });

    return {
      threadId: thread.id,
      userMessage,
      stewardVerdict: {
        allow: verdict.allow,
        topicCategory: verdict.topicCategory,
        injectionRisk: verdict.injectionRisk,
        plannerBrief: verdict.plannerBrief,
        reason: verdict.reason,
      },
      messages,
      toolResults,
      interrupt,
      finalAnswer: interrupt ? null : finalAnswer,
      durationMs: Date.now() - startedAt,
    };
  }

  private buildGuardrailRejectResponse(
    thread: ChatThread,
    verdict: StewardVerdict,
    startedAt: number,
  ): AgentRunResponseDto {
    const reason = verdict.reason ?? 'rejected';
    return {
      threadId: thread.id,
      userMessage: verdict.sanitizedMessage ?? '',
      stewardVerdict: {
        allow: false,
        topicCategory: verdict.topicCategory,
        injectionRisk: verdict.injectionRisk,
        plannerBrief: verdict.plannerBrief,
        reason,
      },
      messages: [],
      toolResults: [],
      interrupt: {
        id: 'guardrail',
        value: {
          kind: 'guardrail_reject',
          reason,
          payload: { topicCategory: verdict.topicCategory, injectionRisk: verdict.injectionRisk },
        },
      },
      finalAnswer: null,
      durationMs: Date.now() - startedAt,
    };
  }
}
