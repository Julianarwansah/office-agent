/**
 * IPC handlers for skills.
 *
 * - Builtin skills are registered in-memory by the SkillRegistry at boot.
 * - User-defined skills are persisted in the `user_skills` table and
 *   loaded into the same registry alongside the builtins. The CRUD
 *   handlers below mutate the table *and* add/remove the corresponding
 *   SkillDefinition from the registry so the running orchestrator sees
 *   the change immediately.
 */

import { ipcMain } from 'electron';
import * as os from 'node:os';
import * as path from 'node:path';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse, LLMTool, Skill } from '../../shared/types';
import type { SkillManifest, SkillParameter } from '../../shared/skills-schema';
import { SKILL_CATEGORIES } from '../skills';
import { dryRunUserSkill } from '../skills/user-script';
import { removeUserSkill, upsertUserSkill } from '../skills/user-skills';
import type { SkillRegistry } from '../skills';
import type { AgentRepository, UserSkillRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:skills');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export interface SkillHandlerDeps {
  skillRegistry: SkillRegistry;
  agents: AgentRepository;
  userSkills: UserSkillRepository;
}

const NAME_REGEX = /^[a-z][a-z0-9_]{0,63}$/;

function validateName(name: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof name !== 'string' || !NAME_REGEX.test(name)) {
    return {
      ok: false,
      error:
        'Skill name must be lowercase, start with a letter, and use only letters, digits, and underscores (max 64 chars).',
    };
  }
  return { ok: true, name };
}

function normalizeParameters(raw: unknown): { ok: true; value: SkillParameter[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'parameters must be an array' };
  }
  const out: SkillParameter[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i] as Record<string, unknown> | null;
    if (!p || typeof p !== 'object') {
      return { ok: false, error: `parameters[${i}] must be an object` };
    }
    if (typeof p.name !== 'string' || !p.name.trim()) {
      return { ok: false, error: `parameters[${i}].name is required` };
    }
    if (seen.has(p.name)) {
      return { ok: false, error: `parameters[${i}].name duplicates an earlier parameter` };
    }
    seen.add(p.name);
    const type = String(p.type) as SkillParameter['type'];
    if (!['string', 'number', 'boolean', 'array', 'object'].includes(type)) {
      return { ok: false, error: `parameters[${i}].type must be one of string|number|boolean|array|object` };
    }
    const param: SkillParameter = {
      name: p.name,
      type,
      description: typeof p.description === 'string' ? p.description : '',
      required: p.required === true,
    };
    if (p.default !== undefined) {
      param.default = p.default as SkillParameter['default'];
    }
    if (Array.isArray(p.enum)) {
      param.enum = (p.enum as unknown[]).map((v) => String(v));
    }
    out.push(param);
  }
  return { ok: true, value: out };
}

