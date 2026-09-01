import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { OutboxDispatchService } from './outbox-dispatch.service';
import { TasksOidcGuard } from './tasks-oidc.guard';

// Excluded from the public API doc: this is only ever called by Cloud Tasks,
// authenticated by OIDC rather than by anything a docs consumer could use, and
// documenting it invites someone to try calling it directly.
@ApiExcludeController()
@Controller({ path: 'internal/tasks', version: '1' })
@UseGuards(TasksOidcGuard)
export class InternalTasksController {
  constructor(private readonly dispatcher: OutboxDispatchService) {}

  @Post('send-message')
  @HttpCode(200)
  async sendMessage(@Body('outboxId') outboxId: string): Promise<{ ok: true }> {
    // Always 200: Cloud Tasks retries on any non-2xx, and a handled failure
    // (unknown kind, claim already taken) is not something a retry fixes.
    // dispatch() itself never throws for those cases.
    await this.dispatcher.dispatch(outboxId);
    return { ok: true };
  }
}
