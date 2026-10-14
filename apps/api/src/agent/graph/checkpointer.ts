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
 *
 * Ordering contract for consumers (e.g. GraphFactory):
 *   await this.whenReady();   // resolves once setup() completes
 *   const saver = this.get(); // throws if called before whenReady() settles
 *
 * `whenReady` is exposed because Nest's onModuleInit ordering across
 * providers is "best effort" — a sync onModuleInit on a dependent
 * provider can fire before an async onModuleInit on a dependency has
 * resolved. The explicit await makes the ordering load-bearing at
 * the call site rather than implicit in Nest's iteration.
 */
@Injectable()
export class GraphCheckpointer implements OnModuleInit, OnModuleDestroy {
  private saver: PostgresSaver | null = null;

  /**
   * The promise that resolves once `onModuleInit` has set up the
   * checkpointer, or rejects with the underlying error. Initialised
   * in the constructor (synchronously) so consumers can `await` it
   * immediately after DI — there's no window where it's undefined.
   */
  public readonly ready: Promise<void>;

  private resolveReady!: () => void;
  private rejectReady!: (err: unknown) => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AgentConfig,
    private readonly logger: AppLogger,
  ) {
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const connStr = this.prisma.getConnectionString();
      if (!connStr) {
        throw ApiError.forbidden(
          'AGENT_CHECKPOINTER_NO_DB',
          'DATABASE_URL is not set; cannot initialise the LangGraph checkpointer.',
        );
      }
      const schema = this.cfg.checkpointerSchema;
      if (!schema) {
        throw ApiError.forbidden(
          'AGENT_CHECKPOINTER_NO_SCHEMA',
          'AgentConfig.checkpointerSchema is undefined; the agent env block in env.schema.ts is missing or misconfigured.',
        );
      }
      // PostgresSaver.fromConnString is synchronous; setup() is async.
      this.saver = PostgresSaver.fromConnString(connStr, { schema });
      await this.saver.setup();
      this.logger.info('agent.checkpointer_ready', { schema });
      this.resolveReady();
    } catch (err) {
      // Surface the underlying error so a future boot failure has
      // context (instead of the cryptic "used before onModuleInit
      // completed"). The promise rejection lets awaiting consumers
      // also see the real cause.
      this.logger.error('agent.checkpointer_init_failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      this.rejectReady(err);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.saver) {
      try {
        // The TS PostgresSaver exposes `.end()` to release the pool.
        await (this.saver as unknown as { end(): Promise<void> }).end();
      } catch {
        // best-effort
      }
    }
  }

  /**
   * Resolves once the checkpointer is fully initialised. Consumers
   * MUST await this before calling get() — it's the explicit
   * synchronisation point that replaces the implicit Nest
   * onModuleInit ordering.
   */
  async whenReady(): Promise<void> {
    return this.ready;
  }

  /**
   * The checkpointer instance, ready to hand to `graph.compile({ checkpointer })`.
   * Throws if the checkpointer hasn't been initialised yet — callers
   * should `await this.whenReady()` first.
   */
  get(): PostgresSaver {
    if (!this.saver) {
      throw new Error(
        'GraphCheckpointer used before onModuleInit completed. ' +
          'Call `await checkpointer.whenReady()` before `checkpointer.get()`.',
      );
    }
    return this.saver;
  }
}
