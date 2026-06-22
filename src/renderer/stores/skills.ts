import { create } from 'zustand';
import type { Agent, LLMTool, Skill } from '../../shared/types';
import type { SkillManifest, SkillParameter } from '../../shared/skills-schema';
import { api, unwrap } from '../lib/api';

export interface UserSkillRecord extends SkillManifest {
  enabled: boolean;
  implementation: string;
  createdAt: number;
  updatedAt: number;
}

export interface SkillTestResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export interface UserSkillDraft {
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  author: string;
  parameters: SkillParameter[];
  requiresApproval: boolean;
  dangerous: boolean;
  implementation: string;
  enabled: boolean;
}

interface SkillsState {
  skills: Skill[];
  userSkills: UserSkillRecord[];
  agentTools: Record<string, LLMTool[]>;
  loading: boolean;
  error: string | null;
  testRunning: boolean;
  lastTest: SkillTestResult | null;

  loadSkills: () => Promise<void>;
  loadAgentTools: (agent: Agent) => Promise<LLMTool[]>;

  createUserSkill: (draft: UserSkillDraft) => Promise<SkillManifest>;
  updateUserSkill: (
    name: string,
    draft: Partial<UserSkillDraft>,
  ) => Promise<SkillManifest | null>;
  deleteUserSkill: (name: string) => Promise<boolean>;
  testUserSkill: (args: {
    name?: string;
    manifest?: Partial<SkillManifest>;
    implementation?: string;
    testArgs?: Record<string, unknown>;
    workingDirectory?: string;
  }) => Promise<SkillTestResult>;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  userSkills: [],
  agentTools: {},
  loading: false,
  error: null,
  testRunning: false,
  lastTest: null,

  loadSkills: async () => {
    set({ loading: true, error: null });
    try {
      const [list, userList] = await Promise.all([
        api.skills.list(),
        api.skills.listUser().catch(() => null),
      ]);
      const skills = unwrap(list) as unknown as Skill[];
      const userSkills = userList ? (unwrap(userList) as unknown as UserSkillRecord[]) : [];
      set({ skills, userSkills, loading: false });
    } catch (err) {
      console.error('Failed to load skills:', err);
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load skills',
      });
    }
  },

  loadAgentTools: async (agent) => {
    try {
      const tools = unwrap(await api.skills.getTools(agent));
      set((s) => ({
        agentTools: { ...s.agentTools, [agent.id]: tools },
      }));
      return tools;
    } catch (err) {
      console.error('Failed to load agent tools:', err);
      return get().agentTools[agent.id] ?? [];
    }
  },

  createUserSkill: async (draft) => {
    const created = unwrap(
      await api.skills.create(draft as unknown as Parameters<typeof api.skills.create>[0]),
    );
    await get().loadSkills();
    return created as unknown as SkillManifest;
  },

  updateUserSkill: async (name, draft) => {
    const updated = unwrap(
      await api.skills.update(name, draft as unknown as Parameters<typeof api.skills.update>[1]),
    );
    await get().loadSkills();
    return updated ? (updated as unknown as SkillManifest) : null;
  },

  deleteUserSkill: async (name) => {
    const ok = unwrap(await api.skills.delete(name));
    await get().loadSkills();
    return ok;
  },

  testUserSkill: async (args) => {
    set({ testRunning: true });
    try {
      const result = unwrap(await api.skills.test(args));
      set({ lastTest: result, testRunning: false });
      return result;
    } catch (err) {
      const failed: SkillTestResult = {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
      set({ lastTest: failed, testRunning: false });
      return failed;
    }
  },
}));
