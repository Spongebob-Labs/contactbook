/**
 * Collapses duplicate active contacts into one primary row per merge group (or
 * shared dedup key), union-merges fields, migrates provider links, soft-deletes siblings.
 *
 * Usage (from repo root):
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/collapse-duplicate-contacts.ts [--userId=...] [--dry-run] [--yes]
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type ContactSource } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";
import { buildDedupKeys } from "../src/contacts/contact-dedup-index";
import {
  contactRowToNormalized,
  mergeNormalizedContactFields,
  mergeScalarFields,
} from "../src/contacts/contact-merge.util";
import type { NormalizedContact } from "../src/contacts/normalized-contact.types";

const apiDir = resolve(__dirname, "..");
loadEnv({ path: resolve(apiDir, ".env") });
loadEnv({ path: resolve(apiDir, ".env.local"), override: true });

const contactChildrenInclude = {
  phones: { orderBy: { sortOrder: "asc" as const } },
  emails: { orderBy: { sortOrder: "asc" as const } },
  organizations: { orderBy: { sortOrder: "asc" as const } },
  addresses: { orderBy: { sortOrder: "asc" as const } },
  urls: { orderBy: { sortOrder: "asc" as const } },
};

type ContactRow = Awaited<
  ReturnType<
    PrismaClient["contact"]["findMany"]
  >
>[number] & {
  phones: Array<{ value: string; label: string | null; isPrimary: boolean }>;
  emails: Array<{ value: string; label: string | null; isPrimary: boolean }>;
  organizations: Array<{
    companyName: string | null;
    department: string | null;
    title: string | null;
    isPrimary: boolean;
  }>;
  addresses: Array<{
    street: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
    label: string | null;
    isPrimary: boolean;
  }>;
  urls: Array<{ value: string; label: string | null }>;
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
  let userId: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith("--userId=")) {
      userId = arg.slice("--userId=".length).trim() || undefined;
    }
  }
  return {
    userId,
    dryRun: flags.has("--dry-run"),
    yes: flags.has("--yes"),
  };
}

function pickPrimary(contacts: ContactRow[]): ContactRow {
  return [...contacts].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )[0]!;
}

async function replaceChildren(
  tx: Pick<PrismaClient, "contactPhone" | "contactEmail" | "contactOrganization" | "contactAddress" | "contactUrl">,
  contactId: string,
  contact: NormalizedContact,
): Promise<void> {
  await tx.contactPhone.deleteMany({ where: { contactId } });
  await tx.contactEmail.deleteMany({ where: { contactId } });
  await tx.contactOrganization.deleteMany({ where: { contactId } });
  await tx.contactAddress.deleteMany({ where: { contactId } });
  await tx.contactUrl.deleteMany({ where: { contactId } });

  if (contact.phones.length > 0) {
    await tx.contactPhone.createMany({
      data: contact.phones.map((p, sortOrder) => ({
        contactId,
        value: p.value,
        label: p.label ?? null,
        isPrimary: p.isPrimary ?? false,
        sortOrder,
      })),
    });
  }
  if (contact.emails.length > 0) {
    await tx.contactEmail.createMany({
      data: contact.emails.map((e, sortOrder) => ({
        contactId,
        value: e.value,
        label: e.label ?? null,
        isPrimary: e.isPrimary ?? false,
        sortOrder,
      })),
    });
  }
  if (contact.organizations.length > 0) {
    await tx.contactOrganization.createMany({
      data: contact.organizations.map((o, sortOrder) => ({
        contactId,
        companyName: o.companyName ?? null,
        department: o.department ?? null,
        title: o.title ?? null,
        isPrimary: o.isPrimary ?? false,
        sortOrder,
      })),
    });
  }
  if (contact.addresses.length > 0) {
    await tx.contactAddress.createMany({
      data: contact.addresses.map((a, sortOrder) => ({
        contactId,
        street: a.street ?? null,
        city: a.city ?? null,
        region: a.region ?? null,
        postalCode: a.postalCode ?? null,
        country: a.country ?? null,
        label: a.label ?? null,
        isPrimary: a.isPrimary ?? false,
        sortOrder,
      })),
    });
  }
  if (contact.urls.length > 0) {
    await tx.contactUrl.createMany({
      data: contact.urls.map((u, sortOrder) => ({
        contactId,
        value: u.value,
        label: u.label ?? null,
        sortOrder,
      })),
    });
  }
}

async function refreshKeysForGroup(
  tx: Pick<PrismaClient, "contactDedupKey">,
  userId: string,
  mergeGroupId: string,
  contact: NormalizedContact,
  defaultRegion?: string,
): Promise<void> {
  const keys = buildDedupKeys(contact, defaultRegion);
  const nextSet = new Set(keys.map((k) => `${k.kind}:${k.value}`));
  const owned = await tx.contactDedupKey.findMany({
    where: { mergeGroupId, userId },
    select: { id: true, kind: true, value: true },
  });
  const staleIds = owned
    .filter((row) => !nextSet.has(`${row.kind}:${row.value}`))
    .map((row) => row.id);
  if (staleIds.length > 0) {
    await tx.contactDedupKey.deleteMany({ where: { id: { in: staleIds } } });
  }
  if (keys.length === 0) {
    return;
  }

  const existing = await tx.contactDedupKey.findMany({
    where: {
      userId,
      OR: keys.map((k) => ({ kind: k.kind, value: k.value })),
    },
    select: { id: true, kind: true, value: true, mergeGroupId: true },
  });
  const existingByKey = new Map(
    existing.map((row) => [`${row.kind}:${row.value}`, row]),
  );
  const toCreate = keys.filter(
    (k) => !existingByKey.has(`${k.kind}:${k.value}`),
  );
  const toRepoint = keys
    .map((k) => existingByKey.get(`${k.kind}:${k.value}`))
    .filter(
      (row): row is NonNullable<typeof row> =>
        row != null && row.mergeGroupId !== mergeGroupId,
    );

  if (toCreate.length > 0) {
    await tx.contactDedupKey.createMany({
      data: toCreate.map((k) => ({
        userId,
        mergeGroupId,
        kind: k.kind,
        value: k.value,
      })),
      skipDuplicates: true,
    });
  }
  if (toRepoint.length > 0) {
    await tx.contactDedupKey.updateMany({
      where: { id: { in: toRepoint.map((row) => row.id) } },
      data: { mergeGroupId },
    });
  }
}

async function upsertProviderLink(
  tx: Pick<PrismaClient, "contactProviderLink">,
  userId: string,
  contactId: string,
  source: ContactSource,
  externalId: string,
  sourceRevision: string | null,
  isPrimary: boolean,
): Promise<void> {
  const primarySourceLink = await tx.contactProviderLink.findUnique({
    where: { contactId_source: { contactId, source } },
  });

  const byProviderKey = await tx.contactProviderLink.findUnique({
    where: {
      userId_source_externalId: { userId, source, externalId },
    },
  });
  if (byProviderKey) {
    if (byProviderKey.contactId === contactId) {
      await tx.contactProviderLink.update({
        where: { id: byProviderKey.id },
        data: { sourceRevision, isPrimary },
      });
      return;
    }
    if (primarySourceLink && primarySourceLink.id !== byProviderKey.id) {
      await tx.contactProviderLink.delete({ where: { id: byProviderKey.id } });
      if (isPrimary) {
        await tx.contactProviderLink.update({
          where: { id: primarySourceLink.id },
          data: { sourceRevision, isPrimary: true },
        });
      }
      return;
    }
    await tx.contactProviderLink.update({
      where: { id: byProviderKey.id },
      data: { contactId, sourceRevision, isPrimary },
    });
    return;
  }

  if (primarySourceLink) {
    if (isPrimary) {
      await tx.contactProviderLink.update({
        where: { id: primarySourceLink.id },
        data: { externalId, sourceRevision, isPrimary: true },
      });
    }
    return;
  }

  await tx.contactProviderLink.create({
    data: {
      id: randomUUID(),
      userId,
      contactId,
      source,
      externalId,
      sourceRevision,
      isPrimary,
    },
  });
}

async function collapseGroup(
  prisma: PrismaClient,
  userId: string,
  contacts: ContactRow[],
  defaultRegion: string | undefined,
  dryRun: boolean,
): Promise<number> {
  if (contacts.length <= 1) {
    return 0;
  }

  const primary = pickPrimary(contacts);
  const siblings = contacts.filter((c) => c.id !== primary.id);
  let merged = contactRowToNormalized(primary);
  for (const sibling of siblings.sort(
    (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
  )) {
    merged = mergeNormalizedContactFields(
      merged,
      contactRowToNormalized(sibling),
      defaultRegion,
    );
  }

  if (dryRun) {
    console.log(
      `  would collapse ${contacts.length} rows -> primary ${primary.id} (${primary.displayName ?? primary.firstName ?? "unnamed"})`,
    );
    return siblings.length;
  }

  const mergeGroupId = primary.mergeGroupId ?? randomUUID();

  await prisma.$transaction(
    async (tx) => {
      if (!primary.mergeGroupId) {
        await tx.contactMergeGroup.create({
          data: { id: mergeGroupId, userId },
        });
      }

      await tx.contact.update({
        where: { id: primary.id },
        data: {
          ...mergeScalarFields(primary, merged),
          mergeGroupId,
          deletedAt: null,
        },
      });

      await upsertProviderLink(
        tx,
        userId,
        primary.id,
        primary.source,
        primary.externalId,
        primary.sourceRevision,
        true,
      );

      for (const sibling of siblings) {
        await upsertProviderLink(
          tx,
          userId,
          primary.id,
          sibling.source,
          sibling.externalId,
          sibling.sourceRevision,
          false,
        );
      }

      await tx.contactProviderLink.deleteMany({
        where: { contactId: { in: siblings.map((s) => s.id) } },
      });

      await replaceChildren(tx, primary.id, merged);
      await refreshKeysForGroup(tx, userId, mergeGroupId, merged, defaultRegion);

      await tx.contact.updateMany({
        where: {
          userId,
          id: { in: siblings.map((s) => s.id) },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return siblings.length;
}

async function collapseUser(
  prisma: PrismaClient,
  userId: string,
  dryRun: boolean,
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, countryCode: true },
  });
  if (!user) {
    console.warn(`User not found: ${userId}`);
    return 0;
  }

  const defaultRegion = user.countryCode ?? undefined;
  console.log(`User ${user.email} (${userId})`);

  let collapsed = 0;

  const loadActiveContacts = () =>
    prisma.contact.findMany({
      where: { userId, deletedAt: null },
      include: contactChildrenInclude,
      orderBy: { createdAt: "asc" },
    });

  let activeContacts = await loadActiveContacts();

  const byMergeGroup = new Map<string, ContactRow[]>();
  for (const contact of activeContacts) {
    if (contact.mergeGroupId) {
      const group = byMergeGroup.get(contact.mergeGroupId) ?? [];
      group.push(contact);
      byMergeGroup.set(contact.mergeGroupId, group);
    }
  }

  const siblingIdsRemovedInPass1 = new Set<string>();
  for (const [, group] of byMergeGroup) {
    if (group.length <= 1) {
      continue;
    }
    const primary = pickPrimary(group);
    collapsed += await collapseGroup(
      prisma,
      userId,
      group,
      defaultRegion,
      dryRun,
    );
    for (const contact of group) {
      if (contact.id !== primary.id) {
        siblingIdsRemovedInPass1.add(contact.id);
      }
    }
  }

  // Pass 2: cross-group duplicates sharing dedup keys (legacy split merge groups).
  // Reload after pass 1 on real runs; on dry-run drop siblings already merged in pass 1.
  if (!dryRun && siblingIdsRemovedInPass1.size > 0) {
    activeContacts = await loadActiveContacts();
  } else if (dryRun && siblingIdsRemovedInPass1.size > 0) {
    activeContacts = activeContacts.filter(
      (contact) => !siblingIdsRemovedInPass1.has(contact.id),
    );
  }

  const keyOwners = new Map<string, ContactRow[]>();
  for (const contact of activeContacts) {
    const keys = buildDedupKeys(contactRowToNormalized(contact), defaultRegion);
    for (const key of keys) {
      const token = `${key.kind}:${key.value}`;
      const bucket = keyOwners.get(token) ?? [];
      bucket.push(contact);
      keyOwners.set(token, bucket);
    }
  }

  const processedInPass2 = new Set<string>();
  for (const [, bucket] of keyOwners) {
    const unique = [...new Map(bucket.map((c) => [c.id, c])).values()];
    if (unique.length <= 1) {
      continue;
    }
    const unprocessed = unique.filter(
      (contact) => !processedInPass2.has(contact.id),
    );
    if (unprocessed.length <= 1) {
      continue;
    }
    collapsed += await collapseGroup(
      prisma,
      userId,
      unprocessed,
      defaultRegion,
      dryRun,
    );
    for (const contact of unprocessed) {
      processedInPass2.add(contact.id);
    }
  }

  return collapsed;
}

async function main() {
  const { userId, dryRun, yes } = parseArgs(process.argv.slice(2));
  const { prisma, pool } = createPrisma();

  try {
    if (dryRun) {
      console.log("Dry run — no rows will be modified.\n");
    } else if (!yes) {
      console.error(
        "Refusing to collapse without --yes. Re-run with --yes to confirm.",
      );
      process.exit(1);
    }

    let totalCollapsed = 0;
    if (userId) {
      totalCollapsed = await collapseUser(prisma, userId, dryRun);
    } else {
      const users = await prisma.user.findMany({ select: { id: true } });
      for (const user of users) {
        totalCollapsed += await collapseUser(prisma, user.id, dryRun);
      }
    }

    console.log(
      `\n${dryRun ? "Would soft-delete" : "Soft-deleted"} ${totalCollapsed} duplicate sibling row(s).`,
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
