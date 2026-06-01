/**
 * Re-encrypts oauth_accounts.refreshToken and accessToken from a source key (UAT)
 * to a target key (prod). Idempotent: fields already encrypted with the target key
 * are left unchanged.
 *
 * Usage (from repo root):
 *   export OAUTH_TOKEN_SOURCE_KEY_BASE64="$(grep '^OAUTH_TOKEN_ENCRYPTION_KEY_BASE64=' apps/api/env/uat.env | cut -d= -f2- | tr -d '\"')"
 *   export OAUTH_TOKEN_TARGET_KEY_BASE64="<prod-key>"
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/reencrypt-oauth-tokens.ts --dry-run
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/reencrypt-oauth-tokens.ts --yes
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { OAuthProvider, PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import {
  decryptOAuthTokenWithKey,
  encryptOAuthTokenWithKey,
  parseOAuthEncryptionKeyBase64,
} from "../src/oauth-tokens/crypto.util";

const PACK_VERSION = "v1";

const apiDir = resolve(__dirname, "..");
loadEnv({ path: resolve(apiDir, ".env") });
loadEnv({ path: resolve(apiDir, ".env.local"), override: true });

type FieldName = "refreshToken" | "accessToken";

type MigrateOutcome =
  | "unchanged"
  | "already_prod"
  | "reencrypted"
  | "legacy_upgraded";

type FieldFailure = {
  id: string;
  userId: string;
  provider: OAuthProvider;
  field: FieldName;
  reason: string;
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

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  return {
    dryRun: flags.has("--dry-run"),
    yes: flags.has("--yes"),
  };
}

function loadKeys() {
  const sourceRaw = process.env.OAUTH_TOKEN_SOURCE_KEY_BASE64?.trim();
  const targetRaw = process.env.OAUTH_TOKEN_TARGET_KEY_BASE64?.trim();
  if (!sourceRaw) {
    throw new Error("OAUTH_TOKEN_SOURCE_KEY_BASE64 is required (UAT key)");
  }
  if (!targetRaw) {
    throw new Error("OAUTH_TOKEN_TARGET_KEY_BASE64 is required (prod key)");
  }
  const sourceKey = parseOAuthEncryptionKeyBase64(sourceRaw);
  const targetKey = parseOAuthEncryptionKeyBase64(targetRaw);
  if (sourceKey.equals(targetKey)) {
    throw new Error("Source and target encryption keys are identical");
  }
  return { sourceKey, targetKey };
}

function tryDecryptV1(stored: string, key: Buffer): string | null {
  if (!stored.startsWith(`${PACK_VERSION}.`)) {
    return null;
  }
  try {
    return decryptOAuthTokenWithKey(stored, key);
  } catch {
    return null;
  }
}

function migrateField(
  stored: string,
  sourceKey: Buffer,
  targetKey: Buffer,
): { outcome: MigrateOutcome; value: string } | { outcome: "failed"; reason: string } {
  if (!stored.startsWith(`${PACK_VERSION}.`)) {
    const encrypted = encryptOAuthTokenWithKey(stored, targetKey);
    return { outcome: "legacy_upgraded", value: encrypted };
  }

  if (tryDecryptV1(stored, targetKey) !== null) {
    return { outcome: "already_prod", value: stored };
  }

  const plaintext = tryDecryptV1(stored, sourceKey);
  if (plaintext === null) {
    return {
      outcome: "failed",
      reason: "cannot decrypt with source or target key",
    };
  }

  return {
    outcome: "reencrypted",
    value: encryptOAuthTokenWithKey(plaintext, targetKey),
  };
}

function shouldProcessAccessToken(value: string): boolean {
  return value.length > 0;
}

async function main() {
  const { dryRun, yes } = parseArgs(process.argv.slice(2));
  if (!dryRun && !yes) {
    console.error("Refusing to write without --yes. Use --dry-run to preview.");
    process.exit(1);
  }

  const { sourceKey, targetKey } = loadKeys();
  const { prisma, pool } = createPrisma();

  const summary = {
    scanned: 0,
    updated: 0,
    skipped_already_prod: 0,
    legacy_upgraded: 0,
    failed: 0,
  };
  const failures: FieldFailure[] = [];

  try {
    const rows = await prisma.oAuthAccount.findMany({
      orderBy: [{ userId: "asc" }, { provider: "asc" }],
    });

    for (const row of rows) {
      summary.scanned += 1;
      const fields: FieldName[] = ["refreshToken"];
      if (shouldProcessAccessToken(row.accessToken)) {
        fields.push("accessToken");
      }

      const updates: Partial<Record<FieldName, string>> = {};
      let rowAlreadyProd = true;
      let rowLegacy = false;
      let rowReencrypted = false;

      for (const field of fields) {
        const stored = row[field];
        const result = migrateField(stored, sourceKey, targetKey);
        if (result.outcome === "failed") {
          summary.failed += 1;
          failures.push({
            id: row.id,
            userId: row.userId,
            provider: row.provider,
            field,
            reason: result.reason,
          });
          rowAlreadyProd = false;
          continue;
        }

        if (result.outcome === "already_prod") {
          continue;
        }

        rowAlreadyProd = false;
        updates[field] = result.value;

        if (result.outcome === "legacy_upgraded") {
          rowLegacy = true;
        } else if (result.outcome === "reencrypted") {
          rowReencrypted = true;
        }
      }

      if (Object.keys(updates).length === 0) {
        if (rowAlreadyProd && failures.every((f) => f.id !== row.id)) {
          summary.skipped_already_prod += 1;
        }
        continue;
      }

      if (rowLegacy) {
        summary.legacy_upgraded += 1;
      }
      if (rowReencrypted) {
        summary.updated += 1;
      }

      const label = `${row.userId} ${row.provider}`;
      console.log(
        `${dryRun ? "[dry-run] " : ""}update ${label}: ${Object.keys(updates).join(", ")}`,
      );

      if (!dryRun) {
        await prisma.oAuthAccount.update({
          where: { id: row.id },
          data: updates,
        });
      }
    }

    console.log("\nSummary:");
    console.log(`  scanned:                ${summary.scanned}`);
    console.log(`  updated (UAT→prod):     ${summary.updated}`);
    console.log(`  legacy_upgraded:        ${summary.legacy_upgraded}`);
    console.log(`  skipped_already_prod:   ${summary.skipped_already_prod}`);
    console.log(`  failed:                 ${summary.failed}`);

    if (failures.length > 0) {
      console.log("\nFailures:");
      for (const f of failures) {
        console.log(
          `  ${f.id} user=${f.userId} provider=${f.provider} field=${f.field}: ${f.reason}`,
        );
      }
      process.exit(1);
    }

    if (dryRun) {
      console.log("\nDry run — no rows written.");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
