/**
 * Pre-flight guard, run in CI immediately before `prisma migrate deploy`.
 *
 * Exists because of a real incident: a migration doing
 * `ALTER COLUMN "publicToken" SET NOT NULL` reached staging before the
 * corresponding backfill script had ever been run there, and Postgres
 * rejected it (`column contains null values`). Because `prisma migrate
 * deploy` runs every pending migration in one pass with no gate in between,
 * that failure landed mid-deploy and left Prisma's migration history marked
 * FAILED — blocking every subsequent migration (including unrelated ones)
 * until manually resolved with `prisma migrate resolve --rolled-back`.
 *
 * This script scans every migration.sql file for `ALTER COLUMN ... SET NOT
 * NULL` and checks the *target* database directly for existing NULLs in
 * that column, before Prisma ever touches it. If a migration was already
 * applied, the column is already non-null (Postgres enforces this itself)
 * so the check is a trivial, cheap no-op — it only ever fires for a
 * genuinely pending migration that would fail, and it fails loudly and
 * legibly here instead of poisoning Prisma's migration history.
 *
 *   DIRECT_URL=... npx ts-node scripts/check-not-null-migrations.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

// Matches: ALTER TABLE "table" ALTER COLUMN "column" SET NOT NULL;
// Deliberately simple (not a full SQL parser) — this only needs to catch the
// one statement shape Prisma actually generates for a nullable->required
// column change, not arbitrary hand-written SQL.
const SET_NOT_NULL = /ALTER TABLE "(\w+)" ALTER COLUMN "(\w+)" SET NOT NULL/g;

interface Check {
  migration: string;
  table: string;
  column: string;
}

function findChecks(): Check[] {
  const checks: Check[] = [];
  for (const entry of fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sqlPath = path.join(MIGRATIONS_DIR, entry.name, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;

    const sql = fs.readFileSync(sqlPath, 'utf8');
    for (const match of sql.matchAll(SET_NOT_NULL)) {
      checks.push({ migration: entry.name, table: match[1], column: match[2] });
    }
  }
  return checks;
}

async function main(): Promise<void> {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL is not set.');
  }

  const checks = findChecks();
  if (checks.length === 0) {
    console.log(
      'check-not-null-migrations: no SET NOT NULL migrations found, nothing to check.',
    );
    return;
  }

  const pool = new Pool({ connectionString, max: 3 });
  const failures: string[] = [];

  try {
    for (const check of checks) {
      // Table may not exist yet on a brand-new database (e.g. first-ever
      // deploy) — that's not a null-backfill problem, so treat it as a pass.
      const tableExists = await pool.query<{ exists: boolean }>(
        `SELECT to_regclass($1) IS NOT NULL AS exists`,
        [`public.${check.table}`],
      );
      if (!tableExists.rows[0]?.exists) continue;

      const result = await pool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM "${check.table}" WHERE "${check.column}" IS NULL`,
      );
      const nullCount = result.rows[0]?.count ?? 0;
      if (nullCount > 0) {
        failures.push(
          `${check.migration}: "${check.table}"."${check.column}" has ${nullCount} NULL row(s). ` +
            `This migration's ALTER COLUMN ... SET NOT NULL will fail against this database. ` +
            `Run the corresponding backfill script against it first (see the migration's own ` +
            `sibling folder / apps/api/scripts/ for the one that fills this column), then re-run.`,
        );
      }
    }
  } finally {
    await pool.end();
  }

  if (failures.length > 0) {
    console.error(
      'check-not-null-migrations: BLOCKED — backfill required before deploy:\n',
    );
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `check-not-null-migrations: OK (${checks.length} check(s) passed).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
