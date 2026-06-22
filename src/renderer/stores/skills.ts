import { create } from 'zustand';
import type { Agent, LLMTool, Skill } from '../../shared/types';
import { api, unwrap } from '../lib/api';

interface SkillsState {
  skills: Skill[];
  agentTools: Record<string, LLMTool[]>;
  loading: boolean;
  error: string | null;

  loadSkills: () => Promise<void>;
  loadAgentTools: (agent: Agent) => Promise<LLMTool[]>;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  agentTools: {},
  loading: false,
  error: null,

  loadSkills: async () => {
    set({ loading: true, error: null });
    try {
      const skills = unwrap(await api.skills.list());
      set({ skills, loading: false });
    } catch (err) {
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
}));