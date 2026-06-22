/**
 * Loader for user-defined skills.
 *
 * Reads persisted user skills from the UserSkillRepository and registers
 * each one (as a sandboxed user-script SkillDefinition) in the
 * SkillRegistry. Also exposes helpers to add/remove a single skill at
 * runtime when the user creates or deletes a skill from the UI.
 */

import type { UserSkill, UserSkillRepository } from '../db/repositories/user-skills';
import type { SkillRegistry } from './registry';
import { buildUserScriptSkill } from './user-script';
import { createLogger } from '../utils/logger';

const log = createLogger('skills:user');

function userSkillToDefinition(skill: UserSkill) {
  return buildUserScriptSkill({
    manifest: {
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      category: skill.category,
      version: skill.version,
      author: skill.author,
      parameters: skill.parameters,
      requiresApproval: skill.requiresApproval,
      dangerous: skill.dangerous,
    },
    implementation: skill.implementation,
    owner: skill.author,
  });
}

export function loadAllUserSkills(
  registry: SkillRegistry,
  repo: UserSkillRepository,
): { loaded: number; skipped: number; names: string[] } {
  let loaded = 0;
  let skipped = 0;
  const names: string[] = [];
  const rows = repo.loadManifests();
  for (const { skill } of rows) {
    if (!skill.enabled) {
      skipped++;
      continue;
    }
    try {
      // If a builtin skill with the same name is already registered, the
      // user skill wins — unregister the builtin first. This is the
      // documented behaviour: user skills override builtins by name.
      if (registry.has(skill.name)) {
        log.warn(`user skill "${skill.name}" overrides existing builtin with the same name`);
        registry.unregister(skill.name);
      }
      registry.register(userSkillToDefinition(skill));
      loaded++;
      names.push(skill.name);
    } catch (e) {
      log.error(`failed to register user skill "${skill.name}"`, e);
      skipped++;
    }
  }
  if (loaded > 0) {
    log.info(`loaded ${loaded} user skill(s): ${names.join(', ')}`);
  }
  return { loaded, skipped, names };
}

export function upsertUserSkill(
  registry: SkillRegistry,
  skill: UserSkill,
): void {
  // Replacing an existing entry: unregister first so the registry's
  // "name already taken" guard doesn't fire.
  registry.unregister(skill.name);
  if (skill.enabled) {
    registry.register(userSkillToDefinition(skill));
  }
}

export function removeUserSkill(registry: SkillRegistry, name: string): void {
  registry.unregister(name);
}
