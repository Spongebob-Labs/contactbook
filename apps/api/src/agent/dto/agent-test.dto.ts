import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

/**
 * Request body for POST /api/v1/agent/threads/:id/messages.
 *
 * Drives the agent synchronously: runs the Steward, invokes the
 * graph, returns the full state (verdict + ReAct trace + interrupt
 * or final answer). No outbox enqueue, no WhatsApp send — that's
 * the production handler's job. The `userId` comes from the JWT,
 * never from the body.
 */
export class AgentSendMessageDto {
  @ApiProperty({
    description:
      'The user message, in their own language. Up to AGENT_MAX_INBOUND_CHARS ' +
      '(default 4000). Trimmed before the Steward sees it.',
    example: 'remind me tomorrow at 9am to call mom',
    minLength: 1,
  })
  @IsString()
  @Length(1, 4000)
  content!: string;
}

/**
 * Request body for POST /api/v1/agent/threads/:id/resume.
 *
 * Resumes a graph that was paused on an interrupt() (HITL approval).
 * The `decision` object's shape is whatever the tool's interrupt
 * payload accepts — typically `{ approved: true }` or
 * `{ approved: false }` or `{ approved: true, text: 'edited text' }`.
 * Freeform-text user replies get normalised by the agent handler
 * (interpretApprovalReply) before being passed here.
 */
export class AgentResumeDto {
  @ApiProperty({
    description:
      "The decision to pass back to the paused tool. For an approval " +
      "card: { approved: true } or { approved: false }. For an edit: " +
      "{ approved: true, ...overrides of the original tool args }.",
    example: { approved: true },
  })
  @IsObject()
  decision!: Record<string, unknown>;
}

// -------------------------------------------------------------------------
// Response shapes — plain interfaces, not class-validator DTOs, because
// they're serialised not validated. Swagger is still annotated via
// @ApiProperty on the controller signature.
// -------------------------------------------------------------------------

/** A single message in the ReAct trace, normalised for the wire. */
export interface AgentTraceMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  toolName?: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
}

/** A single tool invocation's outcome. */
export interface AgentToolResult {
  name: string;
  toolCallId: string;
  /** The tool's return value (parsed if it was a JSON string). */
  result: unknown;
  /** For an interrupted tool, the summary the human saw on the approval card. */
  interruptSummary?: string;
}

/** The interrupt payload surfaced to the test surface. */
export interface AgentInterrupt {
  id: string;
  value: {
    kind: 'approval_required' | 'guardrail_reject' | string;
    action?: string;
    summary?: string;
    payload?: Record<string, unknown>;
    reason?: string;
  };
}

/** The full response from POST /messages and POST /resume. */
export class AgentRunResponseDto {
  @ApiProperty({ description: 'The thread this run belongs to.' })
  threadId!: string;

  @ApiProperty({
    description: 'Echo of the user message (after Steward sanitization).',
  })
  userMessage!: string;

  @ApiPropertyOptional({
    description: "The Steward's verdict. Null when the pre-filter rejected " +
      'without calling the LLM (e.g. empty body, oversize).',
  })
  @IsOptional()
  stewardVerdict?: {
    allow: boolean;
    topicCategory: string;
    injectionRisk: 'none' | 'low' | 'high';
    plannerBrief: string;
    reason: string | null;
  };

  @ApiPropertyOptional({
    description: 'The full message trace from the graph run, in order. ' +
      'Includes the user turn, the planner AIMessages (with tool_calls), ' +
      'and the ToolMessages (with results).',
    type: 'array',
  })
  @IsOptional()
  messages?: AgentTraceMessage[];

  @ApiPropertyOptional({
    description: 'Every tool invocation in the run, in order. ' +
      'Each entry has the tool name, its tool_call_id, and the parsed ' +
      'result. For an interrupted tool, interruptSummary is the human-readable ' +
      'summary that would go on the approval card.',
    type: 'array',
  })
  @IsOptional()
  toolResults?: AgentToolResult[];

  @ApiPropertyOptional({
    description: 'Present when the graph paused on an interrupt (HITL or ' +
      'guardrail reject). The caller passes the value back to /resume to continue.',
  })
  @IsOptional()
  interrupt?: AgentInterrupt;

  @ApiPropertyOptional({
    description:
      'Present (and non-null) when the graph ran to completion without ' +
      'an interrupt. Markdown; the WhatsApp formatter would convert this ' +
      'for the user. Null means the graph paused on an interrupt or the ' +
      'guardrail rejected — see the `interrupt` field instead.',
  })
  @IsOptional()
  finalAnswer?: string | null;

  @ApiProperty({
    description: 'Total wall time for the run, in milliseconds.',
  })
  durationMs!: number;
}

/**
 * Response shape for thread-list and get-thread routes.
 */
export class AgentThreadSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiProperty()
  langgraphThreadId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  archivedAt?: Date | null;
}

export class AgentRecordDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  kind!: string;

  @ApiPropertyOptional()
  content?: string | null;

  @ApiPropertyOptional()
  toolName?: string | null;

  @ApiPropertyOptional()
  toolCallId?: string | null;

  @ApiPropertyOptional()
  toolArgs?: unknown;

  @ApiPropertyOptional()
  toolResult?: unknown;

  @ApiPropertyOptional()
  approvalSummary?: string | null;

  @ApiPropertyOptional()
  approvalPayload?: unknown;

  @ApiPropertyOptional()
  approvalDecision?: unknown;

  @ApiProperty()
  createdAt!: Date;
}

export class OpenThreadResponseDto {
  @ApiProperty()
  threadId!: string;

  @ApiProperty({ description: 'Whether this was newly created (true) or ' +
    'reused an existing non-archived thread (false).' })
  created!: boolean;
}

/** Query string for the records pagination route. */
export class ListThreadRecordsQueryDto {
  @ApiPropertyOptional({
    description: 'Max records to return. Default 100, max 500.',
    default: 100,
  })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Cursor — return records created before this timestamp. ' +
      'Use the createdAt of the last record from the previous page.',
  })
  @IsOptional()
  @IsString()
  before?: string;
}

/**
 * Path parameter DTOs. NestJS pipes don't infer path params from
 * class-validator on primitive types, so these are just for Swagger.
 */
export class ThreadIdParamDto {
  @ApiProperty({ description: 'ChatThread.id (UUID).' })
  @IsUUID()
  threadId!: string;
}

export class UserIdParamDto {
  @ApiProperty({ description: 'The userId path param. Unused — paths take ' +
    'userId from the JWT, not the URL. Kept for forward-compat with admin ' +
    'routes that might inspect a specific user.' })
  @IsString()
  @MaxLength(64)
  userId!: string;
}