export function registerSkillHandlers(deps: SkillHandlerDeps): void {
  const { skillRegistry, agents: agentRepo, userSkills: userSkillRepo } = deps;

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

  ipcMain.handle(IPC_CHANNELS.SKILL.LIST_USER, async (): Promise<ApiResponse<Array<{
    name: string;
    displayName: string;
    description: string;
    category: string;
    version: string;
    author?: string;
    parameters: SkillParameter[];
    requiresApproval: boolean;
    dangerous: boolean;
    examples?: SkillManifest['examples'];
    implementation: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  }>>> => {
    try {
      const all = userSkillRepo.findAll();
      return ok(all.map((s) => ({
        name: s.name,
        displayName: s.displayName,
        description: s.description,
        category: s.category,
        version: s.version,
        author: s.author,
        parameters: s.parameters,
        requiresApproval: s.requiresApproval,
        dangerous: s.dangerous,
        examples: undefined,
        implementation: s.implementation,
        enabled: s.enabled,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })));
    } catch (err) {
      return failErr('SKILL.LIST_USER', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SKILL.GET_USER, async (
    _evt,
    name: string,
  ): Promise<ApiResponse<{
    name: string;
    displayName: string;
    description: string;
    category: string;
    version: string;
    author?: string;
    parameters: SkillParameter[];
    requiresApproval: boolean;
    dangerous: boolean;
    examples?: SkillManifest['examples'];
    implementation: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  } | null>> => {
    try {
      if (!name || typeof name !== 'string') return fail('name is required');
      const found = userSkillRepo.findByName(name);
      if (!found) return ok(null);
      return ok({
        name: found.name,
        displayName: found.displayName,
        description: found.description,
        category: found.category,
        version: found.version,
        author: found.author,
        parameters: found.parameters,
        requiresApproval: found.requiresApproval,
        dangerous: found.dangerous,
        examples: undefined,
        implementation: found.implementation,
        enabled: found.enabled,
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
      });
    } catch (err) {
      return failErr('SKILL.GET_USER', err);
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

  ipcMain.handle(IPC_CHANNELS.SKILL.CREATE, async (
    _evt,
    input: Partial<{
      name: string;
      displayName: string;
      description: string;
      category: string;
      version: string;
      author: string;
      parameters: unknown;
      requiresApproval: boolean;
      dangerous: boolean;
      implementation: string;
      enabled: boolean;
    }>,
  ): Promise<ApiResponse<Skill>> => {
    try {
      if (!input || typeof input !== 'object') return fail('input is required');
      const nameCheck = validateName(input.name);
      if (!nameCheck.ok) return fail(nameCheck.error);
      if (skillRegistry.has(nameCheck.name)) {
        return fail(`A skill named "${nameCheck.name}" already exists (builtin or user).`);
      }
      if (typeof input.displayName !== 'string' || !input.displayName.trim()) {
        return fail('displayName is required');
      }
      const category = typeof input.category === 'string' && input.category.trim()
        ? input.category.trim().toLowerCase()
        : 'productivity';
      if (!SKILL_CATEGORIES.includes(category as (typeof SKILL_CATEGORIES)[number])) {
        return fail(`Unknown category "${category}". Valid: ${SKILL_CATEGORIES.join(', ')}`);
      }
      const paramCheck = normalizeParameters(input.parameters);
      if (!paramCheck.ok) return fail(paramCheck.error);
      if (typeof input.implementation !== 'string' || !input.implementation.trim()) {
        return fail('implementation is required (JavaScript source body).');
      }

      const created = userSkillRepo.create({
        name: nameCheck.name,
        displayName: input.displayName.trim(),
        description: (input.description ?? '').trim(),
        category,
        version: (input.version ?? '1.0.0').trim() || '1.0.0',
        author: input.author?.trim() || undefined,
        parameters: paramCheck.value,
        requiresApproval: input.requiresApproval === true,
        dangerous: input.dangerous === true,
        implementation: input.implementation,
        enabled: input.enabled !== false,
      });
      try {
        upsertUserSkill(skillRegistry, created);
      } catch (e) {
        log.warn(`created user skill "${created.name}" but failed to register`, e);
      }
      return ok(manifestToSkill(userSkillRepo.toManifest(created)));
    } catch (err) {
      return failErr('SKILL.CREATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SKILL.UPDATE, async (
    _evt,
    name: string,
    partial: Partial<{
      displayName: string;
      description: string;
      category: string;
      version: string;
      author: string;
      parameters: unknown;
      requiresApproval: boolean;
      dangerous: boolean;
      implementation: string;
      enabled: boolean;
    }>,
  ): Promise<ApiResponse<Skill | null>> => {
    try {
      const nameCheck = validateName(name);
      if (!nameCheck.ok) return fail(nameCheck.error);
      const existing = userSkillRepo.findByName(nameCheck.name);
      if (!existing) {
        return fail(`User skill "${nameCheck.name}" not found. Builtin skills cannot be edited from here.`);
      }
      const patch: Record<string, unknown> = {};
      if (partial?.displayName !== undefined) {
        if (typeof partial.displayName !== 'string' || !partial.displayName.trim()) {
          return fail('displayName cannot be empty');
        }
        patch.displayName = partial.displayName.trim();
      }
      if (partial?.description !== undefined) {
        patch.description = String(partial.description ?? '');
      }
      if (partial?.category !== undefined) {
        const cat = String(partial.category).toLowerCase();
        if (!SKILL_CATEGORIES.includes(cat as (typeof SKILL_CATEGORIES)[number])) {
          return fail(`Unknown category "${cat}". Valid: ${SKILL_CATEGORIES.join(', ')}`);
        }
        patch.category = cat;
      }
      if (partial?.version !== undefined) {
        patch.version = String(partial.version ?? '1.0.0').trim() || '1.0.0';
      }
      if (partial?.author !== undefined) {
        const a = partial.author?.trim();
        patch.author = a ? a : null;
      }
      if (partial?.parameters !== undefined) {
        const paramCheck = normalizeParameters(partial.parameters);
        if (!paramCheck.ok) return fail(paramCheck.error);
        patch.parameters = paramCheck.value;
      }
      if (partial?.requiresApproval !== undefined) {
        patch.requiresApproval = partial.requiresApproval === true;
      }
      if (partial?.dangerous !== undefined) {
        patch.dangerous = partial.dangerous === true;
      }
      if (partial?.implementation !== undefined) {
        if (typeof partial.implementation !== 'string' || !partial.implementation.trim()) {
          return fail('implementation cannot be empty');
        }
        patch.implementation = partial.implementation;
      }
      if (partial?.enabled !== undefined) {
        patch.enabled = partial.enabled === true;
      }
      const updated = userSkillRepo.update(nameCheck.name, patch as never);
      if (!updated) return ok(null);
      try {
        upsertUserSkill(skillRegistry, updated);
      } catch (e) {
        log.warn(`updated user skill "${updated.name}" but failed to re-register`, e);
      }
      return ok(manifestToSkill(userSkillRepo.toManifest(updated)));
    } catch (err) {
      return failErr('SKILL.UPDATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SKILL.DELETE, async (
    _evt,
    name: string,
  ): Promise<ApiResponse<boolean>> => {
    try {
      const nameCheck = validateName(name);
      if (!nameCheck.ok) return fail(nameCheck.error);
      const ok_deleted = userSkillRepo.delete(nameCheck.name);
      if (ok_deleted) {
        removeUserSkill(skillRegistry, nameCheck.name);
      }
      return ok(ok_deleted);
    } catch (err) {
      return failErr('SKILL.DELETE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SKILL.TEST, async (
    _evt,
    args: {
      name?: string;
      manifest?: Partial<SkillManifest>;
      implementation?: string;
      testArgs?: Record<string, unknown>;
      workingDirectory?: string;
    },
  ): Promise<ApiResponse<{ success: boolean; output: string; error?: string; durationMs: number }>> => {
    const started = Date.now();
    try {
      let manifest: SkillManifest | null = null;
      let implementation = '';
      if (args?.name) {
        const def = skillRegistry.get(args.name);
        if (!def) return fail(`Skill not found: ${args.name}`);
        manifest = def.manifest;
        // Builtin skills don't have a "test implementation" — the only way
        // to dry-run them is to actually execute them, which we decline to
        // do here. Tell the renderer this.
        if (args.implementation === undefined) {
          return ok({
            success: false,
            output: '',
            error: 'Testing builtin skills is not supported via SKILL.TEST; use the agent runner.',
            durationMs: Date.now() - started,
          });
        }
        implementation = args.implementation;
      } else if (args?.manifest && typeof args.implementation === 'string') {
        const m = args.manifest;
        if (typeof m.name !== 'string' || !m.name.trim()) return fail('manifest.name is required');
        if (typeof m.displayName !== 'string' || !m.displayName.trim()) return fail('manifest.displayName is required');
        manifest = {
          name: m.name,
          displayName: m.displayName,
          description: m.description ?? '',
          category: m.category ?? 'productivity',
          version: m.version ?? '1.0.0',
          author: m.author,
          parameters: Array.isArray(m.parameters) ? (m.parameters as SkillParameter[]) : [],
          requiresApproval: m.requiresApproval === true,
          dangerous: m.dangerous === true,
        };
        implementation = args.implementation;
      } else {
        return fail('Provide either `name` (to test a registered user skill) or `manifest` + `implementation`.');
      }
      if (!manifest) return fail('Failed to build manifest for test');
      const wd = args.workingDirectory || process.cwd() || os.tmpdir() || path.sep;
      const result = await dryRunUserSkill({
        manifest,
        implementation,
        args: (args.testArgs ?? {}) as Record<string, unknown>,
        workingDirectory: wd,
      });
      return ok({
        success: result.success,
        output: result.output,
        error: result.error,
        durationMs: Date.now() - started,
      });
    } catch (err) {
      return failErr('SKILL.TEST', err);
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
