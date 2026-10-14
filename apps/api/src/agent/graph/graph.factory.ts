import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { StateGraph, END, START } from '@langchain/langgraph';
import type { StructuredTool } from '@langchain/core/tools';
import { AgentState, type AgentStateType } from './state';
import { GraphCheckpointer } from './checkpointer';
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
 *   START -> planner
 *                |
 *       has tool_calls?
 *       /            \
 *     yes             no
 *      |              |
 *      v              v
 *   executor     synthesiser
 *      |              |
 *      |          finalAnswer
 *      |              |
 *      +-> synthesiser v
 *                     END
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
    .addEdge(START, 'planner')
    .addConditionalEdges('planner', (s: AgentStateType) => {
      const last = s.messages[s.messages.length - 1];
      const route =
        last &&
        'tool_calls' in last &&
        Array.isArray((last as { tool_calls?: unknown[] }).tool_calls) &&
        (last as { tool_calls: unknown[] }).tool_calls.length > 0
          ? 'executor'
          : 'synthesiser';
      console.log(`[agent.timing] planner routed to ${route}`);
      return route;
    })
    // After the executor runs, go STRAIGHT to the synthesiser, not
    // back to the planner. The planner-emit-tool-call / executor-run /
    // planner-emit-tool-call-again loop is the bug we're avoiding: the
    // LLM obediently keeps calling the tool because the system prompt
    // told it to. For our current tool set (single read tool per
    // question, or single mutate tool with HITL), one executor step
    // is enough. If we ever need multi-tool chaining, the conditional
    // edge below can be re-introduced with a "shouldChain" hint
    // (e.g. only loop when the planner previously emitted a
    // tool_calls result that itself needs further processing).
    //
    // For mutate tools the interrupt() inside the tool pauses the
    // graph before this edge is reached, so the mutating flow is
    // unaffected by this change.
    .addEdge('executor', 'synthesiser')
    .addEdge('synthesiser', END);

  // recursionLimit is NOT a compile option in @langchain/langgraph@0.3.x —
  // it is a per-invoke runtime config. See GraphFactory.run() where it is
  // baked in so callers can't forget it.
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

  async onModuleInit(): Promise<void> {
    // Explicit synchronisation with the checkpointer's onModuleInit,
    // which is async (it does an `await this.saver.setup()` against
    // Postgres). Nest's onModuleInit ordering across providers is
    // best-effort: a sync onModuleInit on a dependent can fire before
    // the async onModuleInit on a dependency has resolved, which is
    // exactly the bug we hit on first boot (GraphFactory.onModuleInit
    // called .get() and got null). Awaiting whenReady() makes the
    // ordering load-bearing at the call site.
    await this.checkpointer.whenReady();

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

  /**
   * The single invoke entry point. Bakes in a recursion cap as
   * insurance: the graph is a DAG (planner -> executor -> synthesiser
   * -> END, no cycles), so a loop is topologically impossible, but the
   * cap guards against future edits accidentally adding a cycle.
   *
   * Note: LangGraph counts one extra superstep for the END wrap-up,
   * so the tool path (3 nodes) consumes 4 steps — 3 was too tight and
   * broke the happy path. 10 leaves generous margin without meaningfully
   * weakening the guard.
   */
  async run(
    input: Parameters<ReturnType<typeof buildAgentGraph>['invoke']>[0],
    config: { configurable: Record<string, unknown> },
  ): Promise<unknown> {
    return this.getGraph().invoke(input, {
      ...config,
      recursionLimit: 10,
    });
  }
}
