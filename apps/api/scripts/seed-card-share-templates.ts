/**
 * Seeds the canonical minimal set of CARD_SHARE WhatsApp templates: creates each one on
 * Twilio (Content API), submits it for WhatsApp approval, and registers the DB row in
 * the same shape the sync service maintains. These template-cards are what users pick
 * from in the share flow — one row per Twilio ContentSid, strictly 1:1.
 *
 * Idempotent by key: templates whose key already exists in the DB are skipped, so the
 * script is safe to re-run (e.g. after adding a new template to the set below).
 *
 * Go-live path: seed → Meta approves (minutes to ~24h) → the 10-minute sync cron flips
 * approvalStatus to APPROVED → the template appears in the picker automatically.
 *
 * Usage (from repo root):
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/seed-card-share-templates.ts [--yes]
 *
 * Without --yes this only previews what would be created — safe to re-run.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const apiDir = resolve(__dirname, "..");
loadEnv({ path: resolve(apiDir, ".env") });
loadEnv({ path: resolve(apiDir, ".env.local"), override: true });

const CONTENT_API_BASE = "https://content.twilio.com/v1/Content";
const CATEGORY = "UTILITY";
const BUTTON_TITLE = "Save Contact";

/**
 * The canonical minimal template set. Bodies use {{1}} sender name, {{2}} card name,
 * {{3}} note (single space when empty — bodies must read cleanly either way).
 * {{4}} (vcf object key) goes in the button URL, never the body.
 */
const TEMPLATES: Array<{ key: string; body: string }> = [
  {
    key: "card_share_classic_en",
    body: 'New contact card: {{1}} shared "{{2}}" with you on ContactBook.{{3}} Tap the button below to save it to your phone.',
  },
  {
    key: "card_share_warm_en",
    body: 'Hi! {{1}} wants to stay in touch and sent you their "{{2}}" card.{{3}} Save their details with one tap below.',
  },
  {
    key: "card_share_minimal_en",
    body: '{{1}} shared "{{2}}" with you.{{3}} Tap below to save the contact.',
  },
];

// Same sample values the API uses when creating templates (twilio-content-api.service.ts).
const SAMPLE_VARIABLES: Record<string, string> = {
  "1": "Ada Lovelace",
  "2": "Business Card",
  "3": " Great meeting you!",
  "4": "sample/contact.vcf",
};

function resolveSslConfig(
  connectionString: string | undefined,
): false | { rejectUnauthorized: boolean } {
  if (!connectionString) {
    return false;
  }
  try {
    const url = new URL(connectionString);
    const host = url.hostname.toLowerCase();
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    if (sslMode === "disable") {
      return false;
    }
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return false;
    }
    return { rejectUnauthorized: false };
  } catch {
    return false;
  }
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in apps/api/.env");
  }
  const pool = new Pool({
    connectionString,
    ssl: resolveSslConfig(connectionString),
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool };
}

function authHeader(): string {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set in apps/api/.env");
  }
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

async function createContent(
  name: string,
  body: string,
  baseUrl: string,
): Promise<string> {
  const res = await fetch(CONTENT_API_BASE, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: name,
      language: "en",
      variables: SAMPLE_VARIABLES,
      types: {
        "twilio/call-to-action": {
          body,
          actions: [{ type: "URL", title: BUTTON_TITLE, url: `${baseUrl}/{{4}}` }],
        },
      },
    }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Content creation failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.sid as string;
}

async function submitForApproval(
  contentSid: string,
  name: string,
): Promise<string> {
  const res = await fetch(
    `${CONTENT_API_BASE}/${contentSid}/ApprovalRequests/whatsapp`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, category: CATEGORY }),
    },
  );
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `WhatsApp approval submission failed (${res.status}): ${JSON.stringify(json)}`,
    );
  }
  return ((json.status as string) ?? "unknown").toUpperCase();
}

async function main() {
  const yes = process.argv.includes("--yes");
  const baseUrl = (process.env.GCS_CARD_SHARES_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("GCS_CARD_SHARES_PUBLIC_BASE_URL is not set in apps/api/.env");
  }

  const { prisma, pool } = createPrisma();
  try {
    const existing = await prisma.whatsappTemplate.findMany({
      where: { key: { in: TEMPLATES.map((t) => t.key) } },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((t) => t.key));
    const toCreate = TEMPLATES.filter((t) => !existingKeys.has(t.key));

    for (const t of TEMPLATES) {
      const status = existingKeys.has(t.key) ? "exists — skipping" : "will create";
      console.log(`  ${t.key}: ${status}`);
    }
    if (toCreate.length === 0) {
      console.log("\nNothing to do — all templates already registered.");
      return;
    }
    if (!yes) {
      console.log("\nPreview only — re-run with --yes to create on Twilio + register in DB.");
      return;
    }

    for (const t of toCreate) {
      const contentSid = await createContent(t.key, t.body, baseUrl);
      console.log(`\n${t.key}: created on Twilio (${contentSid})`);

      const approvalRaw = await submitForApproval(contentSid, t.key);
      const approvalStatus = ["APPROVED", "PENDING", "RECEIVED", "REJECTED"].includes(
        approvalRaw,
      )
        ? (approvalRaw as "APPROVED" | "PENDING" | "RECEIVED" | "REJECTED")
        : "UNKNOWN";
      console.log(`${t.key}: submitted for WhatsApp approval (${approvalStatus})`);

      await prisma.whatsappTemplate.create({
        data: {
          key: t.key,
          useCase: "CARD_SHARE",
          contentSid,
          locale: "en",
          bodyPreview: t.body,
          buttonTitle: BUTTON_TITLE,
          isActive: true,
          approvalStatus,
          // Content was just pushed to Twilio, so it's in sync by construction.
          syncStatus: "IN_SYNC",
          syncedAt: new Date(),
        },
      });
      console.log(`${t.key}: registered in DB`);
    }

    console.log(
      "\nDone. Templates appear in the share picker automatically once Meta approves them" +
        " (the 10-minute sync cron mirrors approval status; or force it with" +
        " POST /v1/whatsapp-templates/:key/sync).",
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
