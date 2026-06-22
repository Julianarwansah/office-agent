import { randomUUID } from 'node:crypto';
import type {
  LLMToolCall,
  ToolExecution,
  ToolExecutionStatus,
} from '../../shared/types';
import type { SkillManifest, SkillParameter } from '../../shared/skills-schema';
import type {
  SkillContext,
  SkillDefinition,
  SkillResult,
} from './types';
import { getSkillRegistry } from './registry';

export interface ExecuteOptions {
  defaultTimeoutMs?: number;
  /** Called when a tool execution row is created or updated. Use this for persistence. */
  onExecution?: (row: ToolExecution) => void | Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export function parseArgs(raw: string): { value: unknown; error?: string } {
  if (typeof raw !== 'string') {
    return { value: {}, error: 'Tool arguments must be a string' };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { value: {} };
  try {
    return { value: JSON.parse(trimmed) };
  } catch (e) {
    return {
      value: null,
      error: `Failed to parse tool arguments as JSON: ${(e as Error).message}`,
    };
  }
}

export function validateArgs(
  manifest: SkillManifest,
  args: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const params = manifest.parameters ?? [];
  const obj = (args && typeof args === 'object' && !Array.isArray(args)
    ? (args as Record<string, unknown>)
    : {});

  for (const p of params) {
    const present = Object.prototype.hasOwnProperty.call(obj, p.name);
    const value = obj[p.name];

    if (!present || value === undefined || value === null) {
      if (p.required) {
        errors.push(`Missing required parameter: "${p.name}"`);
      }
      continue;
    }

    if (!checkType(p, value)) {
      errors.push(
        `Parameter "${p.name}" expected ${p.type} but got ${describeValue(value)}`
      );
      continue;
    }

    if (p.enum && p.enum.length > 0) {
      const v = String(value);
      if (!p.enum.includes(v)) {
        errors.push(
          `Parameter "${p.name}" must be one of [${p.enum.join(', ')}]`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function checkType(p: SkillParameter, value: unknown): boolean {
  switch (p.type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      );
    default:
      return true;
  }
}

function describeValue(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

export class SkillExecutor {
  private defaultTimeoutMs: number;
  private onExecution?: (row: ToolExecution) => void | Promise<void>;

  constructor(opts: ExecuteOptions = {}) {
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (opts.onExecution) this.onExecution = opts.onExecution;
  }

  setExecutionHandler(handler: (row: ToolExecution) => void | Promise<void>): void {
    this.onExecution = handler;
  }

  async execute(
    toolCall: LLMToolCall,
    ctx: SkillContext
  ): Promise<{ result: SkillResult; execution: ToolExecution }> {
    const registry = getSkillRegistry();
    const definition: SkillDefinition | undefined = registry.get(toolCall.function.name);

    const startedAt = Date.now();
    const execution: ToolExecution = {
      id: toolCall.id || randomUUID(),
      messageId: ctx.messageId,
      toolName: toolCall.function.name,
      arguments: toolCall.function.arguments ?? '',
      status: 'pending',
      startedAt,
    };

    if (!definition) {
      execution.status = 'error';
      execution.completedAt = Date.now();
      execution.error = `Unknown tool: "${toolCall.function.name}"`;
      await this.persist(execution);
      return {
        result: {
          success: false,
          output: '',
          error: execution.error,
        },
        execution,
      };
    }

    execution.status = 'running';
    await this.persist(execution);

    const parsed = parseArgs(toolCall.function.arguments ?? '');
    if (parsed.error) {
      const result: SkillResult = {
        success: false,
        output: '',
        error: parsed.error,
      };
      this.finalize(execution, result);
      await this.persist(execution);
      return { result, execution };
    }

    const args = (parsed.value ?? {}) as Record<string, unknown>;
    const validation = validateArgs(definition.manifest, args);
    if (!validation.valid) {
      const result: SkillResult = {
        success: false,
        output: '',
        error: `Invalid arguments: ${validation.errors.join('; ')}`,
      };
      this.finalize(execution, result);
      await this.persist(execution);
      return { result, execution };
    }

    const timeoutMs = this.resolveTimeout(definition, args);
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const linkedSignal = ctx.signal
      ? AbortSignal.any([ctx.signal, timeoutSignal])
      : timeoutSignal;

    const linkedCtx: SkillContext = { ...ctx, signal: linkedSignal };

    try {
      const result = await definition.execute(args, linkedCtx);
      if (linkedSignal.aborted) {
        const aborted: SkillResult = {
          success: false,
          output: result?.output ?? '',
          error: `Skill "${definition.manifest.name}" was aborted`,
          data: result?.data,
        };
        this.finalize(execution, aborted);
        await this.persist(execution);
        return { result: aborted, execution };
      }
      this.finalize(execution, result);
      await this.persist(execution);
      return { result, execution };
    } catch (e) {
      const err = e as Error;
      const result: SkillResult = {
        success: false,
        output: '',
        error: linkedSignal.aborted
          ? `Skill "${definition.manifest.name}" timed out or was aborted`
          : err?.message || String(e),
      };
      this.finalize(execution, result);
      await this.persist(execution);
      return { result, execution };
    }
  }

  private resolveTimeout(
    definition: SkillDefinition,
    args: Record<string, unknown>
  ): number {
    const t = args.timeout;
    if (typeof t === 'number' && Number.isFinite(t) && t > 0) {
      return Math.min(t, 10 * 60_000);
    }
    const cfg = definition.manifest.parameters.find((p) => p.name === 'timeout');
    if (cfg && typeof cfg.default === 'number') return cfg.default;
    return this.defaultTimeoutMs;
  }

  private finalize(execution: ToolExecution, result: SkillResult): void {
    execution.completedAt = Date.now();
    execution.status = result.success ? 'success' : ('error' as ToolExecutionStatus);
    if (result.success) {
      execution.result = result.output;
    } else {
      execution.error = result.error ?? (result.output || 'Unknown error');
    }
  }

  private async persist(execution: ToolExecution): Promise<void> {
    if (!this.onExecution) return;
    try {
      await this.onExecution(execution);
    } catch {
      // swallow persistence errors so they don't fail skill execution
    }
  }
}
