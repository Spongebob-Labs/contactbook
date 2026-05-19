/**
 * Deletes all contact and connection rows for a user. Does not touch users,
 * profile fields, cards, oauth, sessions, travel events, tags, etc.
 *
 * Usage (from repo root):
 *   ./scripts/purge-user-contacts-connections.sh <userId> [--dry-run] [--yes]
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
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

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const positional = argv.filter((a) => !a.startsWith("--"));
  const userId = positional[0]?.trim();
  if (!userId) {
    throw new Error("Missing userId argument");
  }
  return {
    userId,
    dryRun: flags.has("--dry-run"),
    yes: flags.has("--yes"),
  };
}

async function main() {
  const { userId, dryRun, yes } = parseArgs(process.argv.slice(2));
  const { prisma, pool } = createPrisma();

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!user) {
      console.error(`User not found: ${userId}`);
      process.exit(1);
    }

    const connectionWhere = {
      OR: [{ requesterId: userId }, { receiverId: userId }],
    };

    const [
      contactCount,
      mergeGroupCount,
      dedupKeyCount,
      integrationCount,
      connectionCount,
    ] = await Promise.all([
      prisma.contact.count({ where: { userId } }),
      prisma.contactMergeGroup.count({ where: { userId } }),
      prisma.contactDedupKey.count({ where: { userId } }),
      prisma.integrationState.count({ where: { userId } }),
      prisma.connection.count({ where: connectionWhere }),
    ]);

    console.log(`User: ${user.email} (${user.firstName} ${user.lastName})`);
    console.log(`  contacts:            ${contactCount}`);
    console.log(`  contact_merge_groups:  ${mergeGroupCount}`);
    console.log(`  contact_dedup_keys:    ${dedupKeyCount}`);
    console.log(`  integration_states:    ${integrationCount}`);
    console.log(`  connections:           ${connectionCount}`);

    const total =
      contactCount +
      mergeGroupCount +
      dedupKeyCount +
      integrationCount +
      connectionCount;

    if (total === 0) {
      console.log("Nothing to delete.");
      return;
    }

    if (dryRun) {
      console.log("\nDry run — no rows deleted.");
      return;
    }

    if (!yes) {
      console.error(
        "\nRefusing to delete without --yes. Re-run with --yes to confirm.",
      );
      process.exit(1);
    }

    const result = await prisma.$transaction(async (tx) => {
      const deletedContacts = await tx.contact.deleteMany({ where: { userId } });
      const deletedMergeGroups = await tx.contactMergeGroup.deleteMany({
        where: { userId },
      });
      const deletedIntegrations = await tx.integrationState.deleteMany({
        where: { userId },
      });
      const deletedConnections = await tx.connection.deleteMany({
        where: connectionWhere,
      });
      return {
        deletedContacts,
        deletedMergeGroups,
        deletedIntegrations,
        deletedConnections,
      };
    });

    console.log("\nDeleted:");
    console.log(`  contacts:            ${result.deletedContacts.count}`);
    console.log(
      `  contact_merge_groups:  ${result.deletedMergeGroups.count}`,
    );
    console.log(
      `  integration_states:    ${result.deletedIntegrations.count}`,
    );
    console.log(`  connections:           ${result.deletedConnections.count}`);
    console.log(
      "(contact phones/emails/etc. removed via cascade; connection–tag links via cascade)",
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
