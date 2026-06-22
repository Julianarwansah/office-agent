/**
 * UserSkillRepository — CRUD for user-defined skills.
 *
 * Each row stores a SkillManifest-shaped record plus a JavaScript
 * `implementation` body. User skills are loaded at boot, compiled via the
 * sandboxed user-script runner, and registered in the SkillRegistry
 * alongside the built-ins.
 */

import { getDb } from '../index';
import {
  fromIntBool,
  isoToMs,
  msToIso,
  nowIso,
  parseJson,
  stringifyJson,
  toIntBool,
} from '../helpers';
import type { SkillManifest, SkillParameter } from '../../../shared/skills-schema';

export interface UserSkill {
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  author?: string;
  parameters: SkillParameter[];
  requiresApproval: boolean;
  dangerous: boolean;
  implementation: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type UserSkillCreateInput = Omit<UserSkill, 'createdAt' | 'updatedAt'>;
export type UserSkillUpdateInput = Partial<Omit<UserSkill, 'name' | 'createdAt' | 'updatedAt'>>;

interface UserSkillRow {
  name: string;
  display_name: string;
  description: string;
  category: string;
  version: string;
  author: string | null;
  parameters: string | null;
  requires_approval: number;
  dangerous: number;
  implementation: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export class UserSkillRepository {
  private mapRow(row: UserSkillRow): UserSkill {
    return {
      name: row.name,
      displayName: row.display_name,
      description: row.description ?? '',
      category: row.category,
      version: row.version,
      author: row.author ?? undefined,
      parameters: parseJson<SkillParameter[]>(row.parameters) ?? [],
      requiresApproval: toIntBool(row.requires_approval),
      dangerous: toIntBool(row.dangerous),
      implementation: row.implementation ?? '',
      enabled: toIntBool(row.enabled),
      createdAt: isoToMs(row.created_at),
      updatedAt: isoToMs(row.updated_at),
    };
  }

  findAll(): UserSkill[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM user_skills ORDER BY name ASC')
      .all() as UserSkillRow[];
    return rows.map((r) => this.mapRow(r));
  }

  findByName(name: string): UserSkill | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM user_skills WHERE name = ?')
      .get(name) as UserSkillRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  exists(name: string): boolean {
    const db = getDb();
    const row = db
      .prepare('SELECT 1 FROM user_skills WHERE name = ?')
      .get(name) as { 1: number } | undefined;
    return !!row;
  }

  create(input: UserSkillCreateInput): UserSkill {
    const db = getDb();
    if (!input.name || typeof input.name !== 'string') {
      throw new Error('UserSkillRepository.create: name is required');
    }
    if (this.exists(input.name)) {
      throw new Error(`User skill "${input.name}" already exists`);
    }
    const now = nowIso();
    db.prepare(
      `INSERT INTO user_skills (
        name, display_name, description, category, version, author,
        parameters, requires_approval, dangerous, implementation, enabled,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.name,
      input.displayName,
      input.description ?? '',
      input.category ?? 'productivity',
      input.version ?? '1.0.0',
      input.author ?? null,
      stringifyJson(input.parameters ?? []) ?? '[]',
      fromIntBool(input.requiresApproval ?? false),
      fromIntBool(input.dangerous ?? false),
      input.implementation ?? '',
      fromIntBool(input.enabled ?? true),
      now,
      now,
    );
    const created = this.findByName(input.name);
    if (!created) {
      throw new Error('UserSkillRepository.create: failed to read back inserted row');
    }
    return created;
  }

  update(name: string, partial: UserSkillUpdateInput): UserSkill | null {
    const db = getDb();
    const existing = this.findByName(name);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (partial.displayName !== undefined) {
      fields.push('display_name = ?');
      values.push(partial.displayName);
    }
    if (partial.description !== undefined) {
      fields.push('description = ?');
      values.push(partial.description);
    }
    if (partial.category !== undefined) {
      fields.push('category = ?');
      values.push(partial.category);
    }
    if (partial.version !== undefined) {
      fields.push('version = ?');
      values.push(partial.version);
    }
    if (partial.author !== undefined) {
      fields.push('author = ?');
      values.push(partial.author ?? null);
    }
    if (partial.parameters !== undefined) {
      fields.push('parameters = ?');
      values.push(stringifyJson(partial.parameters) ?? '[]');
    }
    if (partial.requiresApproval !== undefined) {
      fields.push('requires_approval = ?');
      values.push(fromIntBool(partial.requiresApproval));
    }
    if (partial.dangerous !== undefined) {
      fields.push('dangerous = ?');
      values.push(fromIntBool(partial.dangerous));
    }
    if (partial.implementation !== undefined) {
      fields.push('implementation = ?');
      values.push(partial.implementation);
    }
    if (partial.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(fromIntBool(partial.enabled));
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(nowIso());
    values.push(name);

    db.prepare(`UPDATE user_skills SET ${fields.join(', ')} WHERE name = ?`).run(...values);
    return this.findByName(name);
  }

  delete(name: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM user_skills WHERE name = ?').run(name);
    return result.changes > 0;
  }

  setEnabled(name: string, enabled: boolean): UserSkill | null {
    return this.update(name, { enabled });
  }

  toManifest(skill: UserSkill): SkillManifest {
    return {
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      category: skill.category,
      version: skill.version,
      author: skill.author,
      parameters: skill.parameters,
      requiresApproval: skill.requiresApproval,
      dangerous: skill.dangerous,
    };
  }

  /** Batch convert all stored skills to manifests (used at boot). */
  loadManifests(): { skill: UserSkill; manifest: SkillManifest }[] {
    return this.findAll().map((skill) => ({ skill, manifest: this.toManifest(skill) }));
  }

  /**
   * For tests / boot diagnostics — produce a plain object suitable for
   * logging.
   */
  describe(): { count: number; names: string[] } {
    const all = this.findAll();
    return { count: all.length, names: all.map((s) => s.name) };
  }
}

export const userSkills = new UserSkillRepository();

// Re-export helper for callers that want to build iso timestamps directly.
export { msToIso };
