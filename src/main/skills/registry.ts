import type { Agent, LLMTool } from '../../shared/types';
import type { SkillManifest } from '../../shared/skills-schema';
import type {
  SkillCategory,
  SkillDefinition,
  SkillRegistryEntry,
} from './types';

export class SkillRegistry {
  private entries = new Map<string, SkillRegistryEntry>();

  register(definition: SkillDefinition): void {
    if (!definition?.manifest?.name) {
      throw new Error('SkillRegistry.register: definition.manifest.name is required');
    }
    if (this.entries.has(definition.manifest.name)) {
      throw new Error(`Skill "${definition.manifest.name}" is already registered`);
    }
    this.entries.set(definition.manifest.name, { definition });
  }

  unregister(name: string): void {
    this.entries.delete(name);
  }

  get(name: string): SkillDefinition | undefined {
    return this.entries.get(name)?.definition;
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.entries.values()).map((e) => e.definition);
  }

  getByCategory(category: SkillCategory): SkillDefinition[] {
    return this.getAll().filter((d) => d.manifest.category === category);
  }

  getEnabledForAgent(agent: Agent): SkillDefinition[] {
    const enabled = new Set(
      (agent.enabledSkills ?? [])
        .filter((s) => s?.enabled && typeof s.name === 'string')
        .map((s) => s.name)
    );
    return this.getAll().filter((d) => enabled.has(d.manifest.name));
  }

  getToolsForAgent(agent: Agent): LLMTool[] {
    return this.getEnabledForAgent(agent).map((d) => d.toTool());
  }

  toOpenAITools(): LLMTool[] {
    return this.getAll().map((d) => d.toTool());
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  clear(): void {
    this.entries.clear();
  }
}

let singleton: SkillRegistry | null = null;

export function getSkillRegistry(): SkillRegistry {
  if (!singleton) {
    singleton = new SkillRegistry();
  }
  return singleton;
}

export function resetSkillRegistry(): void {
  singleton = null;
}

export function _setSkillRegistryForTests(reg: SkillRegistry | null): void {
  singleton = reg;
}

export type { SkillCategory, SkillDefinition, SkillRegistryEntry };
export type _SkillManifestAlias = SkillManifest;
