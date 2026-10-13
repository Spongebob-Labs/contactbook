import { Injectable } from '@nestjs/common';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { ChatRecord, ChatRole, ChatRecordKind } from '@prisma/client';
import { ChatRecordService } from '../chat-record/chat-record.service';
import { AgentConfig } from '../agent.config';

/**
 * Builds the two views of recent history the agent needs:
 *
 *  1. `formatTranscript` — a compact plain-text transcript for the
 *     Steward LLM call (the model's context window is text, not structured
 *     chat messages).
 *
 *  2. `buildPlannerContext` — the raw last-N `BaseMessage`s for the
 *     planner node, so LangGraph's `MessagesValue` reducer and the
 *     planner's tool-calling loop see a proper chat history.
 *
 * The last-N window is deterministic and code-controlled (env:
 * AGENT_CONTEXT_WINDOW_MESSAGES, default 20). The LLM does NOT decide
 * what's in the window — only the `plannerBrief` (produced by the
 * Steward) provides a free-form recap on top.
 */
@Injectable()
export class ContextBuilder {
  constructor(
    private readonly records: ChatRecordService,
    private readonly cfg: AgentConfig,
  ) {}

  /**
   * Fetch the last N ChatRecord rows for a thread, oldest → newest.
   * Used by both the Steward (to format a transcript) and the planner
   * (to seed `plannerContext`).
   */
  async findRecent(threadId: string, n = this.cfg.contextWindowMessages): Promise<ChatRecord[]> {
    return this.records.findRecent(threadId, n);
  }

  /**
   * Render a chronological transcript for the Steward's text-in context.
   * Tool calls/results are collapsed to a single "[tool: name] line each
   * — the Steward doesn't need the full JSON to judge safety/topic.
   */
  formatTranscript(records: ChatRecord[]): string {
    if (records.length === 0) return '(no prior messages)';
    return records
      .map((r) => {
        const ts = r.createdAt.toISOString();
        switch (r.role) {
          case ChatRole.USER:
            return `[${ts}] user: ${r.content ?? ''}`;
          case ChatRole.ASSISTANT:
            return `[${ts}] assistant: ${r.content ?? ''}`;
          case ChatRole.TOOL:
            return `[${ts}] tool(${r.toolName ?? '?'}): ${summariseToolResult(r.toolResult)}`;
          case ChatRole.SYSTEM:
            return `[${ts}] system: ${r.content ?? ''}`;
        }
      })
      .join('\n');
  }

  /**
   * Convert the last-N ChatRecords to LangChain `BaseMessage`s, oldest →
   * newest, for the planner's `MessagesValue` state. The user message
   * on the CURRENT turn is appended by the agent handler (it has not
   * been written to ChatRecord yet at the time the graph runs).
   *
   * For APPROVAL_REQUEST / APPROVAL_DECISION / INTERRUPT_OTHER rows
   * we surface them as `AIMessage`s containing the human-readable
   * summary so the planner can reason about what just happened in the
   * HITL flow.
   */
  toBaseMessages(records: ChatRecord[]): BaseMessage[] {
    const out: BaseMessage[] = [];
    for (const r of records) {
      switch (r.kind) {
        case ChatRecordKind.USER_MESSAGE:
          if (r.content) out.push(new HumanMessage(r.content));
          break;
        case ChatRecordKind.ASSISTANT_TEXT:
          if (r.content) out.push(new AIMessage(r.content));
          break;
        case ChatRecordKind.TOOL_CALL: {
          // Surface a synthetic AIMessage representing the model's tool choice
          // so the planner can chain ("after calling X, I should call Y").
          const summary = `[previously called ${r.toolName ?? 'a tool'}]`;
          out.push(new AIMessage(summary));
          break;
        }
        case ChatRecordKind.TOOL_RESULT: {
          // tool_call_id is required by LangChain; use a synthetic id
          // (the LLM only needs the *shape*; the original id is in the
          // record for debugging).
          out.push(
            new ToolMessage({
              content: summariseToolResult(r.toolResult),
              tool_call_id: r.toolCallId ?? 'historical',
              name: r.toolName ?? undefined,
            }),
          );
          break;
        }
        case ChatRecordKind.APPROVAL_REQUEST:
        case ChatRecordKind.APPROVAL_DECISION:
        case ChatRecordKind.INTERRUPT_OTHER:
          if (r.content) out.push(new AIMessage(r.content));
          break;
      }
    }
    return out;
  }
}

function summariseToolResult(result: unknown): string {
  if (result == null) return '(no result)';
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result).slice(0, 1000);
  } catch {
    return '(unserialisable result)';
  }
}
