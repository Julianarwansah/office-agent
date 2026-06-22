import type { Agent, LLMTool, ToolExecution } from '../../shared/types';
import type { SkillManifest } from '../../shared/skills-schema';

export type SkillCategory =
  | 'system'
  | 'web'
  | 'file'
  | 'network'
  | 'data'
  | 'memory'
  | 'productivity';

export const SKILL_CATEGORIES: readonly SkillCategory[] = [
  'system',
  'web',
  'file',
  'network',
  'data',
  'memory',
  'productivity',
] as const;

export interface SkillContext {
  agent: Agent;
  chatRoomId: string;
  messageId: string;
  workingDirectory: string;
  signal?: AbortSignal;
  onProgress?: (msg: string) => void;
  memoryRepo?: unknown;
  agentDelegate?: (targetAgentId: string, task: string, context?: string) => Promise<string>;
  toolExecutionRepo?: {
    create: (row: Omit<ToolExecution, 'completedAt' | 'result' | 'error'>) => ToolExecution | Promise<ToolExecution>;
    update: (id: string, patch: Partial<ToolExecution>) => ToolExecution | Promise<ToolExecution>;
  };
}

export interface SkillResult {
  success: boolean;
  output: string;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SkillDefinition {
  manifest: SkillManifest;
  toTool(): LLMTool;
  execute(args: Record<string, unknown>, ctx: SkillContext): Promise<SkillResult>;
}

export interface SkillRegistryEntry {
  definition: SkillDefinition;
  instance?: unknown;
}
