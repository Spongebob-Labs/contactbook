/**
 * Creates a Twilio Content Template (twilio/call-to-action type — body text + URL button)
 * and submits it for WhatsApp approval, via Twilio's Content API. Uses the existing
 * TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN from apps/api/.env — no DB access.
 *
 * Why call-to-action instead of twilio/media (document header)?
 * WhatsApp template messages only support these media types: application/pdf, image/jpeg,
 * image/png, video/mp4. The text/x-vcard MIME type is only allowed in free-form session
 * messages (within the 24-hour reply window), not in business-initiated template messages.
 * Sending a .vcf URL as a document header causes Twilio error 63029 (receiver failed to
 * download template) on every send. The URL button approach works around this constraint:
 * the recipient taps "Save Contact" → their OS opens the .vcf URL → native contact-import
 * sheet appears — same end result, different delivery mechanism.
 *
 * Variable numbering:
 *   {{1}} — sender display name
 *   {{2}} — card name
 *   {{3}} — optional note (falls back to a single space to avoid Twilio error 21656)
 *   {{4}} — vCard object key (e.g. "cardId/contentHash.vcf"), appended to the fixed GCS
 *            base URL in the button. Variable 4 lives in the button URL, not the body.
 *
 * The GCS base URL (GCS_CARD_SHARES_PUBLIC_BASE_URL from .env) is baked into the template
 * at creation time. If the bucket or base URL ever changes, a new template must be created.
 *
 * Usage (from repo root):
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/create-card-share-content-template.ts \
 *     --name=card_share_default_v3 \
 *     [--body='...'] [--button-title='Save Contact'] [--category=UTILITY] [--no-submit] [--yes]
 *
 * Without --yes this only previews the request payloads — safe to re-run.
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const apiDir = resolve(__dirname, "..");
loadEnv({ path: resolve(apiDir, ".env") });
loadEnv({ path: resolve(apiDir, ".env.local"), override: true });

const CONTENT_API_BASE = "https://content.twilio.com/v1/Content";

const DEFAULT_BODY =
  'New contact card: {{1}} shared "{{2}}" with you on ContactBook.{{3}} Tap the button below to save it to your phone.';

const DEFAULT_BUTTON_TITLE = "Save Contact";

// Variable 4 is the .vcf object key (path only — e.g. "cardId/contentHash.vcf").
// The GCS base URL is baked into the template button URL and is not a variable.
const DEFAULT_VARIABLES: Record<string, string> = {
  "1": "Ada Lovelace",
  "2": "Business Card",
  "3": " Great meeting you!",
  "4": "sample/contact.vcf",
};

function flagValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("--") && !a.includes("=")));
  const name = flagValue(argv, "name")?.trim();
  if (!name) {
    throw new Error("Missing required --name=<template_name> (lowercase + underscores only)");
  }
  const baseUrl = (
    flagValue(argv, "base-url") ?? process.env.GCS_CARD_SHARES_PUBLIC_BASE_URL ?? ""
  ).replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error(
      "GCS_CARD_SHARES_PUBLIC_BASE_URL is not set in .env and --base-url was not provided",
    );
  }
  return {
    name,
    body: flagValue(argv, "body") ?? DEFAULT_BODY,
    buttonTitle: flagValue(argv, "button-title") ?? DEFAULT_BUTTON_TITLE,
    baseUrl,
    category: flagValue(argv, "category") ?? "UTILITY",
    submit: !flags.has("--no-submit"),
    yes: flags.has("--yes"),
  };
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
  buttonTitle: string,
  baseUrl: string,
): Promise<string> {
  const payload = {
    friendly_name: name,
    language: "en",
    variables: DEFAULT_VARIABLES,
    types: {
      // twilio/call-to-action: body text + URL button. Variable {{4}} is the .vcf object
      // key (path only); the GCS base URL is fixed in the button so only the path is
      // dynamic per send. WhatsApp URL buttons support exactly one dynamic URL suffix.
      "twilio/call-to-action": {
        body,
        actions: [
          {
            type: "URL",
            title: buttonTitle,
            url: `${baseUrl}/{{4}}`,
          },
        ],
      },
    },
  };

  const res = await fetch(CONTENT_API_BASE, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Content creation failed (${res.status}): ${JSON.stringify(json)}`);
  }
  console.log(`Created content template: sid=${json.sid as string}`);
  return json.sid as string;
}

async function submitForWhatsappApproval(
  contentSid: string,
  name: string,
  category: string,
): Promise<void> {
  const res = await fetch(
    `${CONTENT_API_BASE}/${contentSid}/ApprovalRequests/whatsapp`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, category }),
    },
  );
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`WhatsApp approval submission failed (${res.status}): ${JSON.stringify(json)}`);
  }
  console.log("Submitted for WhatsApp approval:", JSON.stringify(json, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("Will create Content Template:");
  console.log(`  name:        ${args.name}`);
  console.log(`  body:        ${args.body}`);
  console.log(`  button:      "${args.buttonTitle}" → ${args.baseUrl}/{{4}}`);
  console.log(`  var {{4}}:   object key, e.g. "cardId/contentHash.vcf" (path only, not full URL)`);
  console.log(`  category:    ${args.category}`);
  console.log(`  submit for WhatsApp approval: ${args.submit}`);

  if (!args.yes) {
    console.log("\nPreview only — re-run with --yes to actually call Twilio.");
    return;
  }

  const contentSid = await createContent(args.name, args.body, args.buttonTitle, args.baseUrl);

  if (args.submit) {
    await submitForWhatsappApproval(contentSid, args.name, args.category);
  }

  console.log(`\nContent SID: ${contentSid}`);
  console.log(
    "Once WhatsApp approval status flips to Approved in the Twilio Console, register it with:",
  );
  console.log(
    `  npm run register-whatsapp-template -- --key=${args.name} --content-sid=${contentSid} --body='${args.body}' --default --yes`,
  );
  console.log(
    "\nIMPORTANT: also set TWILIO_WHATSAPP_VCARD_BASE_URL in your .env to the GCS base URL",
  );
  console.log(`  TWILIO_WHATSAPP_VCARD_BASE_URL="${args.baseUrl}"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
