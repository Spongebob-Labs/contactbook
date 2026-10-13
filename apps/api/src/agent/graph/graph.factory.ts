import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { StateGraph, END, START } from '@langchain/langgraph';
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
import {
  buildAllTools,
  MUTATING_TOOLS,
  type AgentServices,
} from './tools/tool-registry';
import { ProfileOnboardingService } from '../../profile/profile-onboarding.service';
import { ContactsService } from '../../contacts/contacts.service';
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

/** The dependencies `buildAgentGraph` needs to construct one graph. */
interface BuildDeps {
  llm: LlmService;
  cfg: AgentConfig;
  checkpointer: ReturnType<GraphCheckpointer['get']>;
  tools: StructuredTool[];
  records: ChatRecordService;
  context: ContextBuilder;
  logger: AppLogger;
}

/**
 * Module-level graph builder. Lives outside the class so its inferred
 * return type (the full 6-arg `CompiledStateGraph`) is reachable as
 * `ReturnType<typeof buildAgentGraph>` — which the class then uses
 * as the canonical field type. Inside the class,
 * `ReturnType<GraphFactory['build']>` would be a circular reference
 * and the explicit `CompiledStateGraph<AgentStateType, ...>` form
 * doesn't match the inferred build() return (TS flags them as two
 * unrelated types sharing a name because the partial-generic form
 * defaults N to "__start__" while the real call instantiates N to
 * the full node set).
 */
function buildAgentGraph(deps: BuildDeps) {
  const { llm, cfg, checkpointer, tools, records, context, logger } = deps;
  const graph = new StateGraph(AgentState)
    .addNode('preprocess', (s: AgentStateType) =>
      preprocessNode(s, records, context),
    )
    .addNode('planner', (s: AgentStateType) => plannerNode(s, llm, cfg, tools))
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
        tools,
        stateWithIds.userId,
        stateWithIds.threadId,
        records,
        logger,
      );
    })
    .addNode('synthesiser', (s: AgentStateType) => synthesiserNode(s, llm, cfg))
    .addEdge(START, 'preprocess')
    .addEdge('preprocess', 'planner')
    .addConditionalEdges('planner', (s: AgentStateType) => {
      const last = s.messages[s.messages.length - 1];
      if (
        last &&
        'tool_calls' in last &&
        Array.isArray((last as { tool_calls?: unknown[] }).tool_calls) &&
        (last as { tool_calls: unknown[] }).tool_calls.length > 0
      ) {
        return 'executor';
      }
      return 'synthesiser';
    })
    .addEdge('executor', 'planner') // loop: after tools, back to planner
    .addEdge('synthesiser', END);

  return graph.compile({ checkpointer });
}

@Injectable()
export class GraphFactory implements OnModuleInit {
  private compiled: ReturnType<typeof buildAgentGraph> | null = null;
  private tools: StructuredTool[] = [];

  constructor(
    @Inject(LLM_SERVICE) private readonly llm: LlmService,
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
    this.compiled = buildAgentGraph({
      llm: this.llm,
      cfg: this.cfg,
      checkpointer: this.checkpointer.get(),
      tools: this.tools,
      records: this.records,
      context: this.context,
      logger: this.logger,
    });
    this.logger.info('agent.graph_compiled', {
      toolCount: this.tools.length,
      mutatingCount: MUTATING_TOOLS.size,
    });
  }

  /** The compiled graph; throw if called before onModuleInit. */
  getGraph(): ReturnType<typeof buildAgentGraph> {
    if (!this.compiled) {
      throw new Error(
        'GraphFactory.getGraph() called before onModuleInit completed.',
      );
    }
    return this.compiled;
  }
}
