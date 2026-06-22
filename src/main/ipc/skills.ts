/**
 * IPC handlers for skills.
 *
 * Skills are registered in-memory by the SkillRegistry; this module only
 * exposes read-only views + the per-agent tool list.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse, LLMTool, Skill } from '../../shared/types';
import type { SkillManifest } from '../../shared/skills-schema';
import type { SkillRegistry } from '../skills';
import type { AgentRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:skills');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export interface SkillHandlerDeps {
  skillRegistry: SkillRegistry;
  agents: AgentRepository;
}

export function registerSkillHandlers(deps: SkillHandlerDeps): void {
  const { skillRegistry, agents: agentRepo } = deps;

  ipcMain.handle(IPC_CHANNELS.SKILL.LIST, async (): Promise<ApiResponse<Skill[]>> => {
    try {
      const manifests: SkillManifest[] = skillRegistry
        .getAll()
        .map((def) => def.manifest);
      return ok(manifestsToSkills(manifests));
    } catch (err) {
      return failErr('SKILL.LIST', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SKILL.GET, async (_evt, name: string): Promise<ApiResponse<Skill | null>> => {
    try {
      if (!name || typeof name !== 'string') return fail('name is required');
      const def = skillRegistry.get(name);
      if (!def) return ok(null);
      return ok(manifestToSkill(def.manifest));
    } catch (err) {
      return failErr('SKILL.GET', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SKILL.GET_TOOLS, async (
    _evt,
    args: { agentId: string },
  ): Promise<ApiResponse<LLMTool[]>> => {
    try {
      if (!args?.agentId) return fail('agentId is required');
      const agent = agentRepo.findById(String(args.agentId));
      if (!agent) return fail(`Agent not found: ${args.agentId}`);
      return ok(skillRegistry.getToolsForAgent(agent));
    } catch (err) {
      return failErr('SKILL.GET_TOOLS', err);
    }
  });
}

function manifestToSkill(m: SkillManifest): Skill {
  return {
    name: m.name,
    displayName: m.displayName ?? m.name,
    description: m.description ?? '',
    category: m.category,
    parameters: m.parameters as unknown as Skill['parameters'],
    requiresApproval: m.requiresApproval,
    dangerous: m.dangerous,
  };
}

function manifestsToSkills(manifests: SkillManifest[]): Skill[] {
  return manifests.map(manifestToSkill);
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
