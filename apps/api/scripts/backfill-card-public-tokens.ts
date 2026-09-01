/**
 * One-time backfill: mint `Card.publicToken` for every existing card that
 * predates the column. Part of the nullable → backfill → required migration
 * sequence (see docs/architecture — the QR `publicToken` plan) rather than a
 * schema migration itself, since each row needs its own randomly generated
 * value and that can't be expressed as pure DDL.
 *
 * Idempotent: only touches rows where `publicToken IS NULL`, so re-running it
 * (e.g. after a partial failure) is safe. Run against every environment
 * before the follow-up migration makes the column NOT NULL.
 *
 *   pnpm --filter api exec ts-node scripts/backfill-card-public-tokens.ts
 *
 * Uses the same generateShareToken() ShareLink already uses — one generator,
 * one entropy guarantee, across both token namespaces. No collision-retry
 * loop, matching this codebase's existing precedent for that generator: a
 * 128-bit collision is not a practical risk, and the DB's unique constraint
 * would fail loudly (and safely) in the false-astronomical case it ever did.
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { generateShareToken } from '../src/sharing/share-token.util';

const BATCH_SIZE = 500;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  // Raw SQL, deliberately not the generated Prisma Client's typed queries:
  // this script is meant to run in the gap between the two migrations
  // (nullable, then required), but whoever runs it will have checked out
  // this repo's *current* schema.prisma — which already declares
  // `publicToken` required — so a generated-client query filtering on
  // `publicToken: null` would fail to typecheck/compile even though the
  // actual DB column is still nullable at that exact moment. Raw SQL has no
  // such dependency on which schema state happens to be checked out.
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  let totalUpdated = 0;
  try {
    for (;;) {
      const batch = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM cards WHERE "publicToken" IS NULL LIMIT ${BATCH_SIZE}
      `;
      if (batch.length === 0) break;

      for (const { id } of batch) {
        await prisma.$executeRaw`
          UPDATE cards SET "publicToken" = ${generateShareToken()} WHERE id = ${id}
        `;
      }
      totalUpdated += batch.length;
      console.log(`backfilled ${totalUpdated} card(s)...`);
    }

    const [{ remaining }] = await prisma.$queryRaw<{ remaining: bigint }[]>`
      SELECT count(*)::bigint AS remaining FROM cards WHERE "publicToken" IS NULL
    `;
    if (remaining > 0n) {
      throw new Error(
        `${remaining} card(s) still have a null publicToken after backfill.`,
      );
    }
    console.log(`done. ${totalUpdated} card(s) backfilled, 0 remaining.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
