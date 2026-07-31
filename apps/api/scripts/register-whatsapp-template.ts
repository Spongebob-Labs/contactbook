/**
 * Registers (or updates) a WhatsappTemplate row once Twilio has approved a Content
 * Template — see docs/whatsapp-card-share/runbook.md for the Twilio-side steps that
 * produce the Content SID this script needs.
 *
 * Usage (from repo root):
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/register-whatsapp-template.ts \
 *     --key=card_share_default_en \
 *     --content-sid=HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
 *     --body='{{1}} shared their contact card "{{2}}" with you on ContactBook.{{3}}' \
 *     [--use-case=CARD_SHARE] [--locale=en] [--default] [--inactive] \
 *     [--yes]
 *
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/register-whatsapp-template.ts \
 *     --deactivate --key=card_share_default_en --yes
 *
 * Without --yes this only previews the change (upsert-by-key; safe to re-run).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, WhatsappTemplateUseCase } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const apiDir = resolve(__dirname, "..");
loadEnv({ path: resolve(apiDir, ".env") });
loadEnv({ path: resolve(apiDir, ".env.local"), override: true });

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

function flagValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("--") && !a.includes("=")));
  const key = flagValue(argv, "key")?.trim();
  if (!key) {
    throw new Error("Missing required --key=<template-key>");
  }
  const deactivate = flags.has("--deactivate");

  if (deactivate) {
    return { mode: "deactivate" as const, key, yes: flags.has("--yes") };
  }

  const contentSid = flagValue(argv, "content-sid")?.trim();
  const body = flagValue(argv, "body");
  if (!contentSid || !body) {
    throw new Error(
      "Missing required --content-sid=<HX...> and/or --body=<template body preview>",
    );
  }
  const useCaseRaw = flagValue(argv, "use-case") ?? "CARD_SHARE";
  if (!(useCaseRaw in WhatsappTemplateUseCase)) {
    throw new Error(
      `Invalid --use-case=${useCaseRaw}. Must be one of: ${Object.keys(WhatsappTemplateUseCase).join(", ")}`,
    );
  }

  return {
    mode: "register" as const,
    key,
    contentSid,
    body,
    useCase: useCaseRaw as WhatsappTemplateUseCase,
    locale: flagValue(argv, "locale") ?? "en",
    isDefault: flags.has("--default"),
    isActive: !flags.has("--inactive"),
    yes: flags.has("--yes"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { prisma, pool } = createPrisma();

  try {
    const existing = await prisma.whatsappTemplate.findUnique({
      where: { key: args.key },
    });

    if (args.mode === "deactivate") {
      if (!existing) {
        console.error(`No WhatsappTemplate found with key "${args.key}"`);
        process.exit(1);
      }
      console.log(`Will set isActive=false on "${args.key}" (currently ${existing.isActive}).`);
      if (!args.yes) {
        console.log("\nPreview only — re-run with --yes to apply.");
        return;
      }
      await prisma.whatsappTemplate.update({
        where: { key: args.key },
        data: { isActive: false },
      });
      console.log("Deactivated.");
      return;
    }

    console.log(existing ? "Will UPDATE existing template:" : "Will CREATE new template:");
    console.log(`  key:         ${args.key}`);
    console.log(`  useCase:     ${args.useCase}`);
    console.log(`  contentSid:  ${args.contentSid}`);
    console.log(`  locale:      ${args.locale}`);
    console.log(`  bodyPreview: ${args.body}`);
    console.log(`  isActive:    ${args.isActive}`);
    console.log(`  isDefault:   ${args.isDefault}`);
    if (existing) {
      console.log(`  (previous contentSid: ${existing.contentSid})`);
    }

    if (!args.yes) {
      console.log("\nPreview only — re-run with --yes to apply.");
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Keep the "one default per useCase+locale" convention honest — there's no DB
      // constraint enforcing it (see docs/whatsapp-card-share/runbook.md), so this
      // script clears any other default explicitly rather than leaving two defaults.
      if (args.isDefault) {
        await tx.whatsappTemplate.updateMany({
          where: { useCase: args.useCase, locale: args.locale, isDefault: true },
          data: { isDefault: false },
        });
      }
      await tx.whatsappTemplate.upsert({
        where: { key: args.key },
        create: {
          key: args.key,
          useCase: args.useCase,
          contentSid: args.contentSid,
          locale: args.locale,
          bodyPreview: args.body,
          isActive: args.isActive,
          isDefault: args.isDefault,
        },
        update: {
          contentSid: args.contentSid,
          locale: args.locale,
          bodyPreview: args.body,
          isActive: args.isActive,
          isDefault: args.isDefault,
        },
      });
    });

    console.log(existing ? "Updated." : "Created.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
