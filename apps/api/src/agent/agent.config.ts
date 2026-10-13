import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

/**
 * Thin typed view over AppConfigService.agent. Lifted out of the service
 * so LlmService (and any other agent class) can depend on a small,
 * focused shape rather than the full AppConfigService surface.
 */
@Injectable()
export class AgentConfig {
  constructor(private readonly app: AppConfigService) {}

  get provider(): 'google' {
    return this.app.agent.provider;
  }
  get geminiApiKey(): string | undefined {
    return this.app.agent.geminiApiKey;
  }
  get models() {
    return this.app.agent.models;
  }
  get contextWindowMessages(): number {
    return this.app.agent.contextWindowMessages;
  }
  get maxInboundChars(): number {
    return this.app.agent.maxInboundChars;
  }
  get defaultTimezone(): string {
    return this.app.agent.defaultTimezone;
  }
  get langsmith() {
    return this.app.agent.langsmith;
  }
  get checkpointerSchema(): string {
    return this.app.agent.checkpointerSchema;
  }
}
