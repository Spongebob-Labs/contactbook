import { Injectable } from '@nestjs/common';
import { Command } from '@langchain/langgraph';
import { PrismaService } from '../../prisma/prisma.service';
import { AppLogger } from '../../common/logging/app-logger.service';
import { StewardService } from '../guardrails/steward.service';
import { ContextBuilder } from '../guardrails/context.builder';
import { WhatsappFormatService } from '../whatsapp-format/whatsapp-format.service';
import { ChatRecordService } from '../chat-record/chat-record.service';
import { GraphFactory } from '../graph/graph.factory';
import { OutboxService } from '../../outbox/outbox.service';
import { WhatsappService } from '../../messaging/whatsapp.service';
import { WhatsAppTemplateService } from '../../messaging/whatsapp-template.service';
import { maskPhone } from '../../common/logging/redact';
import { HumanMessage } from '@langchain/core/messages';
import { ApiError } from '../../common/errors/api-error';
import { nanoid } from 'nanoid';

/**
 * The `agent_process_inbound` outbox handler. Runs the Steward + the
 * graph for one inbound WhatsApp message, then enqueues the reply
 * (or the approval request) on the outbox.
 *
 * Triggered by WebhooksService.recordInbound, which enqueues this
 * outbox row in the same $transaction as the InboundMessage insert.
 * Running async via the existing OutboxDispatchService keeps the
 * Twilio webhook fast (returns 200 in <500ms) and respects
 * CLAUDE.md invariant #3 ("Never call Twilio from a request handler"
 * — symmetrically, never run a multi-second LLM call from one).
 */
