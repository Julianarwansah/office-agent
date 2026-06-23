import { create } from 'zustand';
import type { LLMProvider } from '../../shared/types';
import { api, unwrap } from '../lib/api';
import type { LLMSettingsData } from '../lib/types';

interface PresetInfo {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
}

interface LLMState {
  providers: LLMProvider[];
  defaultProvider: LLMProvider | null;
  presets: PresetInfo[];
  models: Record<string, string[]>;
  loading: boolean;
  testing: boolean;
  error: string | null;

  loadProviders: () => Promise<void>;
  loadPresets: () => Promise<void>;
  createProvider: (data: LLMSettingsData) => Promise<LLMProvider>;
  updateProvider: (id: string, data: Partial<LLMSettingsData>) => Promise<LLMProvider | null>;
  deleteProvider: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  testProvider: (id: string) => Promise<TestResult>;
  testProviderInline: (data: Partial<LLMProvider>) => Promise<TestResult>;
  loadModels: (providerId: string) => Promise<string[]>;
  loadModelsInline: (data: { baseUrl?: string; apiKey?: string }) => Promise<string[]>;
  clearError: () => void;
}

export interface TestResult {
  ok: boolean;
  success?: boolean;
  message: string;
  latencyMs?: number;
  testedAt?: number;
}

export const useLLMStore = create<LLMState>((set, get) => ({
  providers: [],
  defaultProvider: null,
  presets: [],
  models: {},
  loading: false,
  testing: false,
  error: null,

  loadProviders: async () => {
    set({ loading: true, error: null });
    try {
      const providers = unwrap(await api.llm.list());
      const defaultProvider = providers.find((p) => p.isDefault) ?? providers[0] ?? null;
      set({ providers, defaultProvider, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load providers',
      });
    }
  },

  loadPresets: async () => {
    try {
      const payload = unwrap(await api.llm.presets());
      set({
        presets: (payload.presets ?? []).map((p) => ({
          id: p.name,
          name: p.name,
          baseUrl: p.baseUrl,
          model: p.defaultModel,
        })),
      });
    } catch (err) {
      console.error('Failed to load LLM presets:', err);
    }
  },

  createProvider: async (data) => {
    const created = unwrap(await api.llm.create(data as Partial<LLMProvider>));
    await get().loadProviders();
    return created;
  },

  updateProvider: async (id, data) => {
    const updated = unwrap(await api.llm.update(id, data as Partial<LLMProvider>));
    await get().loadProviders();
    return updated;
  },

  deleteProvider: async (id) => {
    unwrap(await api.llm.delete(id));
    await get().loadProviders();
  },

  setDefault: async (id) => {
    unwrap(await api.llm.setDefault(id));
    await get().loadProviders();
  },

  testProvider: async (id) => {
    set({ testing: true });
    try {
      const result = unwrap(await api.llm.test(id));
      const r = result as { success?: boolean; message?: string; latencyMs?: number };
      const ok = !!(r && (r.success ?? true) !== false);
      set({ testing: false });
      return {
        ok,
        success: ok,
        message: r?.message ?? (ok ? 'Connection successful' : 'Connection failed'),
        latencyMs: r?.latencyMs,
        testedAt: Date.now(),
      };
    } catch (err) {
      set({ testing: false });
      return {
        ok: false,
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
        testedAt: Date.now(),
      };
    }
  },

  testProviderInline: async (data) => {
    set({ testing: true });
    try {
      const result = unwrap(await api.llm.test({ provider: data }));
      const r = result as { success?: boolean; message?: string; latencyMs?: number };
      const ok = !!(r && (r.success ?? true) !== false);
      set({ testing: false });
      return {
        ok,
        success: ok,
        message: r?.message ?? (ok ? 'Connection successful' : 'Connection failed'),
        latencyMs: r?.latencyMs,
        testedAt: Date.now(),
      };
    } catch (err) {
      set({ testing: false });
      return {
        ok: false,
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
        testedAt: Date.now(),
      };
    }
  },

  loadModels: async (providerId) => {
    try {
      const result = unwrap(await api.llm.listModels(providerId));
      const list = Array.isArray(result) ? result : [];
      set((s) => ({ models: { ...s.models, [providerId]: list } }));
      return list;
    } catch (err) {
      console.error('Failed to load models for provider:', providerId, err);
      return [];
    }
  },

  loadModelsInline: async (data) => {
    try {
      const result = unwrap(await api.llm.listModels(data));
      return Array.isArray(result) ? result : [];
    } catch (err) {
      console.error('Failed to load models inline:', err);
      return [];
    }
  },

  clearError: () => set({ error: null }),
}));
