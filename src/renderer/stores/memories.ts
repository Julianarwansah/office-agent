import { create } from 'zustand';
import type { Memory } from '../../shared/types';
import { api, unwrap } from '../lib/api';
import type { MemoryFormData } from '../lib/types';

interface MemoriesState {
  memoriesByAgent: Record<string, Memory[]>;
  loading: boolean;
  searching: boolean;
  consolidating: boolean;
  error: string | null;
  searchResults: Record<string, Memory[]>;

  loadMemories: (agentId: string) => Promise<void>;
  loadAllMemories: (agentIds: string[]) => Promise<void>;
  createMemory: (data: MemoryFormData) => Promise<Memory>;
  updateMemory: (id: string, data: Partial<MemoryFormData>) => Promise<Memory | null>;
  deleteMemory: (id: string) => Promise<void>;
  pinMemory: (id: string) => Promise<void>;
  unpinMemory: (id: string) => Promise<void>;
  searchMemories: (agentId: string, query: string) => Promise<Memory[]>;
  consolidateMemories: (agentId: string, chatRoomId: string) => Promise<void>;
  extractMemories: (agentId: string, text: string, sourceMessageId?: string) => Promise<Memory[]>;
}

export const useMemoriesStore = create<MemoriesState>((set, get) => ({
  memoriesByAgent: {},
  loading: false,
  searching: false,
  consolidating: false,
  error: null,
  searchResults: {},

  loadMemories: async (agentId) => {
    set({ loading: true, error: null });
    try {
      const memories = unwrap(await api.memories.list({ agentId }));
      set((s) => ({
        memoriesByAgent: { ...s.memoriesByAgent, [agentId]: memories },
        loading: false,
      }));
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load memories',
      });
    }
  },

  loadAllMemories: async (agentIds) => {
    set({ loading: true });
    try {
      const results = await Promise.all(
        agentIds.map(async (id) => {
          try {
            const mems = unwrap(await api.memories.list({ agentId: id }));
            return [id, mems] as const;
          } catch {
            return [id, []] as const;
          }
        }),
      );
      const merged: Record<string, Memory[]> = { ...get().memoriesByAgent };
      for (const [id, mems] of results) merged[id] = [...mems];
      set({ memoriesByAgent: merged, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load memories',
      });
    }
  },

  createMemory: async (data) => {
    const created = unwrap(await api.memories.create(data as unknown as Partial<Memory>));
    set((s) => {
      const list = s.memoriesByAgent[created.agentId] ?? [];
      return {
        memoriesByAgent: {
          ...s.memoriesByAgent,
          [created.agentId]: [created, ...list],
        },
      };
    });
    return created;
  },

  updateMemory: async (id, data) => {
    const updated = unwrap(await api.memories.update(id, data as unknown as Partial<Memory>));
    if (!updated) return null;
    set((s) => {
      const list = s.memoriesByAgent[updated.agentId] ?? [];
      const next = list.map((m) => (m.id === id ? updated : m));
      return {
        memoriesByAgent: { ...s.memoriesByAgent, [updated.agentId]: next },
      };
    });
    return updated;
  },

  deleteMemory: async (id) => {
    unwrap(await api.memories.delete(id));
    set((s) => {
      const next: Record<string, Memory[]> = {};
      for (const [agentId, list] of Object.entries(s.memoriesByAgent)) {
        next[agentId] = list.filter((m) => m.id !== id);
      }
      return { memoriesByAgent: next };
    });
  },

  pinMemory: async (id) => {
    unwrap(await api.memories.pin(id));
    set((s) => {
      const next: Record<string, Memory[]> = {};
      for (const [agentId, list] of Object.entries(s.memoriesByAgent)) {
        next[agentId] = list.map((m) => (m.id === id ? { ...m, isPinned: true } : m));
      }
      return { memoriesByAgent: next };
    });
  },

  unpinMemory: async (id) => {
    unwrap(await api.memories.unpin(id));
    set((s) => {
      const next: Record<string, Memory[]> = {};
      for (const [agentId, list] of Object.entries(s.memoriesByAgent)) {
        next[agentId] = list.map((m) => (m.id === id ? { ...m, isPinned: false } : m));
      }
      return { memoriesByAgent: next };
    });
  },

  searchMemories: async (agentId, query) => {
    set({ searching: true });
    try {
      const results = unwrap(await api.memories.search({ agentId, query, limit: 50 }));
      set((s) => ({
        searchResults: { ...s.searchResults, [agentId]: results },
        searching: false,
      }));
      return results;
    } catch (err) {
      set({ searching: false });
      throw err;
    }
  },

  consolidateMemories: async (agentId, chatRoomId) => {
    set({ consolidating: true });
    try {
      unwrap(await api.memories.consolidate({ agentId, chatRoomId }));
      await get().loadMemories(agentId);
    } finally {
      set({ consolidating: false });
    }
  },

  extractMemories: async (agentId, text, sourceMessageId) => {
    const result = unwrap(
      await api.memories.extract({ agentId, text, sourceMessageId }),
    );
    const list = Array.isArray(result) ? result : [];
    set((s) => {
      const existing = s.memoriesByAgent[agentId] ?? [];
      return {
        memoriesByAgent: { ...s.memoriesByAgent, [agentId]: [...list, ...existing] },
      };
    });
    return list;
  },
}));