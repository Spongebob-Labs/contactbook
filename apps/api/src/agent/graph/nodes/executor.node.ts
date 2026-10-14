import { ToolMessage } from '@langchain/core/messages';
import type { AgentStateType } from '../state';
import type { StructuredTool } from '@langchain/core/tools';
import { MUTATING_TOOLS } from '../tools/tool-registry';
import { AppLogger } from '../../../common/logging/app-logger.service';
import { ChatRecordService } from '../../chat-record/chat-record.service';

/**
 * The executor node. Reads the last AIMessage from state; if it has
 * tool_calls, runs each one with `configurable.userId` set to the
 * thread owner. Emits one ToolMessage per call as a state update.
 *
 * Why a custom executor (not the prebuilt ToolNode)? Two reasons:
 *
 *  1. The prebuilt ToolNode doesn't expose a hook to inject
 *     `configurable.userId` into every tool call. The tools read
 *     userId from `RunnableConfig.configurable.userId`; we need to
 *     supply that per call. (For a future swap to the prebuilt, a
 *     `wrapToolCalls` middleware would do the same job.)
 *
 *  2. We want to write TOOL_CALL + TOOL_RESULT rows to ChatRecord
 *     on every invocation (the audit log). The prebuilt doesn't
 *     expose that hook either.
 */
export async function executorNode(
  state: AgentStateType,
  tools: StructuredTool[],
  userId: string,
  threadId: string,
  records: ChatRecordService,
  logger: AppLogger,
): Promise<Partial<AgentStateType>> {
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    !lastMessage ||
    !('tool_calls' in lastMessage) ||
    !Array.isArray((lastMessage as { tool_calls?: unknown[] }).tool_calls)
  ) {
    // No tool calls — nothing to execute. The conditional edge will
    // route us to the synthesiser.
    return {};
  }
  const aiMsg = lastMessage as unknown as {
    tool_calls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  // Per-execution tracking: signatures of tools already invoked in
  // THIS executor call. Prevents within-turn duplicates (the planner
  // sometimes emits 12 identical tool_calls in one message; we only
  // want to run the first). Reset on every executor entry, so
  // across-turn repeats are allowed.
  const executedThisTurn = new Set<string>();
  logger.info('agent.executor_entry', { userId, threadId, toolCount: tools.length });

  const toolMessages: ToolMessage[] = [];
  for (const call of aiMsg.tool_calls) {
    const tool = toolByName.get(call.name);
    if (!tool) {
      logger.warn('agent.unknown_tool_call', { toolName: call.name, threadId });
      toolMessages.push(
        new ToolMessage({
          content: `Unknown tool: ${call.name}`,
          tool_call_id: call.id,
          name: call.name,
        }),
      );
      continue;
    }

    // Audit log: write the tool call BEFORE invoking the tool.
    // For mutating tools, the interrupt() inside the tool will pause
    // the graph; on resume, the tool returns and we write the
    // TOOL_RESULT row. The graph state checkpoint is the source of
    // truth for "did this complete"; the ChatRecord is for humans.
    await records.appendToolCall(
      threadId,
      userId,
      call.name,
      call.id,
      call.args,
    );
    logger.info('agent.tool_call', {
      tool: call.name,
      mutating: MUTATING_TOOLS.has(call.name),
      threadId,
    });

    // --- Anti-loop guard ---
    // The planner LLM has been observed to re-call the same read tool
    // up to 12 times despite system prompt instructions not to loop.
    // Force a hard cap: at most ONE invocation per (toolName, JSON-args)
    // signature per executor entry. Subsequent identical calls in the
    // same AIMessage get a synthetic "you already have the result"
    // ToolMessage so the synth can write the final answer.
    const signature = stableSignature(call.name, call.args);
    const alreadyExecuted = executedThisTurn.has(signature);
    if (alreadyExecuted) {
      logger.warn('agent.tool_loop_suppressed', {
        tool: call.name,
        threadId,
      });
      toolMessages.push(
        new ToolMessage({
          content:
            `Tool ${call.name} has already been called this turn with the same arguments. ` +
            'You have the result. Do not call it again — write your final answer now based on the previous result.',
          tool_call_id: call.id,
          name: call.name,
        }),
      );
      // Still write a TOOL_RESULT audit row so the record is consistent.
      await records.appendToolResult(
        threadId,
        userId,
        call.name,
        call.id,
        { loopSuppressed: true },
      );
      continue;
    }
    // --- end anti-loop guard ---

    try {
      executedThisTurn.add(signature);
      const result = await tool.invoke(call.args, {
        configurable: { userId, threadId },
      });
      const toolResult = serialiseToolResult(result);
      await records.appendToolResult(
        threadId,
        userId,
        call.name,
        call.id,
        toolResult,
      );
      toolMessages.push(
        new ToolMessage({
          content:
            typeof result === 'string' ? result : JSON.stringify(toolResult),
          tool_call_id: call.id,
          name: call.name,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('agent.tool_failed', {
        tool: call.name,
        err: message,
        threadId,
      });
      // ToolMessage with the error becomes part of the conversation;
      // the planner sees it and can adapt (or give up).
      toolMessages.push(
        new ToolMessage({
          content: `Tool ${call.name} failed: ${message}`,
          tool_call_id: call.id,
          name: call.name,
        }),
      );
    }
  }

  return { messages: toolMessages };
}

/**
 * Stable signature for a tool call: tool name + JSON-stringified args.
 * Used to detect repeat invocations within a single turn.
 */
function stableSignature(toolName: string, args: unknown): string {
  let argsStr: string;
  try {
    argsStr = JSON.stringify(args ?? {}, Object.keys(args ?? {}).sort());
  } catch {
    argsStr = String(args);
  }
  return `${toolName}::${argsStr}`;
}

function serialiseToolResult(result: unknown): unknown {
  // Tools may return strings or structured objects. Strings pass
  // through; objects are kept as-is for ChatRecord's JSONB column.
  if (typeof result === 'string') {
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  }
  return result;
}
