import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { interrupt } from '@langchain/langgraph';
import { ReminderService } from '../../../reminders/reminder.service';
import { getUserId, type ApprovalRequest } from './_shared';

/**
 * `set_reminder` — MUTATE, HITL.
 *
 * The LLM has parsed the user's natural-language time ("tomorrow 9am
 * IST") into an ISO 8601 UTC string via the planner's system prompt
 * (which carries AGENT_DEFAULT_TIMEZONE). The tool:
 *
 *   1. Calls interrupt() with an approval payload → the orchestrator
 *      sends an `agent_approval_en` WhatsApp template with two
 *      quick-reply buttons (✅ Approve / ❌ Decline). The graph
 *      pauses; checkpointer saves.
 *   2. On resume, `decision.approved` is the user's choice. If
 *      approved, the reminder is created. The decision (and any
 *      edits the human made) is recorded in ChatRecord as
 *      APPROVAL_DECISION.
 *
 * Side effect (the DB write) is AFTER the resume, so it runs
 * exactly once — no duplicates on replay. This is the LangGraph
 * "no side effects before interrupt()" rule.
 */
export function buildSetReminderTool(reminders: ReminderService) {
  return tool(
    async (args, config) => {
      const userId = getUserId(config);

      const scheduledFor = new Date(args.whenIso);
      if (isNaN(scheduledFor.getTime())) {
        return JSON.stringify({ ok: false, error: 'whenIso is not a valid ISO 8601 timestamp' });
      }

      const summary = `Set a reminder for ${formatHumanTime(scheduledFor)}: "${args.text}"`;

      const decision = await interrupt({
        kind: 'approval_required',
        action: 'set_reminder',
        summary,
        payload: { text: args.text, whenIso: args.whenIso },
      } satisfies ApprovalRequest);

      // decision comes from the user's button-tap (orchestrator maps
      // it to { approved: true|false }).
      if (!decision || decision.approved !== true) {
        return JSON.stringify({ ok: false, reason: 'declined' });
      }

      // Honour any edits the human made in the approval card.
      const finalText =
        typeof decision.text === 'string' && decision.text.length > 0 ? decision.text : args.text;
      const finalWhen =
        typeof decision.whenIso === 'string' && decision.whenIso.length > 0
          ? new Date(decision.whenIso)
          : scheduledFor;

      const created = await reminders.create(userId, {
        text: finalText,
        scheduledFor: finalWhen,
      });
      return JSON.stringify({
        ok: true,
        reminderId: created.id,
        scheduledFor: created.scheduledFor,
      });
    },
    {
      name: 'set_reminder',
      description:
        "Set a reminder for the caller. Sends a WhatsApp message at the scheduled time. Requires the user to approve via a button card. `whenIso` MUST be UTC ISO 8601 (e.g. '2026-10-15T03:30:00Z' for tomorrow 9am IST).",
      schema: z.object({
        text: z.string().min(1).max(500).describe('The reminder text, 1..500 chars.'),
        whenIso: z
          .string()
          .min(10)
          .describe('UTC ISO 8601 timestamp for when to fire the reminder.'),
      }),
    },
  );
}

/**
 * `list_reminders` — read tool. Up to 20 upcoming PENDING reminders.
 */
export function buildListRemindersTool(reminders: ReminderService) {
  return tool(
    async (_args, config) => {
      const userId = getUserId(config);
      const rows = await reminders.listActive(userId);
      return JSON.stringify(
        rows.map((r) => ({
          id: r.id,
          text: r.text,
          scheduledFor: r.scheduledFor,
        })),
      );
    },
    {
      name: 'list_reminders',
      description:
        "List the caller's upcoming PENDING reminders (max 20, soonest first).",
      schema: z.object({}),
    },
  );
}

/**
 * `cancel_reminder` — MUTATE, HITL.
 */
export function buildCancelReminderTool(reminders: ReminderService) {
  return tool(
    async (args, config) => {
      const userId = getUserId(config);

      // Look the reminder up so the approval card can show a
      // human-readable summary ("cancel the 9am call-mom reminder").
      let existing;
      try {
        existing = await reminders.getOwned(userId, args.reminderId);
      } catch {
        return JSON.stringify({ ok: false, error: 'reminder not found' });
      }

      const summary = `Cancel reminder for ${formatHumanTime(existing.scheduledFor)}: "${existing.text}"`;

      const decision = await interrupt({
        kind: 'approval_required',
        action: 'cancel_reminder',
        summary,
        payload: { reminderId: existing.id, text: existing.text, scheduledFor: existing.scheduledFor },
      } satisfies ApprovalRequest);

      if (!decision || decision.approved !== true) {
        return JSON.stringify({ ok: false, reason: 'declined' });
      }

      const cancelled = await reminders.cancel(userId, existing.id);
      return JSON.stringify({ ok: true, status: cancelled.status });
    },
    {
      name: 'cancel_reminder',
      description:
        "Cancel a PENDING reminder by id. Requires the user to approve via a button card.",
      schema: z.object({
        reminderId: z.string().uuid().describe('The id of the reminder to cancel.'),
      }),
    },
  );
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * Format a Date for the approval card. We deliberately keep this
 * server-side (no LLM) so the summary is deterministic and not
 * influenced by the model's tendency to invent plausible times.
 * The card uses UTC + the user's timezone label.
 */
function formatHumanTime(d: Date): string {
  const iso = d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  return iso;
}
