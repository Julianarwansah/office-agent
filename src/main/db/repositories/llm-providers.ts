import { getDb } from '../index';
import { newId, nowIso, parseJson, stringifyJson, fromIntBool, toIntBool, isoToMs } from '../helpers';
import { encrypt, decrypt } from '../../security/crypto';
import type { LLMProvider, LLMProviderHeaders } from '../../../shared/types';

interface LLMProviderRow {
  id: string;
  name: string;
  base_url: string;
  api_key_encrypted: string | null;
  model: string;
  temperature: number | null;
  max_tokens: number | null;
  top_p: number | null;
  system_prompt_prefix: string | null;
  is_default: number | null;
  headers: string | null;
  created_at: string;
  updated_at: string;
}

export type LLMProviderCreateInput = Omit<LLMProvider, 'id'>;
export type LLMProviderUpdateInput = Partial<Omit<LLMProvider, 'id'>>;

export class LLMProviderRepository {
  private mapRow(row: LLMProviderRow): LLMProvider {
    const headers = parseJson<LLMProviderHeaders>(row.headers);
    let apiKey: string | undefined;
    if (row.api_key_encrypted) {
      try {
        apiKey = decrypt(row.api_key_encrypted);
      } catch {
        apiKey = undefined;
      }
    }
    return {
      id: row.id,
      name: row.name,
      baseUrl: row.base_url,
      apiKey,
      model: row.model,
      temperature: row.temperature ?? undefined,
      maxTokens: row.max_tokens ?? undefined,
      topP: row.top_p ?? undefined,
      systemPromptPrefix: row.system_prompt_prefix ?? undefined,
      isDefault: toIntBool(row.is_default),
      headers: headers && Object.keys(headers).length > 0 ? headers : undefined,
    };
  }

  create(input: LLMProviderCreateInput): LLMProvider {
    const db = getDb();
    const id = newId();
    const createdAt = nowIso();
    const encryptedKey = input.apiKey ? encrypt(input.apiKey) : null;
    const headersJson = input.headers ? stringifyJson(input.headers) : null;
    const isDefault = fromIntBool(input.isDefault ?? false);

    db.prepare(
      `INSERT INTO llm_providers (
        id, name, base_url, api_key_encrypted, model, temperature, max_tokens, top_p,
        system_prompt_prefix, is_default, headers, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name,
      input.baseUrl,
      encryptedKey,
      input.model,
      input.temperature ?? 0.7,
      input.maxTokens ?? 4096,
      input.topP ?? 1.0,
      input.systemPromptPrefix ?? null,
      isDefault,
      headersJson,
      createdAt,
      createdAt
    );

    const created = this.findById(id);
    if (!created) throw new Error('LLMProviderRepository.create: failed to read back inserted provider');
    return created;
  }

  update(id: string, partial: LLMProviderUpdateInput): LLMProvider | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (partial.name !== undefined) {
      fields.push('name = ?');
      values.push(partial.name);
    }
    if (partial.baseUrl !== undefined) {
      fields.push('base_url = ?');
      values.push(partial.baseUrl);
    }
    if (partial.apiKey !== undefined) {
      fields.push('api_key_encrypted = ?');
      values.push(partial.apiKey ? encrypt(partial.apiKey) : null);
    }
    if (partial.model !== undefined) {
      fields.push('model = ?');
      values.push(partial.model);
    }
    if (partial.temperature !== undefined) {
      fields.push('temperature = ?');
      values.push(partial.temperature);
    }
    if (partial.maxTokens !== undefined) {
      fields.push('max_tokens = ?');
      values.push(partial.maxTokens);
    }
    if (partial.topP !== undefined) {
      fields.push('top_p = ?');
      values.push(partial.topP);
    }
    if (partial.systemPromptPrefix !== undefined) {
      fields.push('system_prompt_prefix = ?');
      values.push(partial.systemPromptPrefix ?? null);
    }
    if (partial.isDefault !== undefined) {
      fields.push('is_default = ?');
      values.push(fromIntBool(partial.isDefault));
    }
    if (partial.headers !== undefined) {
      fields.push('headers = ?');
      values.push(partial.headers ? stringifyJson(partial.headers) : null);
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(nowIso());
    values.push(id);

    db.prepare(`UPDATE llm_providers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM llm_providers WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findById(id: string): LLMProvider | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM llm_providers WHERE id = ?').get(id) as LLMProviderRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  findAll(): LLMProvider[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM llm_providers ORDER BY is_default DESC, name ASC').all() as LLMProviderRow[];
    return rows.map((r) => this.mapRow(r));
  }

  setDefault(id: string): void {
    const db = getDb();
    const provider = this.findById(id);
    if (!provider) return;
    db.prepare('UPDATE llm_providers SET is_default = 0').run();
    db.prepare('UPDATE llm_providers SET is_default = 1, updated_at = ? WHERE id = ?').run(nowIso(), id);
  }

  getDefault(): LLMProvider | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM llm_providers WHERE is_default = 1 LIMIT 1')
      .get() as LLMProviderRow | undefined;
    if (row) return this.mapRow(row);
    const fallback = db
      .prepare('SELECT * FROM llm_providers ORDER BY created_at ASC LIMIT 1')
      .get() as LLMProviderRow | undefined;
    return fallback ? this.mapRow(fallback) : null;
  }
}

export const llmProviders = new LLMProviderRepository();
