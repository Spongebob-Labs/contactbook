import { Annotation, MessagesValue } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

/**
 * The graph state. `messages` is the full history (for the checkpointer
 * and the audit log); `plannerContext` is the last-N curated window the
 * planner node actually sees, so token cost stays bounded. The
 * synthesiser uses the same sliced context.
 *
 * `plannerBrief` is the Steward's free-form recap, injected into the
 * planner's system prompt. Empty string on the first turn of a thread.
 */
export const AgentState = Annotation.Root({
  messages: MessagesValue, // full history (BaseMessage[])
  plannerContext: Annotation<BaseMessage[]>({
    reducer: (_left, right) => right ?? [],
    default: () => [] as BaseMessage[],
  }),
  plannerBrief: Annotation<string>({
    reducer: (_left, right) => right ?? '',
    default: () => '',
  }),
  // For the synthesiser's reply — same shape, populated by the preprocess
  // node alongside plannerContext.
  synthesiserContext: Annotation<BaseMessage[]>({
    reducer: (_left, right) => right ?? [],
    default: () => [] as BaseMessage[],
  }),
  // Set by the planner/synthesiser when they produce a final reply
  // (no more tool calls). The handler reads this to format the WhatsApp
  // response. Kept as a separate channel from `messages` so the audit
  // log can record the canonical answer and the message stream can
  // contain the model's intermediate reasoning/tool chatter.
  finalAnswer: Annotation<string | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentState.State;
