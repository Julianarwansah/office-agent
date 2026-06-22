import { SkillRegistry, getSkillRegistry } from './registry';
import { SkillExecutor } from './executor';
import { registerBuiltinSkills } from './builtin';
import type {
  SkillCategory,
  SkillContext,
  SkillDefinition,
  SkillRegistryEntry,
  SkillResult,
} from './types';

export * from './types';
export * from './registry';
export * from './executor';
export * from './builtin';

export function createDefaultRegistry(): SkillRegistry {
  const registry = getSkillRegistry();
  registerBuiltinSkills(registry);
  return registry;
}

export type { SkillCategory, SkillDefinition, SkillResult, SkillContext, SkillRegistryEntry };
export { SkillRegistry, SkillExecutor };
