import { Inject, Injectable } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AppLogger } from '../../common/logging/app-logger.service';
import { AgentConfig } from '../agent.config';
import { LLM_SERVICE, LlmService } from '../llm/llm.service';
import { STEWARD_SYSTEM_PROMPT } from './steward.prompt';
import { StewardVerdict, StewardVerdictSchema } from './steward.schema';
import { ContextBuilder } from './context.builder';
import { ChatRecord } from '@prisma/client';
import { maskPhone } from '../../common/logging/redact';

/**
 * The Conversation Steward. Sits at the door of every inbound message
 * and produces a structured verdict (allow/reject + sanitized text +
 * planner brief) via a single LLM call.
 *
 * Layered defence:
 *   1. Pre-LLM heuristic gate (empty body, length cap) — free, no LLM.
 *   2. LLM call (this service) — the primary judgment.
 *   3. (Future) LLM-as-judge cross-check on ambiguous verdicts.
 *
 * The Steward's `plannerBrief` is the LLM's contribution to context;
 * the raw last-20 window is built deterministically by ContextBuilder
 * and passed alongside it. Two views, one source of truth.
 */
@Injectable()
export class StewardService {
  constructor(
    @Inject(LLM_SERVICE) private readonly llm: LlmService,
    private readonly context: ContextBuilder,
    private readonly cfg: AgentConfig,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Cheap, deterministic pre-filter. Returns a StewardVerdict-shaped
   * reject if the message is obviously junk; otherwise null and the
   * caller proceeds to the LLM call.
   */
  preFilter(body: string): StewardVerdict | null {
    const trimmed = (body ?? '').trim();
    if (trimmed.length === 0) {
      return {
        allow: false,
        reason: 'empty message',
        sanitizedMessage: '',
        injectionRisk: 'none',
        topicCategory: 'conversational',
        plannerBrief: '',
      };
    }
    if (trimmed.length > this.cfg.maxInboundChars) {
      return {
        allow: false,
        reason: `message exceeds ${this.cfg.maxInboundChars} characters`,
        sanitizedMessage: '',
        injectionRisk: 'none',
        topicCategory: 'off_topic',
        plannerBrief: '',
      };
    }
    return null;
  }

  /**
   * The LLM call. Inputs:
   *   - recent: last N ChatRecords (any role) for cross-turn context
   *   - rawUserMessage: the current-turn body, as received from Twilio
   *
   * Returns the parsed StewardVerdict. The model is bound to
   * StewardVerdictSchema via withStructuredOutput() so a malformed
   * response throws a ZodError at this boundary.
   */
  async judge(
    recent: ChatRecord[],
    rawUserMessage: string,
  ): Promise<StewardVerdict> {
    const transcript = this.context.formatTranscript(recent);
    const model = this.llm
      .getStewardModel()
      .withStructuredOutput(StewardVerdictSchema);

    const userSide = [
      '## Recent conversation',
      transcript,
      '',
      '## Current user message',
      rawUserMessage,
    ].join('\n');

    this.logger.info('agent.steward_invoked', {
      recentCount: recent.length,
      messageLength: rawUserMessage.length,
      fromPhoneHint:
        maskPhone(recent.find((r) => r.content)?.content ?? '') || undefined,
    });

    const verdict = await model.invoke([
      new SystemMessage(STEWARD_SYSTEM_PROMPT),
      new HumanMessage(userSide),
    ]);

    // Defence-in-depth: even though the model is schema-bound, force
    // the two rules the prompt calls out (injection=high → reject,
    // off_topic → reject) so a model slip can't slip through.
    if (verdict.injectionRisk === 'high') verdict.allow = false;
    if (verdict.topicCategory === 'off_topic') verdict.allow = false;

    this.logger.info('agent.steward_verdict', {
      allow: verdict.allow,
      topicCategory: verdict.topicCategory,
      injectionRisk: verdict.injectionRisk,
    });

    return verdict;
  }
}
