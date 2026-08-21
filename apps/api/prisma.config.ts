import * as dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Explicit for the same reason src/config/env.schema.ts is explicit: nothing
// auto-loads .env into this file's process.env anymore now that
// @prisma/client's old implicit side effect is gone.
dotenv.config();

/**
 * Prisma 7 removed `datasource { url }` from schema.prisma entirely — this
 * file is where Migrate now gets its connection instead.
 *
 * This is DIRECT_URL (session mode, :5432), not DATABASE_URL (the transaction
 * pooler, :6543). Migrate runs DDL and advisory locks, neither of which a
 * transaction-mode pooler supports — see docs/architecture/lld.md §1.0.
 *
 * The running app does NOT read this file. It builds its own connection via a
 * driver adapter passed straight to the PrismaClient constructor — see
 * src/prisma/prisma.service.ts. That's the other half of the same error
 * message: "pass adapter ... to the PrismaClient constructor."
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL'),
  },
});
