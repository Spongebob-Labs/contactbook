import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ContactsService } from '../../../contacts/contacts.service';
import { getUserId } from './_shared';
import { maskPhone } from '../../../common/logging/redact';

/**
 * `list_my_contacts` — read tool. Returns the caller's contacts with
 * `phoneE164` masked (per the existing AppLogger.redact() discipline)
 * so the LLM never sees raw phone numbers in tool output. Display
 * names and notes are passed through (the owner wrote them; the LLM
 * needs them to reason about who is who).
 */
export function buildListMyContactsTool(contacts: ContactsService) {
  return tool(
    async (_args, config) => {
      const userId = getUserId(config);
      const rows = await contacts.list(userId);
      return JSON.stringify(
        rows.map((r) => ({
          id: r.id,
          displayName: r.displayName,
          phoneE164: maskPhone(r.phoneE164),
          notes: r.notes,
          source: r.source,
          createdAt: r.createdAt,
        })),
      );
    },
    {
      name: 'list_my_contacts',
      description:
        "List the caller's contacts — the people they've shared cards with or imported. Phone numbers are masked. Use this when the user asks 'who's in my contacts', 'do I have a contact for X', or needs to pick someone to share a card with.",
      schema: z.object({}),
    },
  );
}
