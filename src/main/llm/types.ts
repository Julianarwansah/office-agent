import type {
  LLMMessage,
  LLMTool,
  LLMToolCall,
  LLMProviderHeaders,
  LLMUsage,
} from '../../shared/types';

export interface ResolvedProvider {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  headers?: LLMProviderHeaders;
}

export type ToolChoice = 'auto' | 'none' | { name: string };

export interface ChatRequest {
  provider: ResolvedProvider;
  messages: LLMMessage[];
  tools?: LLMTool[];
  toolChoice?: ToolChoice;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream: boolean;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  toolCalls?: LLMToolCall[];
  finishReason: string;
  usage?: LLMUsage;
  model?: string;
  raw?: unknown;
}

export type StreamChunkType = 'start' | 'content' | 'tool_call' | 'done' | 'error';

export interface StreamChunk {
  type: StreamChunkType;
  contentDelta?: string;
  toolCall?: LLMToolCall;
  finishReason?: string;
  usage?: LLMUsage;
  error?: string;
  model?: string;
}

export class LLMError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly provider?: string;
  readonly body?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      provider?: string;
      body?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'LLMError';
    this.status = options.status ?? 0;
    this.code = options.code;
    this.provider = options.provider;
    this.body = options.body;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }

  isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      provider: this.provider,
    };
  }
}
