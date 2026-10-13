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
  const model = llm.getPlannerModel().bindTools(tools);

  const systemText = [
    "You are the user's personal ContactBook assistant on WhatsApp.",
    "Today's date is " + new Date().toISOString().slice(0, 10) + '.',
    `The user's timezone is ${cfg.defaultTimezone}. When the user gives a time, convert it to UTC ISO 8601 (e.g. '2026-10-15T03:30:00Z') before passing it to set_reminder.whenIso.`,
    '',
    '## Standing context from the Conversation Steward',
    state.plannerBrief || '(no prior context — this is the first turn of the thread).',
    '',
    '## Tools',
    'You have these tools. Prefer calling one over free-form answers whenever the user asks a question that a tool can answer. For mutating tools (set_reminder, cancel_reminder), the user will be shown an approval card; you do NOT need to ask for permission in your reply — the tool will pause and the orchestrator will handle the confirmation.',
    '',
    '## Output style',
    'Respond in GitHub-flavored markdown (will be converted to WhatsApp by a deterministic formatter). Keep replies short — WhatsApp is a phone, not a dashboard. Use the user\'s own language.',
  ].join('\n');

  const messages = [
    new SystemMessage(systemText),
    ...state.plannerContext,
    // The current turn's HumanMessage is already in state.messages at
    // the tail; LangGraph's MessagesValue reducer appended it. The
    // model sees it there.
  ];

  const response = await model.invoke(messages);
  return { messages: [response] };
}

export const PLANNER_SYSTEM_PROMPT_SUFFIX = ''; // placeholder for future split
