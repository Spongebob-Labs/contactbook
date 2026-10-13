/**
 * One-shot seed: registers the three WhatsApp templates the agent
 * needs (`agent_reply_en`, `agent_approval_en`, `reminder_en`) with
 * `approvalStatus=UNKNOWN` and placeholder `contentSid`s. Run once
 * after the agent migration:
 *
 *   pnpm --filter api ts-node prisma/seed-templates.ts
 *
 * Then, in Twilio Console:
 *   1. Create the three Content templates and submit them for
 *      WhatsApp approval. The approval template MUST have two
 *      quick-reply buttons (✅ Approve / ❌ Decline).
 *   2. Copy each contentSid and PATCH the row to set
 *      `approvalStatus='APPROVED'` and the real `contentSid`:
 *
 *      curl -X PATCH http://localhost:8000/api/v1/templates/<id> \\
 *        -H "Authorization: Bearer $TOKEN" \\
 *        -H 'Content-Type: application/json' \\
 *        -d '{"contentSid":"HX...","approvalStatus":"APPROVED"}'
 *
 * Until each template is APPROVED, the corresponding outbox handler
 * will throw and the dispatcher will retry — same posture as the
 * not-yet-configured CARD_SHARE template in CardsController.share.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEMPLATES = [
  {
    key: 'agent_reply_en',
    purpose: 'AGENT_REPLY' as const,
    contentSid: 'PLACEHOLDER_AGENT_REPLY_CONTENT_SID',
    bodyPreview: '{{1}}',
    variableSchema: { '1': 'reply' },
  },
  {
    key: 'agent_approval_en',
    purpose: 'AGENT_APPROVAL' as const,
    contentSid: 'PLACEHOLDER_AGENT_APPROVAL_CONTENT_SID',
    bodyPreview: 'Approve this action?\n\n*{{1}}*',
    buttonLabel: null,
    variableSchema: { '1': 'summary' },
  },
  {
    key: 'reminder_en',
    purpose: 'REMINDER' as const,
    contentSid: 'PLACEHOLDER_REMINDER_CONTENT_SID',
    bodyPreview: '🔔 Reminder: {{1}}',
    variableSchema: { '1': 'reminderText' },
  },
];

async function main() {
  for (const t of TEMPLATES) {
    const existing = await prisma.whatsAppTemplate.findFirst({
      where: { OR: [{ key: t.key }, { contentSid: t.contentSid }] },
    });
    if (existing) {
      console.log(`[skip] ${t.key} already registered (id=${existing.id})`);
      continue;
    }
    const created = await prisma.whatsAppTemplate.create({
      data: {
        key: t.key,
        purpose: t.purpose,
        contentSid: t.contentSid,
        bodyPreview: t.bodyPreview,
        buttonLabel: t.buttonLabel ?? null,
        variableSchema: t.variableSchema,
        approvalStatus: 'UNKNOWN',
        isActive: true,
      },
    });
    console.log(`[ok]   registered ${t.key} (id=${created.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
