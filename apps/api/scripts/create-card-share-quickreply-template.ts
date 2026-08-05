/**
 * Creates a Twilio Content Template (whatsapp/card) with a QUICK_REPLY button for the
 * two-message WhatsApp card-share flow:
 *
 *   1. This template is sent to the recipient (cold contact, no 24-hour session).
 *   2. Recipient taps "Get Contact" → WhatsApp delivers a quick-reply message to our number.
 *   3. Twilio fires POST /api/v1/webhooks/twilio/incoming — we detect the reply and
 *      immediately send the .vcf file as a WhatsApp document.
 *   4. Recipient taps the contact card → "Add to Contacts" → native phonebook import.
 *
 * Unlike the URL-button template (card_share_image_v2_html), this template has NO URL
 * button — WhatsApp templates must use either all quick-reply buttons OR all URL/phone
 * buttons, never a mix. Variable {{4}} (vcf object key) is therefore omitted.
 *
 * Variable numbering:
 *   {{1}} — sender display name
 *   {{2}} — card name
 *   {{3}} — optional note (single space fallback to avoid Twilio error 21656)
 *
 * Usage (from repo root):
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/create-card-share-quickreply-template.ts \
 *     --name=card_share_v3_quick_reply \
 *     --image=/path/to/header.png \
 *     [--body='...'] [--button-title='Get Contact'] [--category=UTILITY] \
 *     [--no-submit] [--yes]
 *
 * Without --yes only previews — safe to re-run.
 *
 * After WhatsApp approval, activate as the default template with:
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/register-whatsapp-template.ts \
 *     --key=card_share_v3_quick_reply --content-sid=<SID> \
 *     --body='<body text>' --default --yes
 */
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { Storage } from "@google-cloud/storage";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, WhatsappTemplateUseCase } from "@prisma/client";
import { Pool } from "pg";

const apiDir = resolve(__dirname, "..");
loadEnv({ path: resolve(apiDir, ".env") });
loadEnv({ path: resolve(apiDir, ".env.local"), override: true });

const CONTENT_API_BASE = "https://content.twilio.com/v1/Content";

const DEFAULT_BODY =
  'Hi! {{1}} shared their contact card "{{2}}" with you on ContactBook.{{3}}\n\nTap the button below — I\'ll send you the contact file so you can save it straight to your phonebook.';
const DEFAULT_BUTTON_TITLE = "Get Contact";
const DEFAULT_VARIABLES: Record<string, string> = {
  "1": "Ada Lovelace",
  "2": "Business Card",
  "3": " Great meeting you!",
};

function flagValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("--") && !a.includes("=")));
  const name = flagValue(argv, "name")?.trim();
  if (!name) throw new Error("Missing required --name=<template_name>");

  const imagePath = flagValue(argv, "image")?.trim();
  if (!imagePath) throw new Error("Missing required --image=/path/to/header.png");

  const bucket = process.env.GCS_CARD_SHARES_BUCKET ?? "";
  if (!bucket) throw new Error("GCS_CARD_SHARES_BUCKET not set in .env");

  const baseUrl = (process.env.GCS_CARD_SHARES_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error("GCS_CARD_SHARES_PUBLIC_BASE_URL not set in .env");

  return {
    name,
    imagePath,
    bucket,
    baseUrl,
    body: flagValue(argv, "body") ?? DEFAULT_BODY,
    buttonTitle: flagValue(argv, "button-title") ?? DEFAULT_BUTTON_TITLE,
    category: flagValue(argv, "category") ?? "UTILITY",
    submit: !flags.has("--no-submit"),
    yes: flags.has("--yes"),
  };
}

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set");
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set in .env");
  const pool = new Pool({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? false
      : { rejectUnauthorized: false },
  });
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
}

function imageExt(imagePath: string): string {
  const lower = imagePath.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return "jpg";
}

