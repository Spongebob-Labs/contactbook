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
    '',
    '**Always give a complete answer to the user\'s current question.** Even if a previous turn already addressed the same question (the conversation is in the checkpointer), the user asked again — give them the answer in full. Do not skip to a closing remark like "want to add or update anything?" without first restating the substance. Format: short summary of the answer, then optionally a single follow-up question.',
    'If the most recent turn was a tool result the user should know about, fold the result into a friendly reply. If the tool said "declined" (the user tapped ❌), acknowledge without re-asking.',
  ].join('\n');

  // The synth sees the system prompt + the last 10 messages of the
  // real conversation state — MINUS any trailing model turns.
  //
  // Gemini rejects requests that end with a model turn ("Requests
  // ending with a model turn are not supported"). When the planner
  // answers directly (no tool call), its AIMessage sits at the tail
  // and the synth's request would 400. Strip trailing AI messages so
  // the request ends with the user's question or a tool result.
  const history = [...state.messages.slice(-10)];
  while (
    history.length > 0 &&
    history[history.length - 1].getType?.() === 'ai'
  ) {
    history.pop();
  }
  const messages = [new SystemMessage(systemText), ...history];

  const synthStart = Date.now();
  console.log(`[agent.timing] synthesiser starting (${state.messages.length} messages in state)`);
  const response = await model.invoke(messages, {
    // Same as planner: AbortSignal is the working timeout mechanism.
    signal: AbortSignal.timeout(25_000),
  });
  console.log(
    `[agent.timing] synthesiser took ${Date.now() - synthStart}ms (${state.messages.length} messages in state)`,
  );
  const finalAnswer = extractText(response.content);

  if (!finalAnswer.trim()) {
    // Fail loudly: an empty reply reaching the user is worse than a
    // 500 the logs can attribute. The caller (controller / outbox
    // handler) decides how to surface it.
    throw new Error(
      'SYNTHESISER_EMPTY_RESPONSE: the model returned no text. ' +
        'Raw content: ' +
        (typeof response.content === 'string'
          ? response.content.slice(0, 200)
          : JSON.stringify(response.content).slice(0, 200)),
    );
  }

  return {
    messages: [new AIMessage(finalAnswer)],
    finalAnswer,
  };
}

/**
 * Gemini content can arrive as a plain string OR as an array of
 * content blocks ([{type:'text', text:'...'}, ...]). Normalise to
 * the text only — ignore functionCall/thought blocks.
 */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (c): c is { type: string; text?: unknown } =>
          !!c && typeof c === 'object' && 'type' in c,
      )
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('');
  }
  return String(content ?? '');
}
