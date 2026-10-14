import { SystemMessage } from '@langchain/core/messages';
import { LLM_SERVICE, LlmService } from '../../llm/llm.service';
import type { AgentStateType } from '../state';
import type { StructuredTool } from '@langchain/core/tools';
import { AgentConfig } from '../../agent.config';

/**
 * The planner node. The LLM sees:
 *   - system prompt (with the Steward's plannerBrief, the user's
 *     timezone for natural-language time parsing, and the agent's
 *     scope / persona)
 *   - plannerContext: the last-N BaseMessages
 *   - the current HumanMessage (already in state.messages)
 *
 * The LLM either emits tool calls (we route to the executor) or a
 * final answer (we route to the synthesiser). boundTools is what
 * makes the model emit structured tool_call messages instead of
 * natural-language descriptions of what it would do.
 */
export async function plannerNode(
  state: AgentStateType,
  llm: LlmService,
  cfg: AgentConfig,
  tools: StructuredTool[],
): Promise<Partial<AgentStateType>> {
  // bindTools is optional on BaseChatModel but always present on the
  // concrete providers LlmService exposes (Gemini, OpenAI, Anthropic,
  // Google). Asserting here keeps the planner code free of `if (!...)`
  // branches that the type system can't prove away.
  const model = llm.getPlannerModel().bindTools!(tools);

  const systemText = [
    "You are the user's personal ContactBook assistant on WhatsApp.",
    "Today's date is " + new Date().toISOString().slice(0, 10) + '.',
    `The user's timezone is ${cfg.defaultTimezone}. When the user gives a time, convert it to UTC ISO 8601 (e.g. '2026-10-15T03:30:00Z') before passing it to set_reminder.whenIso.`,
    '',
    '## Standing context from the Conversation Steward',
    state.plannerBrief ||
      '(no prior context — this is the first turn of the thread).',
    '',
    '## Tools',
    "You have read tools (get_my_profile, list_my_contacts, list_reminders) and mutate tools (set_reminder, cancel_reminder). Call the tool that answers the user's CURRENT question — even if a previous turn used the same tool, call it again for fresh data. If the question needs no tool (a greeting, a follow-up remark), reply directly. For mutate tools: the user will be shown an approval card; do not ask for permission in your reply — the tool will pause and the orchestrator handles the confirmation.",
    '',
    '## Output style',
    "Respond in GitHub-flavored markdown (will be converted to WhatsApp by a deterministic formatter). Keep replies short — WhatsApp is a phone, not a dashboard. Use the user's own language.",
  ].join('\n');

  // The planner sees the system prompt + the last 20 messages of the
  // real conversation state. `state.messages` is maintained by
  // LangGraph's reducer. Strip trailing AI messages defensively — the
  // request must never end with a model turn (Gemini 400s otherwise).
  // On a normal turn the tail is the user's new HumanMessage, so this
  // is a no-op; it protects future flows (e.g. a resumed graph that
  // re-enters the planner).
  const history = [...state.messages.slice(-20)];
  while (
    history.length > 0 &&
    history[history.length - 1].getType?.() === 'ai'
  ) {
    history.pop();
  }
  const messages = [new SystemMessage(systemText), ...history];

  const plannerStart = Date.now();
  const response = await model.invoke(messages, {
    // `timeout` in RunnableConfig is ignored by invoke() in this
    // LangChain version — an AbortSignal is the thing that actually
    // races and throws "Aborted" after 25s.
    signal: AbortSignal.timeout(25_000),
  });
  console.log(
    `[agent.timing] planner took ${Date.now() - plannerStart}ms (${state.messages.length} messages in state)`,
  );
  return { messages: [response] };
}

export const PLANNER_SYSTEM_PROMPT_SUFFIX = ''; // placeholder for future split
