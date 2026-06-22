/**
 * IPC handlers for LLM provider CRUD + listing/testing.
 *
 * Provider CRUD lives in the database (`LLMProviderRepository`); the API
 * keys are encrypted at rest via `security/crypto`. The `ProviderManager`
 * is passed in so we can run live `listModels` / `testConnection` calls
 * against the configured provider endpoint.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { PRESET_PROVIDERS, modelSuggestions } from '../../shared/llm-providers';
import type { ApiResponse, LLMProvider } from '../../shared/types';
import type { ProviderManager } from '../llm';
import type { LLMProviderRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:llm');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export interface LLMHandlerDeps {
  providers: LLMProviderRepository;
  providerManager: ProviderManager;
}

export function registerLLMHandlers(deps: LLMHandlerDeps): void {
  const { providers, providerManager } = deps;

  ipcMain.handle(IPC_CHANNELS.LLM.LIST, async (): Promise<ApiResponse<LLMProvider[]>> => {
    try {
      return ok(providers.findAll());
    } catch (err) {
      log.error('LLM.LIST failed', err);
      return fail(errMsg(err));
    }
  });

  ipcMain.handle(IPC_CHANNELS.LLM.GET, async (_evt, id: string): Promise<ApiResponse<LLMProvider | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(providers.findById(id));
    } catch (err) {
      log.error('LLM.GET failed', err);
      return fail(errMsg(err));
    }
  });

  ipcMain.handle(IPC_CHANNELS.LLM.CREATE, async (_evt, input: Partial<LLMProvider>): Promise<ApiResponse<LLMProvider>> => {
    try {
      const created = providers.create(sanitizeProviderInput(input));
      providerManager.invalidate(created.id);
      return ok(created);
    } catch (err) {
      log.error('LLM.CREATE failed', err);
      return fail(errMsg(err));
    }
  });

  ipcMain.handle(IPC_CHANNELS.LLM.UPDATE, async (_evt, id: string, partial: Partial<LLMProvider>): Promise<ApiResponse<LLMProvider | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      const updated = providers.update(id, sanitizeProviderInput(partial));
      providerManager.invalidate(id);
      return ok(updated);
    } catch (err) {
      log.error('LLM.UPDATE failed', err);
      return fail(errMsg(err));
    }
  });

  ipcMain.handle(IPC_CHANNELS.LLM.DELETE, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      const okDelete = providers.delete(id);
      providerManager.invalidate(id);
      return ok(okDelete);
    } catch (err) {
      log.error('LLM.DELETE failed', err);
      return fail(errMsg(err));
    }
  });

  ipcMain.handle(IPC_CHANNELS.LLM.SET_DEFAULT, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      providers.setDefault(id);
      providerManager.invalidate();
      return ok(true);
    } catch (err) {
      log.error('LLM.SET_DEFAULT failed', err);
      return fail(errMsg(err));
    }
  });

  ipcMain.handle(IPC_CHANNELS.LLM.TEST, async (
    _evt,
    args: { providerId?: string; provider?: Partial<LLMProvider> },
  ): Promise<ApiResponse<{ success: boolean; message: string; latencyMs: number }>> => {
    try {
      let input: Partial<LLMProvider> | undefined = args?.provider;
      if (!input && args?.providerId) {
        const stored = providers.findById(args.providerId);
        if (!stored) return fail(`Provider not found: ${args.providerId}`);
        input = stored;
      }
      if (!input || !input.baseUrl || !input.model) {
        return fail('baseUrl and model are required');
      }
      const result = await providerManager.testConnection(input);
      return ok(result);
    } catch (err) {
      log.error('LLM.TEST failed', err);
      return fail(errMsg(err));
    }
  });

  ipcMain.handle(IPC_CHANNELS.LLM.LIST_MODELS, async (
    _evt,
    args: { providerId?: string; baseUrl?: string; apiKey?: string },
  ): Promise<ApiResponse<string[]>> => {
    try {
      let input: Partial<LLMProvider> = {};
      if (args?.providerId) {
        const stored = providers.findById(args.providerId);
        if (!stored) return fail(`Provider not found: ${args.providerId}`);
        input = stored;
      } else {
        input = { baseUrl: args?.baseUrl, apiKey: args?.apiKey };
      }
      if (!input.baseUrl) return fail('baseUrl is required');
      const models = await providerManager.listModels(input);
      return ok(models);
    } catch (err) {
      log.error('LLM.LIST_MODELS failed', err);
      return fail(errMsg(err));
    }
  });

  ipcMain.handle(IPC_CHANNELS.LLM.PRESETS, async (): Promise<ApiResponse<{ presets: typeof PRESET_PROVIDERS; suggestions: typeof modelSuggestions }>> => {
    try {
      return ok({ presets: PRESET_PROVIDERS, suggestions: modelSuggestions });
    } catch (err) {
      return fail(errMsg(err));
    }
  });
}

function sanitizeProviderInput(input: Partial<LLMProvider> | undefined): Partial<LLMProvider> {
  if (!input) return {};
  const out: Partial<LLMProvider> = {};
  if (input.name !== undefined) out.name = String(input.name);
  if (input.baseUrl !== undefined) out.baseUrl = String(input.baseUrl);
  if (input.apiKey !== undefined) out.apiKey = input.apiKey == null ? '' : String(input.apiKey);
  if (input.model !== undefined) out.model = String(input.model);
  if (input.temperature !== undefined) out.temperature = numberOrUndefined(input.temperature);
  if (input.maxTokens !== undefined) out.maxTokens = numberOrUndefined(input.maxTokens);
  if (input.topP !== undefined) out.topP = numberOrUndefined(input.topP);
  if (input.systemPromptPrefix !== undefined) out.systemPromptPrefix = input.systemPromptPrefix == null ? undefined : String(input.systemPromptPrefix);
  if (input.isDefault !== undefined) out.isDefault = Boolean(input.isDefault);
  if (input.headers !== undefined && input.headers && typeof input.headers === 'object') {
    out.headers = input.headers as LLMProvider['headers'];
  }
  return out;
}

function numberOrUndefined(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}