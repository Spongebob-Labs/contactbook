import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { PrismaService } from '../../prisma/prisma.service';
import { AppLogger } from '../../common/logging/app-logger.service';
import { AgentConfig } from '../agent.config';
import { ApiError } from '../../common/errors/api-error';

/**
 * The LangGraph checkpointer. Persists graph state per `thread_id` in
 * the dedicated `langgraph` Postgres schema (created by the agent
 * migration). This is what makes:
 *
 *   - long conversations survive restarts
 *   - HITL pauses work (state saved, waits for Command({ resume }))
 *   - multi-turn reasoning is preserved
 *
 * The same Postgres connection as the app, but a dedicated schema:
 * the checkpointer manages its own tables (`checkpoints`,
 * `checkpoint_blobs`, `checkpoint_writes`, `checkpoint_migrations`)
 * in `langgraph.*`; the Prisma-managed `public.*` stays clean.
 */
@Injectable()
export class GraphCheckpointer implements OnModuleInit, OnModuleDestroy {
  private saver: PostgresSaver | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AgentConfig,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const connStr = this.prisma.getConnectionString();
    if (!connStr) {
      throw ApiError.forbidden(
        'AGENT_CHECKPOINTER_NO_DB',
        'DATABASE_URL is not set; cannot initialise the LangGraph checkpointer.',
      );
    }
    // PostgresSaver accepts a `schema` option in its fromConnString /
    // constructor — that targets a non-default search_path. The schema
    // is created by the agent migration; setup() is idempotent.
    this.saver = await PostgresSaver.fromConnString(connStr, {
      schema: this.cfg.checkpointerSchema,
    });
    await this.saver.setup();
    this.logger.info('agent.checkpointer_ready', { schema: this.cfg.checkpointerSchema });
  }

  async onModuleDestroy(): Promise<void> {
    // PostgresSaver wraps a pg.Pool internally; close it on shutdown.
    if (this.saver) {
      try {
        // The TS PostgresSaver exposes `.end()` to release the pool.
        // (Method name verified in @langchain/langgraph-checkpoint-postgres.)
        await (this.saver as unknown as { end(): Promise<void> }).end();
      } catch {
        // best-effort
      }
    }
  }

  /** The checkpointer instance, ready to hand to `graph.compile({ checkpointer })`. */
  get(): PostgresSaver {
    if (!this.saver) {
      throw new Error('GraphCheckpointer used before onModuleInit completed.');
    }
    return this.saver;
  }
}
