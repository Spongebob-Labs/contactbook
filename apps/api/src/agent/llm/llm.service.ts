import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Abstract LLM provider for the agent. Every LangGraph node that needs an
 * LLM (planner, tools-bound model, synthesiser, the Conversation Steward)
 * receives one of these — never a concrete ChatModel directly. Swapping
 * from Gemini to OpenAI / Anthropic is a new LlmService implementation
 * bound to the LLM_SERVICE token; zero graph-code change.
 *
 * The four roles are split so a cheap, fast model can drive tool selection
 * (planner) and guardrail judgment (steward) while a heavier reasoning
 * model handles the final user-facing reply (synthesiser) and any
 * tool-bound reasoning inside mutate tools (tools). v1 wires all four
 * to Gemini; the names map to env vars GEMINI_MODEL_*.
 */
export const LLM_SERVICE = Symbol('LLM_SERVICE');

export abstract class LlmService {
  /** Drives tool selection. Bound with `bindTools(tools)` in the planner node. */
  abstract getPlannerModel(): BaseChatModel;
  /** Used to bind tools for tool-bound reasoning in mutate tools (if needed). */
  abstract getToolModel(): BaseChatModel;
  /** Final user-facing reply. No tools bound. Slightly higher temperature OK. */
  abstract getSynthesiserModel(): BaseChatModel;
  /** The Conversation Steward. Used with `withStructuredOutput(verdictSchema)`. */
  abstract getStewardModel(): BaseChatModel;
}
