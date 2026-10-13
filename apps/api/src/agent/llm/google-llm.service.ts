import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AppLogger } from '../../common/logging/app-logger.service';
import { ApiError } from '../../common/errors/api-error';
import { AgentConfig } from '../agent.config';
import { LlmService } from './llm.service';

/**
 * Concrete LlmService for Google's Gemini family via @langchain/google-genai.
 *
 * NOTE on library choice: ChatGoogleGenerativeAI is marked "will be deprecated"
 * in the LangChain docs in favour of ChatGoogle (@langchain/google). The newer
 * package is the right long-term choice, but ChatGoogleGenerativeAI is the
 * one the reference docs and Google's own LangGraph example use today, so it
 * is the lower-risk "works on first run" pick. The LlmService abstraction
 * makes the future swap a one-file change — replace the four getXxxModel()
 * bodies with `new ChatGoogle({ model, apiKey, ... })`.
 *
 * LangSmith wiring: when LANGSMITH_TRACING=true and LANGSMITH_API_KEY is
 * set, set the standard LangChain env vars BEFORE the first model is
 * instantiated. LangChain auto-traces every model call when these are set;
 * with them unset, tracing is a true no-op (zero overhead).
 */
@Injectable()
export class GoogleLlmService extends LlmService implements OnModuleInit {
  private readonly apiKey: string | undefined;

  constructor(
    private readonly cfg: AgentConfig,
    private readonly logger: AppLogger,
  ) {
    super();
    this.apiKey = cfg.geminiApiKey;
    this.configureLangSmith();
  }

  onModuleInit(): void {
    if (!this.apiKey) {
      this.logger.warn('agent.llm_not_configured', {
        message:
          'GEMINI_API_KEY is not set. The agent handlers will return AGENT_LLM_NOT_CONFIGURED until it is.',
      });
    }
  }

  private configureLangSmith(): void {
    const ls = this.cfg.langsmith;
    if (!ls.tracing || !ls.apiKey) return;
    // Standard LangChain env vars. Setting these enables auto-tracing for
    // every LangChain model + every LangGraph node, with zero code change.
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    process.env.LANGCHAIN_API_KEY = ls.apiKey;
    process.env.LANGCHAIN_PROJECT = ls.project;
  }

  private build(model: string, temperature = 0): BaseChatModel {
    if (!this.apiKey) {
      throw ApiError.forbidden(
        'AGENT_LLM_NOT_CONFIGURED',
        'GEMINI_API_KEY is not set; the agent LLM is unavailable.',
      );
    }
    return new ChatGoogleGenerativeAI({
      model,
      temperature,
      apiKey: this.apiKey,
      // Gemini 3 thought signatures: langchain-google-genai >= 3.1.0 handles
      // these automatically. We pin via package.json — see the dev README note.
      maxRetries: 2,
    });
  }

  getPlannerModel(): BaseChatModel {
    return this.build(this.cfg.models.planner, 0);
  }
  getToolModel(): BaseChatModel {
    return this.build(this.cfg.models.tools, 0);
  }
  getSynthesiserModel(): BaseChatModel {
    return this.build(this.cfg.models.synthesis, 0.4);
  }
  getStewardModel(): BaseChatModel {
    return this.build(this.cfg.models.steward, 0);
  }
}
