/**
 * Accumulates streamed tool-call deltas into fully formed `LLMToolCall`
 * objects. Streaming providers (e.g. OpenAI-compatible SSE) emit tool calls
 * piece-by-piece — name first, then arguments in chunks — so the runner needs
 * to merge them by index before execution.
 */

import type { LLMToolCall } from '../../shared/types';

interface PartialCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/** Information about a tool call as it has been received so far. */
export interface AccumulatedCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

/**
 * Accepts streaming `tool_call` chunks and merges them by index, allowing the
 * runner to either consume progress events or wait for the final list.
 */
export class ToolCallAccumulator {
  private readonly map: Map<number, PartialCall> = new Map();
  private readonly order: number[] = [];

  /**
   * Merge a streamed chunk into the accumulator. `index` is the slot in the
   * tool_calls array; `id` may arrive only on the first chunk for a given
   * index. Missing fields are left untouched.
   */
  addDelta(
    index: number,
    delta: {
      id?: string;
      type?: 'function';
      function?: { name?: string; arguments?: string };
    },
  ): void {
    let existing = this.map.get(index);
    if (!existing) {
      existing = {
        id: delta.id ?? `call_${index}_${Date.now()}`,
        type: 'function',
        function: { name: '', arguments: '' },
      };
      this.map.set(index, existing);
      this.order.push(index);
    }
    if (delta.id && !existing.id.startsWith('call_')) {
      existing.id = delta.id;
    }
    if (delta.function?.name) {
      existing.function.name += delta.function.name;
    }
    if (delta.function?.arguments) {
      existing.function.arguments += delta.function.arguments;
    }
  }

  /** Reset the accumulator back to empty (e.g. between model turns). */
  reset(): void {
    this.map.clear();
    this.order.length = 0;
  }

  /** Whether any partial tool calls have been recorded. */
  hasAny(): boolean {
    return this.order.length > 0;
  }

  /** Number of in-flight tool calls. */
  size(): number {
    return this.order.length;
  }

  /**
   * Return every accumulated call in the order their indices first appeared.
   * The returned `LLMToolCall[]` is safe to hand to the LLM as a finished
   * `tool_calls` array on an assistant message.
   */
  getAll(): LLMToolCall[] {
    return this.order.map((idx) => {
      const c = this.map.get(idx)!;
      return {
        id: c.id,
        type: 'function',
        function: { name: c.function.name, arguments: c.function.arguments },
      };
    });
  }

  /**
   * Lightweight snapshot of accumulated calls without producing new objects
   * — useful for progress events where the full LLMMessage shape isn't yet
   * warranted.
   */
  snapshot(): AccumulatedCall[] {
    return this.order.map((idx) => {
      const c = this.map.get(idx)!;
      return {
        index: idx,
        id: c.id,
        name: c.function.name,
        arguments: c.function.arguments,
      };
    });
  }
}