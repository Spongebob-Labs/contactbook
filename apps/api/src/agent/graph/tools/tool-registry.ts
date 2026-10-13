import type { StructuredTool } from '@langchain/core/tools';
import { ProfileOnboardingService } from '../../../profile/profile-onboarding.service';
import { ContactsService } from '../../../contacts/contacts.service';
import { ReminderService } from '../../../reminders/reminder.service';
import { buildGetMyProfileTool } from './profile.tools';
import { buildListMyContactsTool } from './contacts.tools';
import {
  buildSetReminderTool,
  buildListRemindersTool,
  buildCancelReminderTool,
} from './reminders.tools';

/**
 * The tool registry. Adding a new tool = write the wrapper, drop it
 * in `buildAllTools`, done. The graph binds whatever this returns.
 *
 * Mutating tools are tracked in MUTATING_TOOLS for observability
 * (the executor logs which tools would require approval); the
 * approval *enforcement* still lives inside each tool via
 * `interrupt()`, per the LangGraph canonical pattern.
 */
export const MUTATING_TOOLS: ReadonlySet<string> = new Set([
  'set_reminder',
  'cancel_reminder',
]);

export interface AgentServices {
  profile: ProfileOnboardingService;
  contacts: ContactsService;
  reminders: ReminderService;
}

export function buildAllTools(svcs: AgentServices): StructuredTool[] {
  return [
    buildGetMyProfileTool(svcs.profile),
    buildListMyContactsTool(svcs.contacts),
    buildSetReminderTool(svcs.reminders),
    buildListRemindersTool(svcs.reminders),
    buildCancelReminderTool(svcs.reminders),
  ];
}