function imageMime(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function uploadImage(
  imagePath: string,
  bucket: string,
  templateName: string,
): Promise<{ objectKey: string; url: string }> {
  const projectId = process.env.GCS_PROJECT_ID;
  const storage = new Storage(projectId ? { projectId } : undefined);
  const buffer = readFileSync(imagePath);
  const ext = imageExt(imagePath);
  const mimeType = imageMime(ext);
  const objectKey = `templates/${templateName}.${ext}`;

  await storage.bucket(bucket).file(objectKey).save(buffer, {
    resumable: false,
    metadata: {
      contentType: mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const baseUrl = (process.env.GCS_CARD_SHARES_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  return { objectKey, url: `${baseUrl}/${objectKey}` };
}

async function createContent(
  name: string,
  body: string,
  buttonTitle: string,
  headerImageUrl: string,
): Promise<string> {
  // whatsapp/card with a QUICK_REPLY button. WhatsApp requires buttons to be either ALL
  // quick-reply OR ALL URL/phone — mixing is not allowed. Since we need quick-reply here,
  // there is no URL button (unlike the URL-button variant).
  const payload = {
    friendly_name: name,
    language: "en",
    variables: DEFAULT_VARIABLES,
    types: {
      "whatsapp/card": {
        body,
        media: [headerImageUrl],
        actions: [{ type: "QUICK_REPLY", title: buttonTitle }],
      },
    },
  };

  const res = await fetch(CONTENT_API_BASE, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Content create failed (${res.status}): ${JSON.stringify(json)}`);
  }
  console.log(`Created content template SID: ${json.sid as string}`);
  return json.sid as string;
}

async function submitForApproval(
  contentSid: string,
  name: string,
  category: string,
): Promise<string> {
  const res = await fetch(
    `${CONTENT_API_BASE}/${contentSid}/ApprovalRequests/whatsapp`,
    {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ name, category }),
    },
  );
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Approval submission failed (${res.status}): ${JSON.stringify(json)}`);
  }
  console.log(`Submitted for WhatsApp approval. Status: ${json.status as string}`);
  return (json.status as string) ?? "received";
}

async function saveToDb(
  prisma: PrismaClient,
  key: string,
  contentSid: string,
  bodyPreview: string,
): Promise<void> {
  const existing = await prisma.whatsappTemplate.findUnique({ where: { key } });
  await prisma.whatsappTemplate.upsert({
    where: { key },
    create: {
      key,
      useCase: WhatsappTemplateUseCase.CARD_SHARE,
      contentSid,
      locale: "en",
      bodyPreview,
      isActive: false,
      isDefault: false,
    },
    update: {
      contentSid,
      bodyPreview,
      isActive: false,
    },
  });
  console.log(
    existing
      ? `Updated DB row for "${key}".`
      : `Created DB row for "${key}" (isActive: false — activate after WhatsApp approval).`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const ext = imageExt(args.imagePath);
  const imageObjectKey = `templates/${args.name}.${ext}`;
  const imagePublicUrl = `${args.baseUrl}/${imageObjectKey}`;

  console.log("\nPlan:");
  console.log(`  1. Upload image     ${args.imagePath}`);
  console.log(`                   → gs://${args.bucket}/${imageObjectKey}`);
  console.log(`                   → ${imagePublicUrl}`);
  console.log(`  2. Create Twilio template "${args.name}" (whatsapp/card, QUICK_REPLY button)`);
  console.log(`     header image:   ${imagePublicUrl}`);
  console.log(`     body:           ${args.body}`);
  console.log(`     button:         "${args.buttonTitle}" (QUICK_REPLY — triggers VCF document reply)`);
  console.log(`     category:       ${args.category}`);
  console.log(`  3. Submit for WhatsApp approval: ${args.submit}`);
  console.log(`  4. Upsert DB row (isActive: false)`);
  console.log();
  console.log("NOTE: Register the incoming webhook URL in Twilio console:");
  console.log(
    `  Phone Number → "A MESSAGE COMES IN" → Webhook → POST ${process.env.APP_PUBLIC_URL ?? "<APP_PUBLIC_URL>"}/api/v1/webhooks/twilio/incoming`,
  );

  if (!args.yes) {
    console.log("\nPreview only — re-run with --yes to execute.");
    return;
  }

  console.log("\nStep 1: Uploading image to GCS...");
  const { url: uploadedUrl } = await uploadImage(args.imagePath, args.bucket, args.name);
  console.log(`  Uploaded → ${uploadedUrl}`);

  console.log("\nStep 2: Creating Twilio Content Template...");
  const contentSid = await createContent(
    args.name,
    args.body,
    args.buttonTitle,
    uploadedUrl,
  );

  if (args.submit) {
    console.log("\nStep 3: Submitting for WhatsApp approval...");
    await submitForApproval(contentSid, args.name, args.category);
  }

  console.log("\nStep 4: Saving to DB...");
  const { prisma, pool } = createPrisma();
  try {
    await saveToDb(prisma, args.name, contentSid, args.body);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  console.log(`\nDone! Content SID: ${contentSid}`);
  console.log("\nNext steps:");
  console.log("  1. Wait for WhatsApp template approval (usually 24-48h).");
  console.log("  2. Configure the incoming webhook in Twilio console:");
  console.log(
    `       Phone Number → "A MESSAGE COMES IN" → POST ${process.env.APP_PUBLIC_URL ?? "<APP_PUBLIC_URL>"}/api/v1/webhooks/twilio/incoming`,
  );
  console.log("  3. Activate and set as default after approval:");
  console.log(
    `       pnpm -C apps/api exec ts-node --transpile-only scripts/register-whatsapp-template.ts \\`,
  );
  console.log(
    `         --key=${args.name} --content-sid=${contentSid} --body='${args.body}' --default --yes`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
