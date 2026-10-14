import type { AgentStateType } from '../state';
import { ChatRecordService } from '../../chat-record/chat-record.service';
import { ContextBuilder } from '../../guardrails/context.builder';

/**
 * The first node on every graph run. Builds the `plannerContext` and
 * `synthesiserContext` from the thread's recent history. The
 * `plannerBrief` (the Steward's recap) and the human `messages` for
 * the current turn are passed in via the graph's input — the handler
 * is responsible for assembling the input before invoking the graph.
 */
export async function preprocessNode(
  state: AgentStateType,
  records: ChatRecordService,
  context: ContextBuilder,
): Promise<Partial<AgentStateType>> {
  // The handler is expected to pass the current threadId as part of
  // the input under `configurable.threadId`. We surface that via
  // the state; for now, if the input contains a `threadId` field,
  // we use it. (See graph.factory.ts — the handler invokes the
  // graph with `configurable: { thread_id, userId }`; we mirror
  // that into the state at the start of the run.)
  const threadId = (state as unknown as { threadId?: string }).threadId;
  if (!threadId) {
    // No threadId means the handler didn't seed it. The graph can
    // still run with an empty context (first-ever turn, or a test).
    return {};
  }
  const recent = await context.findRecent(threadId);
  const messages = context.toBaseMessages(recent);
  return {
    plannerContext: messages,
    synthesiserContext: messages,
  };
}
