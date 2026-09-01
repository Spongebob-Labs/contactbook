import { Global, Module } from '@nestjs/common';
import { InternalTasksController } from './internal-tasks.controller';
import { OutboxDispatchService } from './outbox-dispatch.service';
import { OutboxService } from './outbox.service';
import { TaskEnqueuer } from './task-enqueuer';
import { TaskHandlerRegistry } from './task-handler.registry';
import { TasksOidcGuard } from './tasks-oidc.guard';

/**
 * Global so any domain module (auth today; cards/sharing later) can inject
 * OutboxService and TaskEnqueuer without importing this module explicitly.
 * Feature modules register their own handlers into TaskHandlerRegistry from
 * their own OnModuleInit — see AuthModule.
 */
@Global()
@Module({
  controllers: [InternalTasksController],
  providers: [
    OutboxService,
    TaskHandlerRegistry,
    OutboxDispatchService,
    TaskEnqueuer,
    TasksOidcGuard,
  ],
  exports: [OutboxService, TaskHandlerRegistry, TaskEnqueuer],
})
export class OutboxModule {}
