import { create } from 'zustand';
import type { Agent, AgentSkill, Team } from '../../shared/types';
import { api, unwrap } from '../lib/api';
import type { AgentFormData, TeamFormData } from '../lib/types';

interface AgentsState {
  agents: Agent[];
  teams: Team[];
  loadingAgents: boolean;
  loadingTeams: boolean;
  error: string | null;

  loadAgents: () => Promise<void>;
  loadTeams: () => Promise<void>;

  createAgent: (data: AgentFormData) => Promise<Agent>;
  updateAgent: (id: string, data: Partial<AgentFormData>) => Promise<Agent | null>;
  deleteAgent: (id: string) => Promise<void>;
  setAgentSkills: (id: string, skills: AgentSkill[]) => Promise<Agent | null>;
  duplicateAgent: (id: string) => Promise<Agent>;
  exportAgent: (id: string) => Promise<string>;
  importAgent: (json: string) => Promise<Agent>;

  createTeam: (data: TeamFormData) => Promise<Team>;
  updateTeam: (id: string, data: Partial<TeamFormData>) => Promise<Team | null>;
  deleteTeam: (id: string) => Promise<void>;
  addAgentToTeam: (teamId: string, agentId: string) => Promise<void>;
  removeAgentFromTeam: (teamId: string, agentId: string) => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  teams: [],
  loadingAgents: false,
  loadingTeams: false,
  error: null,

  loadAgents: async () => {
    set({ loadingAgents: true, error: null });
    try {
      const agents = unwrap(await api.agents.list());
      set({ agents, loadingAgents: false });
    } catch (err) {
      set({
        loadingAgents: false,
        error: err instanceof Error ? err.message : 'Failed to load agents',
      });
    }
  },

  loadTeams: async () => {
    set({ loadingTeams: true, error: null });
    try {
      const teams = unwrap(await api.teams.list());
      set({ teams, loadingTeams: false });
    } catch (err) {
      set({
        loadingTeams: false,
        error: err instanceof Error ? err.message : 'Failed to load teams',
      });
    }
  },

  createAgent: async (data) => {
    const created = unwrap(await api.agents.create(data as unknown as Partial<Agent>));
    await get().loadAgents();
    return created;
  },

  updateAgent: async (id, data) => {
    const updated = unwrap(await api.agents.update(id, data as unknown as Partial<Agent>));
    await get().loadAgents();
    return updated;
  },

  deleteAgent: async (id) => {
    unwrap(await api.agents.delete(id));
    await get().loadAgents();
  },

  setAgentSkills: async (id, skills) => {
    const updated = unwrap(await api.agents.setSkills(id, skills));
    await get().loadAgents();
    return updated;
  },

  duplicateAgent: async (id) => {
    const created = unwrap(await api.agents.duplicate(id));
    await get().loadAgents();
    return created;
  },

  exportAgent: async (id) => {
    const result = unwrap(await api.agents.export(id));
    return result.json;
  },

  importAgent: async (json) => {
    const created = unwrap(await api.agents.import({ json }));
    await get().loadAgents();
    return created;
  },

  createTeam: async (data) => {
    const created = unwrap(await api.teams.create(data as unknown as Partial<Team>));
    await get().loadTeams();
    return created;
  },

  updateTeam: async (id, data) => {
    const updated = unwrap(await api.teams.update(id, data as unknown as Partial<Team>));
    await get().loadTeams();
    return updated;
  },

  deleteTeam: async (id) => {
    unwrap(await api.teams.delete(id));
    await Promise.all([get().loadTeams(), get().loadAgents()]);
  },

  addAgentToTeam: async (teamId, agentId) => {
    unwrap(await api.teams.addAgent(teamId, agentId));
    await Promise.all([get().loadTeams(), get().loadAgents()]);
  },

  removeAgentFromTeam: async (teamId, agentId) => {
    unwrap(await api.teams.removeAgent(teamId, agentId));
    await Promise.all([get().loadTeams(), get().loadAgents()]);
  },
}));