@Injectable()
export class AgentProcessInboundHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly steward: StewardService,
    private readonly context: ContextBuilder,
    private readonly format: WhatsappFormatService,
    private readonly records: ChatRecordService,
    private readonly graph: GraphFactory,
    private readonly outbox: OutboxService,
    private readonly whatsapp: WhatsappService,
    private readonly templates: WhatsAppTemplateService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * The handler entry point. `payload` is the OutboxMessage.payload
   * shape written by WebhooksService.recordInbound.
   */
  async handle(payload: Record<string, unknown>): Promise<void> {
    const inboundMessageId = payload.inboundMessageId as string;
    const fromPhoneE164 = payload.fromPhoneE164 as string;
    const body = (payload.body as string | null) ?? '';
    const buttonText = (payload.buttonText as string | null) ?? null;

    // 1. Find or create the User. Inbound from a phone we don't
    //    recognise: the user exists only as a phone — they haven't
    //    verified yet. We can't run the agent on an unverified
    //    phone, so we ignore for now (a future "first message
    //    onboarding" flow would handle this — out of scope for v1).
    const user = await this.prisma.user.findUnique({
      where: { phoneE164: fromPhoneE164 },
    });
    if (!user) {
      this.logger.info('agent.inbound_unknown_user', {
        fromPhoneE164: maskPhone(fromPhoneE164),
        inboundMessageId,
      });
      return;
    }

    // 2. Get/create the active thread.
    const thread = await this.records.getOrCreateActiveThread(user.id);
    await this.records.bumpThreadUpdatedAt(thread.id);

    // 3. If this inbound is a button-tap on a pending approval, the
    //    thread has a paused graph; resume with the decision.
    //    Freeform messages are treated as a new turn.
    const resume = await this.maybeResumeFromPendingApproval(
      user.id,
      thread.id,
      body,
      buttonText,
    );
    if (resume === 'resumed') return; // handler completed the resume
    if (resume === 'resumed_no_text') return; // resume produced no final answer (declined) — no WhatsApp send

    // 4. New turn: write the user message, then run the Steward.
    await this.records.appendUserMessage(thread.id, user.id, { content: body });

    const recent = await this.context.findRecent(thread.id);
    // The most recent row we just wrote is the current user message;
    // for the Steward's "recent transcript" we want everything UP TO
    // (not including) the current turn. Drop the tail.
    const prior = recent.slice(0, Math.max(0, recent.length - 1));

    const preFilter = this.steward.preFilter(body);
    if (preFilter && !preFilter.allow) {
      await this.handleReject(
        thread.id,
        user.id,
        preFilter,
        fromPhoneE164,
        user.phoneE164,
      );
      return;
    }

    const verdict = await this.steward.judge(prior, body);
    if (!verdict.allow) {
      await this.handleReject(
        thread.id,
        user.id,
        verdict,
        fromPhoneE164,
        user.phoneE164,
      );
      return;
    }

    // 5. Invoke the graph. The userId + threadId are surfaced into
    //    state via the input — the executor reads them from there.
    //    The checkpointer persists per `thread_id` (= thread.langgraphThreadId).
    const result = await this.graph.getGraph().invoke(
      {
        messages: [new HumanMessage(verdict.sanitizedMessage)],
        plannerBrief: verdict.plannerBrief,
        threadId: thread.id,
        userId: user.id,
      },
      {
        configurable: { thread_id: thread.langgraphThreadId, userId: user.id },
      },
    );

    // 6. Inspect the result. If the graph paused on an interrupt
    //    (HITL approval), enqueue the approval template. Otherwise
    //    the final answer is in result.finalAnswer — format and send.
    if (this.hasInterrupt(result)) {
      await this.handleInterrupt(thread.id, user.id, result, fromPhoneE164);
      return;
    }

    const finalAnswer: string | null =
      (result as { finalAnswer?: string | null }).finalAnswer ?? null;
    if (!finalAnswer) {
      this.logger.warn('agent.no_final_answer', { threadId: thread.id });
      return;
    }

    await this.sendReply(thread.id, user.id, finalAnswer, fromPhoneE164);
  }

  // -------------------------------------------------------------------------
  // HITL: resume from a pending button-tap approval.
  // -------------------------------------------------------------------------

  /**
   * If the thread has a pending APPROVAL_REQUEST in the audit log
   * (i.e. the graph is paused on an interrupt waiting for the
   * user's button tap), interpret the current inbound as the
   * decision and resume the graph. Returns:
   *   - 'resumed'             — graph ran to completion and we sent the reply
   *   - 'resumed_no_text'     — graph resumed, produced no text (declined), nothing to send
   *   - 'new_turn'           — not an approval reply; caller should continue as a new turn
   *   - 'no_pending_approval' — same; no interrupt waiting
   */
  private async maybeResumeFromPendingApproval(
    userId: string,
    threadId: string,
    body: string,
    buttonText: string | null,
  ): Promise<
    'resumed' | 'resumed_no_text' | 'new_turn' | 'no_pending_approval'
  > {
    // The most recent APPROVAL_REQUEST for this thread, if any.
    const pending = await this.prisma.chatRecord.findFirst({
      where: { threadId, kind: 'APPROVAL_REQUEST' },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) return 'no_pending_approval';

    // The next inbound after that APPROVAL_REQUEST, if any, is
    // *the* decision. (If the user sends two messages in a row
    // after an approval request, only the first counts as the
    // decision; the second is a new turn — but in practice the
    // Twilio webhook is sequential and the user types one reply.)
    const nextInbound = await this.prisma.chatRecord.findFirst({
      where: {
        threadId,
        kind: 'USER_MESSAGE',
        createdAt: { gt: pending.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (nextInbound) return 'new_turn'; // already handled

    // Interpret the button-tap / freeform as the decision.
    const decision = interpretApprovalReply(buttonText, body);
    await this.records.appendApprovalDecision(threadId, userId, decision);

    // Find the thread to get the langgraphThreadId.
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) return 'new_turn';

    // Resume the graph. The Command({ resume: decision }) returns
    // from the interrupt() call inside the tool.
    const result = await this.graph
      .getGraph()
      .invoke(new Command({ resume: decision }), {
        configurable: { thread_id: thread.langgraphThreadId, userId },
      });

    if (this.hasInterrupt(result)) {
      // The resumed tool then called another interrupt (chained
      // approvals). Send the next approval template.
      await this.handleInterrupt(
        threadId,
        userId,
        result,
        threadId /* unused */,
        true,
      );
      return 'resumed';
    }

    const finalAnswer: string | null =
      (result as { finalAnswer?: string | null }).finalAnswer ?? null;
    if (!finalAnswer) {
      return 'resumed_no_text';
    }

    // Look up the user's phone (we need it for sending).
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return 'resumed_no_text';
    await this.sendReply(threadId, userId, finalAnswer, user.phoneE164);
    return 'resumed';
  }

  // -------------------------------------------------------------------------
  // Reject / interrupt / reply senders.
  // -------------------------------------------------------------------------

  private async handleReject(
    threadId: string,
    userId: string,
    verdict: import('../guardrails/steward.schema').StewardVerdict,
    fromPhoneE164: string,
    _userPhone: string,
  ): Promise<void> {
    await this.records.appendInterruptOther(
      threadId,
      userId,
      verdict.reason ?? 'rejected',
      {
        topicCategory: verdict.topicCategory,
        injectionRisk: verdict.injectionRisk,
      },
    );
    const reply = cannedReject(verdict);
    const chunks = this.format.format(reply);
    for (const chunk of chunks) {
      await this.enqueueAgentReply(userId, chunk, threadId);
    }
  }

  private async handleInterrupt(
    threadId: string,
    userId: string,
    result: unknown,
    _fromPhoneE164: string,
    _alreadyResumed = false,
  ): Promise<void> {
    // result.__interrupt__ is the array of interrupt payloads.
    // The most recent one is what we send.
    const interrupts = (
      result as { __interrupt__?: Array<{ value?: unknown }> }
    ).__interrupt__;
    const last =
      interrupts && interrupts.length > 0
        ? interrupts[interrupts.length - 1]
        : null;
    const payload = (last?.value ?? {}) as {
      kind?: string;
      action?: string;
      summary?: string;
    };
    if (payload.kind !== 'approval_required' || !payload.summary) {
      this.logger.warn('agent.unexpected_interrupt', { threadId, payload });
      return;
    }
    // Write the APPROVAL_REQUEST record.
    await this.records.appendApprovalRequest(
      threadId,
      userId,
      payload.summary,
      payload,
    );
    // Enqueue the approval-template send.
    const template = await this.templates.findActive('AGENT_APPROVAL');
    if (!template) {
      this.logger.warn('agent.approval_template_not_registered', { threadId });
      const fallback = `I need your approval to: *${payload.summary}*\n\nReply *yes* to approve or *no* to decline.`;
      const chunks = this.format.format(fallback);
      for (const chunk of chunks) {
        await this.enqueueAgentReply(userId, chunk, threadId);
      }
      return;
    }
    await this.enqueueApproval(userId, payload.summary, threadId);
  }

  private async sendReply(
    threadId: string,
    userId: string,
    markdown: string,
    toPhoneE164: string,
  ): Promise<void> {
    const chunks = this.format.format(markdown);
    for (const chunk of chunks) {
      await this.enqueueAgentReply(userId, chunk, threadId, toPhoneE164);
    }
  }

  private async enqueueAgentReply(
    userId: string,
    text: string,
    threadId: string,
    toPhoneE164?: string,
  ): Promise<void> {
    const dedupeKey = `agent_reply:${threadId}:${Date.now()}:${nanoid(8)}`;
    const phone =
      toPhoneE164 ??
      (await this.prisma.user.findUnique({ where: { id: userId } }))?.phoneE164;
    if (!phone) return;
    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        dedupeKey,
        kind: 'send_whatsapp_agent_reply',
        payload: {
          userId,
          threadId,
          toPhoneE164: phone,
          text,
          correlationId: threadId,
        },
      });
    });
  }

  private async enqueueApproval(
    userId: string,
    summary: string,
    threadId: string,
  ): Promise<void> {
    const phone = (await this.prisma.user.findUnique({ where: { id: userId } }))
      ?.phoneE164;
    if (!phone) return;
    const dedupeKey = `agent_approval:${threadId}:${nanoid(8)}`;
    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        dedupeKey,
        kind: 'send_whatsapp_agent_approval',
        payload: {
          userId,
          threadId,
          toPhoneE164: phone,
          summary,
          correlationId: threadId,
        },
      });
    });
  }

  private hasInterrupt(result: unknown): boolean {
    const interrupts = (result as { __interrupt__?: unknown[] }).__interrupt__;
    return Array.isArray(interrupts) && interrupts.length > 0;
  }
}

