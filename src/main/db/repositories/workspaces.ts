import { getDb } from '../index';
import { newId, nowIso, toIntBool, fromIntBool, isoToMs } from '../helpers';
import type { Workspace } from '../../../shared/types';

interface WorkspaceRow {
  id: string;
  name: string;
  path: string;
  is_default: number;
  created_at: string;
}

export type WorkspaceCreateInput = Omit<Workspace, 'id' | 'createdAt'>;
export type WorkspaceUpdateInput = Partial<Omit<Workspace, 'id' | 'createdAt'>>;

export class WorkspaceRepository {
  private mapRow(row: WorkspaceRow): Workspace {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      isDefault: toIntBool(row.is_default),
      createdAt: isoToMs(row.created_at),
    };
  }

  create(input: WorkspaceCreateInput): Workspace {
    const db = getDb();
    const id = newId();
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO workspaces (id, name, path, is_default, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, input.name, input.path, fromIntBool(input.isDefault ?? false), createdAt);
    const created = this.findById(id);
    if (!created) throw new Error('WorkspaceRepository.create: failed to read back inserted workspace');
    return created;
  }

  update(id: string, partial: WorkspaceUpdateInput): Workspace | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (partial.name !== undefined) {
      fields.push('name = ?');
      values.push(partial.name);
    }
    if (partial.path !== undefined) {
      fields.push('path = ?');
      values.push(partial.path);
    }
    if (partial.isDefault !== undefined) {
      fields.push('is_default = ?');
      values.push(fromIntBool(partial.isDefault));
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE workspaces SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findById(id: string): Workspace | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as WorkspaceRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  findAll(): Workspace[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM workspaces ORDER BY is_default DESC, name ASC')
      .all() as WorkspaceRow[];
    return rows.map((r) => this.mapRow(r));
  }

  setDefault(id: string): void {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return;
    db.prepare('UPDATE workspaces SET is_default = 0').run();
    db.prepare('UPDATE workspaces SET is_default = 1 WHERE id = ?').run(id);
  }

  getDefault(): Workspace | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM workspaces WHERE is_default = 1 LIMIT 1')
      .get() as WorkspaceRow | undefined;
    if (row) return this.mapRow(row);
    const fallback = db
      .prepare('SELECT * FROM workspaces ORDER BY created_at ASC LIMIT 1')
      .get() as WorkspaceRow | undefined;
    return fallback ? this.mapRow(fallback) : null;
  }

  findByPath(path: string): Workspace | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM workspaces WHERE path = ? LIMIT 1')
      .get(path) as WorkspaceRow | undefined;
    return row ? this.mapRow(row) : null;
  }
}

export const workspaces = new WorkspaceRepository();
