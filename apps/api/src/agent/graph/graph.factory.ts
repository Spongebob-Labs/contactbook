import { Injectable, OnModuleInit } from '@nestjs/common';
import { StateGraph, END, START } from '@langchain/langgraph';
import type { CompiledStateGraph } from '@langchain/langgraph';
import type { StructuredTool } from '@langchain/core/tools';
import { AgentState, type AgentStateType } from './state';
import { GraphCheckpointer } from './checkpointer';
import { preprocessNode } from './nodes/preprocess.node';
import { plannerNode } from './nodes/planner.node';
import { executorNode } from './nodes/executor.node';
import { synthesiserNode } from './nodes/synthesiser.node';
import { LLM_SERVICE, LlmService } from '../llm/llm.service';
import { AgentConfig } from '../agent.config';
import { AppLogger } from '../../common/logging/app-logger.service';
import { ChatRecordService } from '../chat-record/chat-record.service';
import { ContextBuilder } from '../guardrails/context.builder';
import { buildAllTools, MUTATING_TOOLS, type AgentServices } from './tools/tool-registry';
import { ProfileOnboardingService } from '../../../profile/profile-onboarding.service';
import { ContactsService } from '../../../contacts/contacts.service';
import { ReminderService } from '../reminders/reminder.service';

/**
 * Builds and compiles the agent's StateGraph. One graph per process,
 * compiled in onModuleInit after the checkpointer is ready.
 *
 * Topology:
 *
 *   START -> preprocess -> planner
 *                           |
 *                  has tool_calls?
 *                  /            \
 *                yes             no
 *                 |              |
 *                 v              v
 *              executor     synthesiser
 *                 |              |
 *       (interrupt() inside    finalAnswer
 *        a mutating tool)         |
 *                 |              |
 *                 +-> planner    v
 *                              END
 */
@Injectable()
export class GraphFactory implements OnModuleInit {
  private compiled: CompiledStateGraph<unknown> | null = null;
  private tools: StructuredTool[] = [];

  constructor(
    @LLM_SERVICE private readonly llm: LlmService,
    private readonly cfg: AgentConfig,
    private readonly checkpointer: GraphCheckpointer,
    private readonly records: ChatRecordService,
    private readonly context: ContextBuilder,
    private readonly logger: AppLogger,
    private readonly profile: ProfileOnboardingService,
    private readonly contacts: ContactsService,
    private readonly reminders: ReminderService,
  ) {}

  onModuleInit(): void {
    const svcs: AgentServices = {
      profile: this.profile,
      contacts: this.contacts,
      reminders: this.reminders,
    };
    this.tools = buildAllTools(svcs);
    this.compiled = this.build();
    this.logger.info('agent.graph_compiled', {
      toolCount: this.tools.length,
      mutatingCount: MUTATING_TOOLS.size,
    });
  }

  /** The compiled graph; throw if called before onModuleInit. */
  getGraph(): CompiledStateGraph<unknown> {
    if (!this.compiled) {
      throw new Error('GraphFactory.getGraph() called before onModuleInit completed.');
    }
    return this.compiled;
  }

  private build(): CompiledStateGraph<unknown> {
    const graph = new StateGraph(AgentState)
      .addNode('preprocess', (s: AgentStateType) =>
        preprocessNode(s, this.records, this.context),
      )
      .addNode('planner', (s: AgentStateType) =>
        plannerNode(s, this.llm, this.cfg, this.tools),
      )
      .addNode('executor', (s: AgentStateType) => {
        // userId + threadId are pulled from configurable by the handler
        // and injected here via the wrapper. (See the handler's
        // graph.invoke call — it passes them in the run config and
        // we surface them into the executor via the state.)
        // The executor reads from state via the convention that the
        // handler seeded `state.threadId` and `state.userId` before
        // invoking the graph.
        const stateWithIds = s as AgentStateType & {
          userId: string;
          threadId: string;
        };
        return executorNode(
          s,
          this.tools,
          stateWithIds.userId,
          stateWithIds.threadId,
          this.records,
          this.logger,
        );
      })
      .addNode('synthesiser', (s: AgentStateType) => synthesiserNode(s, this.llm, this.cfg))
      .addEdge(START, 'preprocess')
      .addEdge('preprocess', 'planner')
      .addConditionalEdges('planner', (s: AgentStateType) => {
        const last = s.messages[s.messages.length - 1];
        if (last && 'tool_calls' in last && Array.isArray((last as { tool_calls?: unknown[] }).tool_calls) && (last as { tool_calls: unknown[] }).tool_calls.length > 0) {
          return 'executor';
        }
        return 'synthesiser';
      })
      .addEdge('executor', 'planner') // loop: after tools, back to planner
      .addEdge('synthesiser', END);

    return graph.compile({ checkpointer: this.checkpointer.get() });
  }
}
