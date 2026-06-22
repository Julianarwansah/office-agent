import type { LLMProvider } from '../../shared/types';
import { LLMClient } from './client';
import { LLMError, ResolvedProvider } from './types';

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs: number;
  models?: string[];
}

export interface ModelsListResult {
  models: string[];
  ok: boolean;
  error?: string;
}

export type ProviderResolver = (
  providerId: string,
) => Promise<LLMProvider | null | undefined> | LLMProvider | null | undefined;

export type DecryptFn = (ciphertext: string) => string | null;

export interface ProviderManagerOptions {
  resolve?: ProviderResolver;
  decrypt?: DecryptFn;
  defaultClientFactory?: (provider: ResolvedProvider) => LLMClient;
}

function buildResolved(provider: Partial<LLMProvider>, apiKey: string): ResolvedProvider {
  return {
    baseUrl: (provider.baseUrl ?? '').replace(/\/+$/, ''),
    apiKey: apiKey ?? '',
    model: provider.model ?? '',
    temperature: provider.temperature,
    maxTokens: provider.maxTokens,
    topP: provider.topP,
    headers: provider.headers,
  };
}

export class ProviderManager {
  private readonly cache = new Map<string, LLMClient>();
  private readonly resolver?: ProviderResolver;
  private readonly decrypt?: DecryptFn;
  private readonly factory: (p: ResolvedProvider) => LLMClient;

  constructor(opts: ProviderManagerOptions = {}) {
    this.resolver = opts.resolve;
    this.decrypt = opts.decrypt;
    this.factory =
      opts.defaultClientFactory ?? ((p) => new LLMClient(p));
  }

  async resolveProvider(providerId: string): Promise<ResolvedProvider> {
    if (!this.resolver) {
      throw new LLMError(
        `Cannot resolve provider '${providerId}': no resolver configured.`,
      );
    }
    const stored = await this.resolver(providerId);
    if (!stored) {
      throw new LLMError(`Provider '${providerId}' not found.`);
    }
    let apiKey = stored.apiKey ?? '';
    if (apiKey && this.decrypt) {
      try {
        const plain = this.decrypt(apiKey);
        if (plain != null) apiKey = plain;
      } catch {
        // ignore decryption failures; treat as empty
        apiKey = '';
      }
    }
    return buildResolved(stored, apiKey);
  }

  async createClient(providerId: string): Promise<LLMClient> {
    const cached = this.cache.get(providerId);
    if (cached) return cached;
    const resolved = await this.resolveProvider(providerId);
    const client = this.factory(resolved);
    this.cache.set(providerId, client);
    return client;
  }

  invalidate(providerId?: string): void {
    if (providerId) {
      this.cache.delete(providerId);
    } else {
      this.cache.clear();
    }
  }

  async testConnection(
    provider: Partial<LLMProvider>,
  ): Promise<TestConnectionResult> {
    const start = Date.now();
    let apiKey = provider.apiKey ?? '';
    if (apiKey && this.decrypt) {
      try {
        const plain = this.decrypt(apiKey);
        if (plain != null) apiKey = plain;
      } catch {
        apiKey = '';
      }
    }
    const resolved = buildResolved(provider, apiKey);
    if (!resolved.baseUrl) {
      return {
        success: false,
        message: 'baseUrl is required.',
        latencyMs: Date.now() - start,
      };
    }
    if (!resolved.model) {
      return {
        success: false,
        message: 'model is required.',
        latencyMs: Date.now() - start,
      };
    }
    const client = this.factory(resolved);
    const result = await client.testConnection();
    return result;
  }

  async listModels(provider: Partial<LLMProvider>): Promise<string[]> {
    const result = await this.listModelsDetailed(provider);
    return result.models;
  }

  async listModelsDetailed(provider: Partial<LLMProvider>): Promise<ModelsListResult> {
    if (!provider.baseUrl) {
      return { models: [], ok: false, error: 'baseUrl is required.' };
    }
    let apiKey = provider.apiKey ?? '';
    if (apiKey && this.decrypt) {
      try {
        const plain = this.decrypt(apiKey);
        if (plain != null) apiKey = plain;
      } catch {
        apiKey = '';
      }
    }
    const baseUrl = provider.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/models`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    if (provider.headers) {
      for (const [k, v] of Object.entries(provider.headers)) {
        headers[k] = v;
      }
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        return {
          models: [],
          ok: false,
          error: `HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as
        | { data?: Array<{ id?: string } | string> }
        | Array<{ id?: string } | string>
        | undefined;
      let models: string[] = [];
      if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        models = data.data
          .map((m) => (typeof m === 'string' ? m : m?.id))
          .filter((s): s is string => typeof s === 'string' && s.length > 0);
      } else if (Array.isArray(data)) {
        models = data
          .map((m) => (typeof m === 'string' ? m : (m as { id?: string })?.id))
          .filter((s): s is string => typeof s === 'string' && s.length > 0);
      }
      return { models, ok: true };
    } catch (err) {
      return {
        models: [],
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
