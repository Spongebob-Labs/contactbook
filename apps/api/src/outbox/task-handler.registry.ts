import { Injectable } from '@nestjs/common';

export type TaskHandler = (payload: Record<string, unknown>) => Promise<void>;

/**
 * Maps an OutboxMessage.kind to the function that actually performs the send.
 * Both the inline transport (dev/test) and the Cloud Tasks HTTP endpoint
 * (prod) resolve through this same registry, so there is exactly one place
 * that decides what a given `kind` does.
 */
@Injectable()
export class TaskHandlerRegistry {
  private readonly handlers = new Map<string, TaskHandler>();

  register(kind: string, handler: TaskHandler): void {
    if (this.handlers.has(kind)) {
      throw new Error(`Task handler already registered for kind "${kind}"`);
    }
    this.handlers.set(kind, handler);
  }

  get(kind: string): TaskHandler | undefined {
    return this.handlers.get(kind);
  }
}
