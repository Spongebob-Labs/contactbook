/**
 * Helpers shared by every tool file: extracting `userId` from the
 * LangGraph RunnableConfig, and the canonical `interrupt()` payload
 * shape for HITL approval requests.
 *
 * Tools NEVER receive `userId` from the LLM (the LLM cannot pass it
 * in a tool call, because it's not in any Zod schema). The executor
 * node sets `config.configurable.userId` before every tool invocation.
 * This is the same IDOR discipline the existing services follow.
 */
import type { RunnableConfig } from '@langchain/core/runnables';

export function getUserId(config: RunnableConfig): string {
  const uid = config?.configurable?.userId;
  if (typeof uid !== 'string' || !uid) {
    throw new Error(
      'userId missing from RunnableConfig.configurable — executor must inject it.',
    );
  }
  return uid;
}

/**
 * The payload a mutating tool passes to interrupt(). The agent
 * orchestrator turns this into an `agent_approval_en` WhatsApp
 * template send (with two quick-reply buttons), and the user's
 * button-tap or freeform reply is fed back as the resume value.
 */
export interface ApprovalRequest {
  kind: 'approval_required';
  /** The action the tool would take. Free-form, used for the summary. */
  action: string;
  /** Human-readable summary for the approval card. */
  summary: string;
  /** The proposed tool arguments (for review/edit). */
  payload: Record<string, unknown>;
}
