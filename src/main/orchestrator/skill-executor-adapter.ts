/**
 * Adapter that wraps the concrete `SkillExecutor` and exposes the
 * `SkillExecutorLike` interface expected by the Orchestrator.
 *
 * The actual `SkillExecutor` (see `main/skills/executor.ts`) uses a
 * singleton registry internally and persists tool execution rows via
 * `setExecutionHandler`. The orchestrator's `SkillExecutorLike` interface
 * wants a different shape: it expects the agent to be passed into
 * `execute`, and exposes a separate `record` method for writing tool
 * execution rows. This adapter bridges the two shapes.
 *
 * The adapter is constructed with the dependencies it needs (registry,
 * repo for tool executions, the delegate function for the
 * `agent_delegate` skill) and wires them onto the concrete executor.
 */

import type { Agent, LLMToolCall, ToolExecution, ToolExecutionStatus } from '../../shared/types';
import type {
  SkillExecutionResult,
  SkillExecutorLike,
} from './types';
import { SkillExecutor } from '../skills/executor';
import type { SkillContext } from '../skills/types';
import type { SkillRegistry } from '../skills/registry';
import type { ToolExecutionRepository } from '../db/repositories';

export interface OrchestratorSkillExecutorDeps {
  registry: SkillRegistry;
  toolExecutionRepo: ToolExecutionRepository;
  agentDelegate: (
    targetAgentId: string,
    task: string,
    context: { chatRoomId: string; parentMessageId?: string; signal?: AbortSignal },
  ) => Promise<string>;
}

export class OrchestratorSkillExecutor implements SkillExecutorLike {
  private readonly executor: SkillExecutor;
  private readonly toolExecutionRepo: ToolExecutionRepository;
  private readonly agentDelegate: OrchestratorSkillExecutorDeps['agentDelegate'];

  constructor(deps: OrchestratorSkillExecutorDeps) {
    this.executor = new SkillExecutor();
    this.toolExecutionRepo = deps.toolExecutionRepo;
    this.agentDelegate = deps.agentDelegate;

    // Wire persistence: the concrete executor invokes this callback for
    // every tool execution row it finalizes.
    this.executor.setExecutionHandler(async (row) => {
      try {
        this.persistRow(row);
      } catch {
        /* swallow — the concrete executor's contract is best-effort */
      }
    });
  }

  async execute(
    agent: Agent,
    toolCall: LLMToolCall,
    context: { chatRoomId: string; messageId: string; signal?: AbortSignal },
  ): Promise<SkillExecutionResult> {
    const skillContext: SkillContext = {
      agent,
      chatRoomId: context.chatRoomId,
      messageId: context.messageId,
      workingDirectory: process.cwd(),
      signal: context.signal,
      toolExecutionRepo: {
        create: (row) => this.toolExecutionRepo.create(row),
        update: (id, patch) => this.toolExecutionRepo.update(id, patch) as ToolExecution,
      },
      agentDelegate: async (targetAgentId, task, ctx) => {
        return this.agentDelegate(targetAgentId, task, {
          chatRoomId: context.chatRoomId,
          parentMessageId: context.messageId,
          signal: context.signal,
        });
      },
    };

    const wrapped = await this.executor.execute(toolCall, skillContext);
    return {
      ok: wrapped.result.success,
      output: wrapped.result.output ?? '',
      error: wrapped.result.error,
      metadata: wrapped.result.metadata as Record<string, unknown> | undefined,
    };
  }

  async record(
    messageId: string,
    toolCall: LLMToolCall,
    result: SkillExecutionResult,
    status: ToolExecutionStatus,
  ): Promise<ToolExecution> {
    const startedAt = Date.now();
    const completedAt = status === 'pending' || status === 'running' ? undefined : startedAt;
    return this.toolExecutionRepo.create({
      messageId,
      toolName: toolCall.function.name,
      arguments: toolCall.function.arguments ?? '',
      result: result.ok ? result.output : undefined,
      status,
      startedAt,
      completedAt,
      error: result.ok ? undefined : result.error ?? result.output,
    });
  }

  private persistRow(row: ToolExecution): void {
    // The concrete executor gives us a fully-formed row; upsert by id.
    const existing = this.toolExecutionRepo.findById(row.id);
    if (existing) {
      this.toolExecutionRepo.update(row.id, {
        status: row.status,
        result: row.result,
        error: row.error,
        completedAt: row.completedAt,
      });
    } else {
      this.toolExecutionRepo.create({
        messageId: row.messageId,
        toolName: row.toolName,
        arguments: row.arguments,
        result: row.result,
        status: row.status,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        error: row.error,
      });
    }
  }
}
