import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Connects through the Supabase transaction pooler (:6543). The URL must carry
 * `pgbouncer=true` — transaction-mode pooling does not support prepared
 * statements, and without the flag you get intermittent
 * `prepared statement "s0" already exists` errors that appear only under
 * production concurrency. See docs/architecture/lld.md §1.0.
 *
 * Deliberately NO eager $connect() in onModuleInit. Prisma connects lazily on
 * first query, and forcing a connection at boot means a transient database blip
 * during a deploy stops the container from starting at all — turning a brief
 * outage into a hard one. Database reachability is reported by /health/ready,
 * which the deploy script gates on, and the process stays up either way.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
