import type { LLMMessage, LLMToolCall } from '../../shared/types';
import type { StreamChunk } from './types';

interface RawDelta {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

interface RawChoice {
  index: number;
  delta?: RawDelta;
  finish_reason?: string | null;
}

interface RawStreamPayload {
  id?: string;
  model?: string;
  choices?: RawChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
}

export interface StreamParser {
  processLine(line: string): StreamChunk | null;
  processBuffer(buffer: string): { events: StreamChunk[]; rest: string };
  reset(): void;
}

const DONE_SENTINEL = '[DONE]';

function toToolCall(
  raw: NonNullable<RawDelta['tool_calls']>[number],
): LLMToolCall | undefined {
  const index = typeof raw.index === 'number' ? raw.index : 0;
  const fnName = raw.function?.name ?? '';
  const fnArgs = raw.function?.arguments ?? '';
  const id = raw.id ?? `call_${index}_${Date.now()}`;
  if (!fnName && !fnArgs) return undefined;
  return {
    id,
    type: 'function',
    function: {
      name: fnName,
      arguments: fnArgs,
    },
  };
}

function toUsage(raw: NonNullable<RawStreamPayload['usage']>):
  | { promptTokens: number; completionTokens: number; totalTokens: number }
  | undefined {
  if (
    typeof raw.prompt_tokens !== 'number' ||
    typeof raw.completion_tokens !== 'number'
  ) {
    return undefined;
  }
  return {
    promptTokens: raw.prompt_tokens,
    completionTokens: raw.completion_tokens,
    totalTokens:
      typeof raw.total_tokens === 'number'
        ? raw.total_tokens
        : raw.prompt_tokens + raw.completion_tokens,
  };
}

export function createStreamParser(): StreamParser {
  let started = false;
  let pendingToolCalls: Map<number, LLMToolCall> = new Map();

  function reset(): void {
    started = false;
    pendingToolCalls = new Map();
  }

  function processLine(line: string): StreamChunk | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let payload = trimmed;
    if (payload.startsWith('data:')) {
      payload = payload.slice(5).trimStart();
    }
    if (!payload) return null;
    if (payload === DONE_SENTINEL) {
      const finalCalls = Array.from(pendingToolCalls.values());
      pendingToolCalls = new Map();
      return {
        type: 'done',
        finishReason: 'stop',
        toolCall: finalCalls[0],
      };
    }

    let parsed: RawStreamPayload;
    try {
      parsed = JSON.parse(payload) as RawStreamPayload;
    } catch {
      return null;
    }

    if (parsed.error) {
      return {
        type: 'error',
        error: parsed.error.message ?? 'Unknown stream error',
      };
    }

    const choice = parsed.choices?.[0];
    if (!choice) return null;

    const events: StreamChunk[] = [];

    if (!started) {
      started = true;
      events.push({ type: 'start', model: parsed.model });
    }

    const delta = choice.delta;
    if (delta) {
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        events.push({ type: 'content', contentDelta: delta.content });
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const index = typeof tc.index === 'number' ? tc.index : 0;
          const existing = pendingToolCalls.get(index);
          const incoming = toToolCall(tc);
          if (!incoming) continue;
          const merged: LLMToolCall = existing
            ? {
                id: incoming.id || existing.id,
                type: 'function',
                function: {
                  name: existing.function.name + incoming.function.name,
                  arguments:
                    existing.function.arguments + incoming.function.arguments,
                },
              }
            : incoming;
          pendingToolCalls.set(index, merged);
          events.push({ type: 'tool_call', toolCall: { ...merged } });
        }
      }
    }

    if (choice.finish_reason) {
      events.push({
        type: 'done',
        finishReason: choice.finish_reason,
      });
    }

    if (parsed.usage) {
      const usage = toUsage(parsed.usage);
      if (usage) events.push({ type: 'done', usage });
    }

    return events[0] ?? null;
  }

  function processBuffer(buffer: string): { events: StreamChunk[]; rest: string } {
    const events: StreamChunk[] = [];
    const parts = buffer.split(/\r?\n/);
    const rest = parts.pop() ?? '';
    for (const line of parts) {
      const chunk = processLine(line);
      if (chunk) events.push(chunk);
    }
    return { events, rest };
  }

  return { processLine, processBuffer, reset };
}

export function messagesToOpenAI(messages: LLMMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        content: m.content ?? '',
        tool_call_id: m.toolCallId,
      };
    }
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content ?? null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };
    }
    const out: Record<string, unknown> = { role: m.role, content: m.content ?? '' };
    if (m.name) out.name = m.name;
    return out;
  });
}
