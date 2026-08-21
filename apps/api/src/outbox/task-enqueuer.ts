import { Injectable } from '@nestjs/common';
import { CloudTasksClient } from '@google-cloud/tasks';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { OutboxDispatchService } from './outbox-dispatch.service';

/**
 * Chooses the transport for a just-committed outbox row.
 *
 * 'inline' (dev, test): runs the dispatch on the next tick, in-process. No
 * public URL, no OIDC, no ngrok. Never used in production — the env schema
 * refuses it there, because a restart before the tick runs would drop the
 * message with no record of the attempt.
 *
 * 'cloud_tasks' (prod): creates a real Cloud Task pointed at
 * /internal/tasks/send-message with an OIDC token for TASKS_INVOKER_SA.
 * Untested against a live queue as of this commit — that requires a deployed
 * instance; see docs/architecture/messaging-reliability.md §3.
 *
 * Either way this call is best-effort and must never throw into the caller:
 * if task creation fails, the row stays PENDING and the sweeper (not yet
 * built) picks it up later. The caller has already committed its transaction
 * and, usually, already responded to its own caller.
 */
@Injectable()
export class TaskEnqueuer {
  private client?: CloudTasksClient;

  constructor(
    private readonly config: AppConfigService,
    private readonly dispatcher: OutboxDispatchService,
    private readonly logger: AppLogger,
  ) {}

  enqueue(outboxId: string, queue: 'outbound' | 'priority' = 'priority'): void {
    if (this.config.tasks.transport === 'inline') {
      setImmediate(() => {
        this.dispatcher.dispatch(outboxId).catch((err) => {
          this.logger.error('outbox.inline_dispatch_failed', {
            outboxId,
            err: String(err),
          });
        });
      });
      return;
    }

    this.enqueueCloudTask(outboxId, queue).catch((err) => {
      this.logger.error('outbox.cloud_task_create_failed', {
        outboxId,
        err: String(err),
      });
    });
  }

  private async enqueueCloudTask(
    outboxId: string,
    queue: 'outbound' | 'priority',
  ): Promise<void> {
    const { projectId, region } = this.config.gcp;
    const t = this.config.tasks;
    if (
      !projectId ||
      !t.targetBaseUrl ||
      !t.oidcAudience ||
      !t.invokerServiceAccount
    ) {
      throw new Error(
        'Cloud Tasks transport selected but not fully configured',
      );
    }

    this.client ??= new CloudTasksClient();
    const queueName = queue === 'priority' ? t.queuePriority : t.queueOutbound;
    const parent = this.client.queuePath(projectId, region, queueName ?? '');

    await this.client.createTask({
      parent,
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: `${t.targetBaseUrl.replace(/\/+$/, '')}/api/v1/internal/tasks/send-message`,
          headers: { 'Content-Type': 'application/json' },
          body: Buffer.from(JSON.stringify({ outboxId })).toString('base64'),
          oidcToken: {
            serviceAccountEmail: t.invokerServiceAccount,
            audience: t.oidcAudience,
          },
        },
      },
    });
  }
}
