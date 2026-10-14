import { z } from 'zod';

/**
 * The contract the Conversation Steward LLM call must return. Validated
 * server-side via the model.withStructuredOutput() binding (LangChain
 * handles the JSON-mode tool plumbing for Gemini), so a malformed
 * response throws a ZodError at the handler boundary — no regex-over-
 * freeform-text needed.
 */
export const StewardVerdictSchema = z.object({
  /** Should the planner run, or is this message out of scope / unsafe? */
  allow: z.boolean(),
  /** Short, ≤ 200 chars. Drives the canned reply and the audit log. */
  reason: z.string().max(200).nullable(),
  /**
   * The message the planner will see. v1 default is the user message
   * passed through verbatim. Redacted only if the user typed a 6-digit
   * OTP-shaped code, a password, or a credit-card number — those are
   * replaced with the literal string "[redacted]".
   */
  sanitizedMessage: z.string().min(1).max(8000),
  /** The model's own read of injection risk. "high" forces allow=false. */
  injectionRisk: z.enum(['none', 'low', 'high']),
  /** Coarse routing signal. "off_topic" forces allow=false. */
  topicCategory: z.enum([
    'profile',
    'contacts',
    'cards',
    'sharing',
    'reminders',
    'conversational',
    'off_topic',
  ]),
  /**
   * 1–3 sentence recap of where the conversation is right now, written
   * for the planner (NOT the user). Empty string on the first turn of
   * a thread. Injected into the planner's system prompt.
   */
  plannerBrief: z.string().max(600),
});

export type StewardVerdict = z.infer<typeof StewardVerdictSchema>;
