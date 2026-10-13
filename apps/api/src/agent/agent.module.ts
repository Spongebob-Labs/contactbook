import { Module, type OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AgentConfig } from './agent.config';
import { LLM_SERVICE, LlmService } from './llm/llm.service';
import { GoogleLlmService } from './llm/google-llm.service';
import { StewardService } from './guardrails/steward.service';
import { StewardVerdictSchema } from './guardrails/steward.schema';
import { ContextBuilder } from './guardrails/context.builder';
import { WhatsappFormatService } from './whatsapp-format/whatsapp-format.service';
import { ChatRecordService } from './chat-record/chat-record.service';
import { ReminderService } from './reminders/reminder.service';
import { ReminderDispatcherService } from './reminders/reminder-dispatcher.service';
import { GraphCheckpointer } from './graph/checkpointer';
import { GraphFactory } from './graph/graph.factory';
import { AgentProcessInboundHandler } from './handlers/agent-process-inbound.handler';
import { SendWhatsappAgentReplyHandler } from './handlers/send-whatsapp-agent-reply.handler';
import { SendWhatsappAgentApprovalHandler } from './handlers/send-whatsapp-agent-approval.handler';
import { SendWhatsappReminderHandler } from './handlers/send-whatsapp-reminder.handler';
import { TaskHandlerRegistry } from '../outbox/task-handler.registry';
import { MessagingModule } from '../messaging/messaging.module';
import { ProfileModule } from '../profile/profile.module';
import { ContactsModule } from '../contacts/contacts.module';
import { OutboxModule } from '../outbox/outbox.module';

/**
 * The agent module. Self-contained: imports the service modules it
 * needs (Profile, Contacts, Messaging) and the global OutboxModule
 * for handler registration. Registers four outbox kinds in
 * onModuleInit, mirroring AuthModule's pattern.
 *
 * No controller in v1: the agent is triggered by the inbound
 * webhook (not by a user-facing HTTP route), and the audit log is
 * read via the JWT-guarded dashboard endpoints (Phase 4 web view).
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    OutboxModule,
    MessagingModule,
    ProfileModule,
    ContactsModule,
  ],
  providers: [
    AgentConfig,
    // LlmService is bound to the LLM_SERVICE token. Swapping
    // providers is a one-line change here (or per-env in tests).
    { provide: LLM_SERVICE, useClass: GoogleLlmService },
    // StewardVerdictSchema is provided as a value so StewardService
    // can inject it without importing the schema directly (keeps the
    // schema swappable for tests).
    { provide: StewardVerdictSchema, useValue: StewardVerdictSchema },
    StewardService,
    ContextBuilder,
    WhatsappFormatService,
    ChatRecordService,
    ReminderService,
    ReminderDispatcherService,
    GraphCheckpointer,
    GraphFactory,
    AgentProcessInboundHandler,
    SendWhatsappAgentReplyHandler,
    SendWhatsappAgentApprovalHandler,
    SendWhatsappReminderHandler,
  ],
  exports: [
    LLM_SERVICE, // expose the abstract so other modules can grab models if needed
    ChatRecordService,
  ],
})
export class AgentModule implements OnModuleInit {
  constructor(
    private readonly registry: TaskHandlerRegistry,
    private readonly processInbound: AgentProcessInboundHandler,
    private readonly sendReply: SendWhatsappAgentReplyHandler,
    private readonly sendApproval: SendWhatsappAgentApprovalHandler,
    private readonly sendReminder: SendWhatsappReminderHandler,
  ) {}

  onModuleInit(): void {
    // Register outbox handlers. Same pattern as AuthModule's
    // `send_whatsapp_otp` — the registry is the only place that
    // knows what a given `kind` does.
    this.registry.register('agent_process_inbound', (payload) => this.processInbound.handle(payload));
    this.registry.register('send_whatsapp_agent_reply', (payload) => this.sendReply.handle(payload));
    this.registry.register('send_whatsapp_agent_approval', (payload) => this.sendApproval.handle(payload));
    this.registry.register('send_whatsapp_reminder', (payload) => this.sendReminder.handle(payload));
  }
}
