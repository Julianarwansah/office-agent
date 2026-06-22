import type {
  LLMMessage,
  LLMTool,
  LLMToolCall,
  LLMProviderHeaders,
  LLMUsage,
} from '../../shared/types';
import {
  ChatRequest,
  ChatResult,
  LLMError,
  ResolvedProvider,
  StreamChunk,
} from './types';
import { createStreamParser, messagesToOpenAI } from './streaming';

interface OpenAIToolCallWire {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAIToolCallWire[];
  };
  finish_reason: string | null;
}

interface OpenAIResponse {
  id: string;
  model: string;
  choices: OpenAIChoice[];
  usage?: LLMUsage;
  error?: { message?: string; type?: string; code?: string | number };
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  if (!b) return `/${p}`;
  return `${b}/${p}`;
}

function mapFinishReason(reason: string | null | undefined): string {
  if (!reason) return 'stop';
  switch (reason) {
    case 'stop':
    case 'length':
    case 'tool_calls':
    case 'content_filter':
    case 'function_call':
      return reason;
    default:
      return reason;
  }
}

function toolChoiceToOpenAI(choice: ChatRequest['toolChoice']): unknown {
  if (!choice) return undefined;
  if (choice === 'auto' || choice === 'none') return choice;
  return { type: 'function', function: { name: choice.name } };
}

export class LLMClient {
  readonly provider: ResolvedProvider;

  constructor(provider: ResolvedProvider) {
    this.provider = provider;
  }

  buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.provider.apiKey) {
      headers['Authorization'] = `Bearer ${this.provider.apiKey}`;
    }
    const custom: LLMProviderHeaders = this.provider.headers ?? {};
    for (const [k, v] of Object.entries(custom)) {
      if (typeof v === 'string') headers[k] = v;
    }
    return headers;
  }

  convertMessages(messages: LLMMessage[]): unknown[] {
    return messagesToOpenAI(messages);
  }

  convertTools(tools: LLMTool[]): unknown[] {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters ?? { type: 'object', properties: {} },
      },
    }));
  }

  mapFinishReason(reason: string | null | undefined): string {
    return mapFinishReason(reason);
  }

  protected buildBody(req: ChatRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.provider.model,
      messages: this.convertMessages(req.messages),
      stream: false,
    };
    const temperature = req.temperature ?? this.provider.temperature;
    const maxTokens = req.maxTokens ?? this.provider.maxTokens;
    const topP = req.topP ?? this.provider.topP;
    if (temperature !== undefined) body.temperature = temperature;
    if (maxTokens !== undefined) body.max_tokens = maxTokens;
    if (topP !== undefined) body.top_p = topP;
    if (req.tools && req.tools.length > 0) {
      body.tools = this.convertTools(req.tools);
    }
    if (req.toolChoice) body.tool_choice = toolChoiceToOpenAI(req.toolChoice);
    return body;
  }

  protected buildStreamBody(req: ChatRequest): Record<string, unknown> {
    const body = this.buildBody(req);
    body.stream = true;
    if (this.provider.model) body.model = this.provider.model;
    return body;
  }

  protected async handleError(
    response: Response,
    providerLabel: string,
  ): Promise<never> {
    const text = await response.text().catch(() => '');
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    const errMsg =
      (typeof parsed === 'object' && parsed && 'error' in parsed
        ? (parsed as { error?: { message?: string } }).error?.message
        : undefined) ?? text ?? `HTTP ${response.status}`;

    let message: string;
    switch (response.status) {
      case 401:
        message = `Authentication failed for ${providerLabel}: invalid or missing API key.`;
        break;
      case 403:
        message = `Access forbidden for ${providerLabel}: check API key permissions.`;
        break;
      case 404:
        message = `Model or endpoint not found for ${providerLabel}. Verify baseUrl and model name.`;
        break;
      case 429:
        message = `Rate limited by ${providerLabel}. Please retry after a moment.`;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        message = `${providerLabel} server error (${response.status}). The provider may be overloaded.`;
        break;
      default:
        message = `${providerLabel} request failed (${response.status}): ${errMsg}`;
    }

    throw new LLMError(message, {
      status: response.status,
      body: text,
      provider: providerLabel,
    });
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    if (!this.provider.baseUrl) {
      throw new LLMError('Provider baseUrl is empty.', { provider: 'unknown' });
    }
    const url = joinUrl(this.provider.baseUrl, 'chat/completions');
    const headers = this.buildHeaders();
    const body = this.buildBody(req);
    const providerLabel = this.provider.model || this.provider.baseUrl;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err) {
      throw new LLMError(
        `Network error contacting ${providerLabel}: ${(err as Error).message}`,
        { provider: providerLabel, cause: err },
      );
    }

    if (!response.ok) {
      await this.handleError(response, providerLabel);
    }

    let data: OpenAIResponse;
    try {
      data = (await response.json()) as OpenAIResponse;
    } catch (err) {
      throw new LLMError(`Failed to parse response from ${providerLabel}.`, {
        provider: providerLabel,
        cause: err,
      });
    }

    if (data.error) {
      throw new LLMError(
        `${providerLabel} returned an error: ${data.error.message ?? 'unknown'}`,
        {
          status: response.status,
          code: data.error.code != null ? String(data.error.code) : undefined,
          provider: providerLabel,
        },
      );
    }

    const choice = data.choices?.[0];
    if (!choice) {
      throw new LLMError(`${providerLabel} returned no choices.`, {
        status: response.status,
        provider: providerLabel,
      });
    }

    const content = choice.message.content ?? '';
    const toolCalls: LLMToolCall[] | undefined = choice.message.tool_calls?.map(
      (tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }),
    );

    return {
      content,
      toolCalls,
      finishReason: mapFinishReason(choice.finish_reason),
      usage: data.usage,
      model: data.model,
      raw: data,
    };
  }

  async *chatStream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    if (!this.provider.baseUrl) {
      yield { type: 'error', error: 'Provider baseUrl is empty.' };
      return;
    }
    const url = joinUrl(this.provider.baseUrl, 'chat/completions');
    const headers = this.buildHeaders();
    headers['Accept'] = 'text/event-stream';
    const body = this.buildStreamBody(req);
    const providerLabel = this.provider.model || this.provider.baseUrl;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err) {
      yield {
        type: 'error',
        error: `Network error contacting ${providerLabel}: ${(err as Error).message}`,
      };
      return;
    }

    if (!response.ok) {
      try {
        await this.handleError(response, providerLabel);
      } catch (err) {
        yield {
          type: 'error',
          error: err instanceof Error ? err.message : String(err),
        };
        return;
      }
    }

    if (!response.body) {
      yield { type: 'error', error: `${providerLabel} returned no body.` };
      return;
    }

    yield { type: 'start', model: this.provider.model };

    const parser = createStreamParser();
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parser.processBuffer(buffer);
        buffer = rest;
        for (const ev of events) yield ev;
      }
      buffer += decoder.decode();
      if (buffer.trim().length > 0) {
        const tail = parser.processBuffer(buffer + '\n');
        for (const ev of tail.events) yield ev;
      }
      yield { type: 'done', finishReason: 'stop' };
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        yield { type: 'error', error: 'Request aborted.' };
        return;
      }
      yield {
        type: 'error',
        error: `Stream error from ${providerLabel}: ${(err as Error).message}`,
      };
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
      parser.reset();
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const result = await this.chat({
        provider: this.provider,
        messages: [{ role: 'user', content: 'Hi' }],
        maxTokens: 5,
        temperature: 0,
        stream: false,
      });
      return {
        success: true,
        message: `OK (${result.finishReason})`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
      };
    }
  }
}
