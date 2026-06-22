import { getDb, withTransaction } from '../index';
import { newId, nowIso, parseJson, toIntBool, fromIntBool, isoToMs } from '../helpers';
import type { Memory, MemoryType, MemoryCategory } from '../../../shared/types';

interface MemoryRow {
  id: string;
  agent_id: string;
  type: string;
  content: string;
  importance: number;
  category: string | null;
  created_at: string;
  last_accessed_at: string;
  access_count: number;
  is_pinned: number;
  source_message_id: string | null;
}

export type MemoryCreateInput = Omit<Memory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>;
export type MemoryUpdateInput = Partial<Omit<Memory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>>;

export interface MemoryQueryOptions {
  type?: MemoryType;
  category?: MemoryCategory;
  minImportance?: number;
  limit?: number;
  isPinned?: boolean;
  offset?: number;
}

export class MemoryRepository {
  private mapRow(row: MemoryRow): Memory {
    return {
      id: row.id,
      agentId: row.agent_id,
      type: (row.type as MemoryType) ?? 'long_term',
      content: row.content,
      importance: row.importance,
      category: (row.category as MemoryCategory | null) ?? 'context',
      createdAt: isoToMs(row.created_at),
      lastAccessedAt: isoToMs(row.last_accessed_at),
      accessCount: row.access_count,
      isPinned: toIntBool(row.is_pinned),
      sourceMessageId: row.source_message_id ?? undefined,
    };
  }

  create(input: MemoryCreateInput): Memory {
    const db = getDb();
    const id = newId();
    const now = nowIso();
    db.prepare(
      `INSERT INTO memories (
        id, agent_id, type, content, importance, category,
        created_at, last_accessed_at, access_count, is_pinned, source_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      id,
      input.agentId,
      input.type ?? 'long_term',
      input.content,
      input.importance ?? 0.5,
      input.category ?? 'context',
      now,
      now,
      fromIntBool(input.isPinned ?? false),
      input.sourceMessageId ?? null
    );
    const created = this.findById(id);
    if (!created) throw new Error('MemoryRepository.create: failed to read back inserted memory');
    return created;
  }

  update(id: string, partial: MemoryUpdateInput): Memory | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (partial.type !== undefined) {
      fields.push('type = ?');
      values.push(partial.type);
    }
    if (partial.content !== undefined) {
      fields.push('content = ?');
      values.push(partial.content);
    }
    if (partial.importance !== undefined) {
      fields.push('importance = ?');
      values.push(partial.importance);
    }
    if (partial.category !== undefined) {
      fields.push('category = ?');
      values.push(partial.category);
    }
    if (partial.isPinned !== undefined) {
      fields.push('is_pinned = ?');
      values.push(fromIntBool(partial.isPinned));
    }
    if (partial.sourceMessageId !== undefined) {
      fields.push('source_message_id = ?');
      values.push(partial.sourceMessageId ?? null);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  deleteByAgent(agentId: string): number {
    const db = getDb();
    const result = db.prepare('DELETE FROM memories WHERE agent_id = ?').run(agentId);
    return result.changes;
  }

  findById(id: string): Memory | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
    if (!row) return null;
    this.touchAccess(id);
    row.access_count += 1;
    row.last_accessed_at = nowIso();
    return this.mapRow(row);
  }

  findByAgent(agentId: string, options: MemoryQueryOptions = {}): Memory[] {
    const db = getDb();
    const wheres: string[] = ['agent_id = ?'];
    const params: unknown[] = [agentId];

    if (options.type !== undefined) {
      wheres.push('type = ?');
      params.push(options.type);
    }
    if (options.category !== undefined) {
      wheres.push('category = ?');
      params.push(options.category);
    }
    if (options.minImportance !== undefined) {
      wheres.push('importance >= ?');
      params.push(options.minImportance);
    }
    if (options.isPinned !== undefined) {
      wheres.push('is_pinned = ?');
      params.push(fromIntBool(options.isPinned));
    }

    let sql = `SELECT * FROM memories WHERE ${wheres.join(' AND ')} ORDER BY is_pinned DESC, importance DESC, created_at DESC`;
    if (options.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options.offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = db.prepare(sql).all(...params) as MemoryRow[];
    return rows.map((r) => this.mapRow(r));
  }

  search(agentId: string, query: string, limit = 20): Memory[] {
    const db = getDb();
    const like = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const rows = db
      .prepare(
        `SELECT *,
                (importance * 0.5 + (CASE WHEN LOWER(content) LIKE LOWER(?) ESCAPE '\\' THEN 0.5 ELSE 0 END)) AS score
         FROM memories
         WHERE agent_id = ?
         ORDER BY score DESC, importance DESC, created_at DESC
         LIMIT ?`
      )
      .all(like, agentId, limit) as Array<MemoryRow & { score: number }>;
    return rows.map((r) => this.mapRow(r));
  }

  getTopRelevant(agentId: string, query: string, k = 10, minImportance = 0.3): Memory[] {
    const db = getDb();
    const like = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const rows = db
      .prepare(
        `SELECT *,
                (importance * 0.5 + (CASE WHEN LOWER(content) LIKE LOWER(?) ESCAPE '\\' THEN 0.5 ELSE 0 END)) AS score
         FROM memories
         WHERE agent_id = ? AND importance >= ?
         ORDER BY score DESC, importance DESC, created_at DESC
         LIMIT ?`
      )
      .all(like, agentId, minImportance, k) as Array<MemoryRow & { score: number }>;
    return rows.map((r) => this.mapRow(r));
  }

  touchAccess(id: string): void {
    const db = getDb();
    db.prepare(
      'UPDATE memories SET last_accessed_at = ?, access_count = access_count + 1 WHERE id = ?'
    ).run(nowIso(), id);
  }

  findPinned(agentId: string): Memory[] {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM memories WHERE agent_id = ? AND is_pinned = 1 ORDER BY importance DESC, created_at DESC'
      )
      .all(agentId) as MemoryRow[];
    return rows.map((r) => this.mapRow(r));
  }

  count(agentId: string): number {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as c FROM memories WHERE agent_id = ?').get(agentId) as {
      c: number;
    };
    return row.c;
  }

  bulkCreate(memories: MemoryCreateInput[]): Memory[] {
    if (memories.length === 0) return [];
    const db = getDb();
    const now = nowIso();
    const created: Memory[] = [];

    withTransaction(() => {
      const insert = db.prepare(
        `INSERT INTO memories (
          id, agent_id, type, content, importance, category,
          created_at, last_accessed_at, access_count, is_pinned, source_message_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      );
      for (const input of memories) {
        const id = newId();
        insert.run(
          id,
          input.agentId,
          input.type ?? 'long_term',
          input.content,
          input.importance ?? 0.5,
          input.category ?? 'context',
          now,
          now,
          fromIntBool(input.isPinned ?? false),
          input.sourceMessageId ?? null
        );
        const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
        if (row) created.push(this.mapRow(row));
      }
    });

    return created;
  }
}

export const memories = new MemoryRepository();
