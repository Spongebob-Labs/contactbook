/**
 * Deletes contacts, connections, and profile/me data for a user (field groups,
 * profile fields, contact cards, card mappings). Resets profile onboarding.
 * Does not touch the users row identity (name, email, phone), oauth, sessions,
 * travel events, tags, etc.
 *
 * Usage (from repo root):
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/purge-user-contacts-connections.ts <userId> [--dry-run] [--yes]
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
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileOnboardingCompletedAt: true,
      },
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
      fieldGroupCount,
      profileFieldCount,
      cardCount,
      cardMappingCount,
    ] = await Promise.all([
      prisma.contact.count({ where: { userId } }),
      prisma.contactMergeGroup.count({ where: { userId } }),
      prisma.contactDedupKey.count({ where: { userId } }),
      prisma.integrationState.count({ where: { userId } }),
      prisma.connection.count({ where: connectionWhere }),
      prisma.fieldGroup.count({ where: { userId } }),
      prisma.profileField.count({ where: { group: { userId } } }),
      prisma.contactCard.count({ where: { userId } }),
      prisma.cardFieldMapping.count({ where: { card: { userId } } }),
    ]);

    const willResetOnboarding = user.profileOnboardingCompletedAt != null;

    console.log(`User: ${user.email} (${user.firstName} ${user.lastName})`);
    console.log(`  contacts:              ${contactCount}`);
    console.log(`  contact_merge_groups:    ${mergeGroupCount}`);
    console.log(`  contact_dedup_keys:      ${dedupKeyCount}`);
    console.log(`  integration_states:      ${integrationCount}`);
    console.log(`  connections:             ${connectionCount}`);
    console.log(`  field_groups (profile):  ${fieldGroupCount}`);
    console.log(`  profile_fields:          ${profileFieldCount}`);
    console.log(`  contact_cards:           ${cardCount}`);
    console.log(`  card_field_mappings:     ${cardMappingCount}`);
    console.log(
      `  profile_onboarding_reset: ${willResetOnboarding ? "yes" : "no"}`,
    );

    const total =
      contactCount +
      mergeGroupCount +
      dedupKeyCount +
      integrationCount +
      connectionCount +
      fieldGroupCount +
      profileFieldCount +
      cardCount +
      cardMappingCount +
      (willResetOnboarding ? 1 : 0);

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
      const deletedCards = await tx.contactCard.deleteMany({ where: { userId } });
      const deletedFieldGroups = await tx.fieldGroup.deleteMany({
        where: { userId },
      });
      const resetUser = await tx.user.update({
        where: { id: userId },
        data: { profileOnboardingCompletedAt: null },
      });
      return {
        deletedContacts,
        deletedMergeGroups,
        deletedIntegrations,
        deletedConnections,
        deletedCards,
        deletedFieldGroups,
        resetUser,
      };
    });

    console.log("\nDeleted:");
    console.log(`  contacts:              ${result.deletedContacts.count}`);
    console.log(
      `  contact_merge_groups:    ${result.deletedMergeGroups.count}`,
    );
    console.log(
      `  integration_states:      ${result.deletedIntegrations.count}`,
    );
    console.log(`  connections:             ${result.deletedConnections.count}`);
    console.log(`  contact_cards:           ${result.deletedCards.count}`);
    console.log(`  field_groups (profile):  ${result.deletedFieldGroups.count}`);
    console.log(
      `  profile_onboarding_reset: ${
        result.resetUser.profileOnboardingCompletedAt == null ? "yes" : "no"
      }`,
    );
    console.log(
      "(contact phones/emails, profile field extensions, and card mappings removed via cascade)",
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
