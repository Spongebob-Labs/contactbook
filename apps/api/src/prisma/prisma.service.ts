import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

/**
 * Prisma 7 removed the schema-level `datasource { url }` entirely — the
 * running app now builds its own connection and hands it to PrismaClient as
 * a driver adapter, rather than Prisma parsing a URL for you. Migrate has a
 * separate path (prisma.config.ts, DIRECT_URL) — the two are independent on
 * purpose, since Migrate needs a session connection and this needs a pooled
 * one. See docs/architecture/lld.md §1.0.
 *
 * DATABASE_URL is the Supabase transaction pooler (:6543). It must carry
 * `pgbouncer=true` — transaction-mode pooling does not support prepared
 * statements, and without the flag you get intermittent
 * `prepared statement "s0" already exists` errors that appear only under
 * production concurrency.
 *
 * `max: 10` is this instance's own connection ceiling — Supavisor is already
 * pooling upstream, so this is the local cap, not a second independent pool
 * fighting the first one. See docs/architecture/hld.md §5 for the budget math.
 *
 * Deliberately NO eager $connect() in onModuleInit. Prisma (and the
 * underlying pg.Pool) connect lazily on first query — forcing a connection at
 * boot means a transient database blip during a deploy stops the container
 * from starting at all, turning a brief outage into a hard one. Database
 * reachability is reported by /health/ready, which the deploy script gates on.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: AppConfigService) {
    const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
