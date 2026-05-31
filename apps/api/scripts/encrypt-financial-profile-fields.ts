/**
 * Backfill: encrypt financial profile field values and detail columns in place.
 * Idempotent — skips values already prefixed with cbfe:v1:
 *
 * Requires FINANCIAL_FIELD_ENCRYPTION_KEY_BASE64 and DATABASE_URL (apps/api/.env).
 *
 * Usage (from repo root):
 *   # 1. Generate a key (once per environment; keep separate from OAuth key)
 *   openssl rand -base64 32
 *
 *   # 2. Set FINANCIAL_FIELD_ENCRYPTION_KEY_BASE64 in apps/api/.env (or env/uat.env / prod.env)
 *
 *   # 3. Dry-run against the target database
 *   pnpm -C apps/api encrypt-financial-fields --dry-run
 *
 *   # 4. Encrypt in place
 *   pnpm -C apps/api encrypt-financial-fields
 *
 * Point DATABASE_URL at UAT/prod before running in those environments.
 */
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { FieldType, PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";
import {
  encryptFieldValue,
  isEncryptedFieldValue,
} from "../src/crypto/field-encryption.util";

const apiDir = resolve(__dirname, "..");
loadEnv({ path: resolve(apiDir, ".env") });
loadEnv({ path: resolve(apiDir, ".env.local"), override: true });

const FINANCIAL_TYPES: FieldType[] = [
  FieldType.BANK_ACCOUNT,
  FieldType.DIGITAL_WALLET,
  FieldType.CRYPTO_WALLET,
];

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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { prisma, pool } = createPrisma();

  let fieldUpdates = 0;
  let bankUpdates = 0;

  try {
    const fields = await prisma.profileField.findMany({
      where: { type: { in: FINANCIAL_TYPES } },
      include: { bankAccount: true, digitalWallet: true, cryptoWallet: true },
    });

    for (const field of fields) {
      if (field.value && !isEncryptedFieldValue(field.value)) {
        const next = encryptFieldValue(field.value);
        if (!dryRun) {
          await prisma.profileField.update({
            where: { id: field.id },
            data: { value: next },
          });
        }
        fieldUpdates += 1;
      }
      if (
        field.bankAccount &&
        !isEncryptedFieldValue(field.bankAccount.accountNumber)
      ) {
        if (!dryRun) {
          await prisma.bankAccountDetail.update({
            where: { fieldId: field.id },
            data: {
              accountNumber: encryptFieldValue(field.bankAccount.accountNumber),
            },
          });
        }
        bankUpdates += 1;
      }
      if (
        field.digitalWallet &&
        !isEncryptedFieldValue(field.digitalWallet.handleOrLink)
      ) {
        if (!dryRun) {
          await prisma.digitalWalletDetail.update({
            where: { fieldId: field.id },
            data: {
              handleOrLink: encryptFieldValue(
                field.digitalWallet.handleOrLink,
              ),
            },
          });
        }
        bankUpdates += 1;
      }
      if (
        field.cryptoWallet &&
        !isEncryptedFieldValue(field.cryptoWallet.address)
      ) {
        if (!dryRun) {
          await prisma.cryptoWalletDetail.update({
            where: { fieldId: field.id },
            data: { address: encryptFieldValue(field.cryptoWallet.address) },
          });
        }
        bankUpdates += 1;
      }
    }

    console.log(
      `${dryRun ? "[dry-run] " : ""}Encrypted ${fieldUpdates} profile field values and ${bankUpdates} detail rows.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