// -------------------------------------------------------------------------
// Pure helpers (no DI).
// -------------------------------------------------------------------------

function interpretApprovalReply(
  buttonText: string | null,
  body: string,
): Record<string, unknown> {
  // Twilio quick-reply buttons arrive with ButtonText set; freeform
  // replies arrive in Body. We map:
  //   ButtonText "✅ Approve"   -> { approved: true }
  //   ButtonText "❌ Decline"   -> { approved: false }
  //   Body "yes" / "y"         -> { approved: true }
  //   Body "no" / "n"          -> { approved: false }
  //   anything else            -> { approved: false, correction: <body> }
  if (buttonText) {
    if (/approve/i.test(buttonText)) return { approved: true };
    if (/decline/i.test(buttonText)) return { approved: false };
  }
  const trimmed = body.trim().toLowerCase();
  if (
    trimmed === 'yes' ||
    trimmed === 'y' ||
    trimmed === 'ok' ||
    trimmed === 'sure'
  ) {
    return { approved: true };
  }
  if (
    trimmed === 'no' ||
    trimmed === 'n' ||
    trimmed === 'nope' ||
    trimmed === 'cancel'
  ) {
    return { approved: false };
  }
  return { approved: false, correction: body };
}

function cannedReject(
  v: import('../guardrails/steward.schema').StewardVerdict,
): string {
  if (v.injectionRisk === 'high') {
    return "I couldn't process that safely. Please rephrase and try again.";
  }
  if (v.topicCategory === 'off_topic') {
    return 'I can only help with your ContactBook data — your profile, contacts, cards, sharing, and reminders. Try one of those?';
  }
  return v.reason ?? "Sorry, I couldn't process that. Try rephrasing?";
}
