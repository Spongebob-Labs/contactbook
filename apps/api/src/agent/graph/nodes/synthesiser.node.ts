import { SystemMessage, AIMessage } from '@langchain/core/messages';
import { LLM_SERVICE, LlmService } from '../../llm/llm.service';
import type { AgentStateType } from '../state';
import { AgentConfig } from '../../agent.config';

/**
 * The synthesiser node. The LLM sees the full conversation (planner
 * output, tool results, the current turn) and produces the final
 * user-facing reply in markdown. No tools bound — the planner has
 * already done its job; the synth's only job is to write a good
 * WhatsApp-friendly answer.
 *
 * Temperature is slightly higher than the planner (0.4 vs 0) for
 * more natural prose — the synth isn't doing structured selection,
 * it's talking to a person.
 */
export async function synthesiserNode(
  state: AgentStateType,
  llm: LlmService,
  cfg: AgentConfig,
): Promise<Partial<AgentStateType>> {
  const model = llm.getSynthesiserModel();

  const systemText = [
    "You are the user's personal ContactBook assistant on WhatsApp.",
    `The user's timezone is ${cfg.defaultTimezone}.`,
    '',
    '## Output style',
    "Respond in GitHub-flavored markdown — a deterministic formatter will convert it to WhatsApp formatting (bold via *bold*, italic via _italic_, bullet lists via •, etc.). Keep replies short. Use the user's own language.",
    'Do NOT include any tool calls, JSON, or system-internal references. Just the answer.',
    'If the most recent turn was a tool result the user should know about, fold the result into a friendly reply. If the tool said "declined" (the user tapped ❌), acknowledge without re-asking.',
  ].join('\n');

  const messages = [new SystemMessage(systemText), ...state.synthesiserContext];

  const response = await model.invoke(messages);
  const finalAnswer =
    typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

  return {
    messages: [new AIMessage(finalAnswer)],
    finalAnswer,
  };
}
