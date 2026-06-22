import { getDb, withTransaction } from '../index';
import { newId, nowIso, isoToMs } from '../helpers';
import type { ChatRoom, ChatRoomType } from '../../../shared/types';

interface ChatRoomRow {
  id: string;
  name: string;
  description: string | null;
  team_id: string | null;
  type: string;
  created_at: string;
}

export type ChatRoomCreateInput = Omit<ChatRoom, 'id' | 'createdAt' | 'agentIds'> & {
  agentIds?: string[];
};
export type ChatRoomUpdateInput = Partial<Omit<ChatRoom, 'id' | 'createdAt'>>;

export class ChatRoomRepository {
  private mapRow(row: ChatRoomRow, agentIds: string[]): ChatRoom {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      teamId: row.team_id ?? undefined,
      type: (row.type as ChatRoomType) ?? 'team',
      agentIds,
      createdAt: isoToMs(row.created_at),
    };
  }

  private loadAgentIds(chatRoomId: string): string[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT agent_id FROM chatroom_agents WHERE chatroom_id = ? ORDER BY agent_id ASC')
      .all(chatRoomId) as Array<{ agent_id: string }>;
    return rows.map((r) => r.agent_id);
  }

  create(input: ChatRoomCreateInput): ChatRoom {
    const db = getDb();
    const id = newId();
    const createdAt = nowIso();
    const agentIds = input.agentIds ?? [];

    withTransaction(() => {
      db.prepare(
        `INSERT INTO chatrooms (id, name, description, team_id, type, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.name,
        input.description ?? null,
        input.teamId ?? null,
        input.type ?? 'team',
        createdAt
      );

      if (agentIds.length > 0) {
        const insert = db.prepare(
          'INSERT OR IGNORE INTO chatroom_agents (chatroom_id, agent_id) VALUES (?, ?)'
        );
        for (const agentId of agentIds) {
          insert.run(id, agentId);
        }
      }
    });

    const created = this.findById(id);
    if (!created) throw new Error('ChatRoomRepository.create: failed to read back inserted chatroom');
    return created;
  }

  update(id: string, partial: ChatRoomUpdateInput): ChatRoom | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (partial.name !== undefined) {
      fields.push('name = ?');
      values.push(partial.name);
    }
    if (partial.description !== undefined) {
      fields.push('description = ?');
      values.push(partial.description ?? null);
    }
    if (partial.teamId !== undefined) {
      fields.push('team_id = ?');
      values.push(partial.teamId ?? null);
    }
    if (partial.type !== undefined) {
      fields.push('type = ?');
      values.push(partial.type);
    }

    withTransaction(() => {
      if (fields.length > 0) {
        values.push(id);
        db.prepare(`UPDATE chatrooms SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      if (partial.agentIds !== undefined) {
        this.setAgents(id, partial.agentIds);
      }
    });

    return this.findById(id);
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM chatrooms WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findById(id: string): ChatRoom | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM chatrooms WHERE id = ?').get(id) as ChatRoomRow | undefined;
    if (!row) return null;
    return this.mapRow(row, this.loadAgentIds(id));
  }

  findAll(): ChatRoom[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM chatrooms ORDER BY created_at DESC').all() as ChatRoomRow[];
    return rows.map((r) => this.mapRow(r, this.loadAgentIds(r.id)));
  }

  addAgent(chatRoomId: string, agentId: string): void {
    const db = getDb();
    db.prepare('INSERT OR IGNORE INTO chatroom_agents (chatroom_id, agent_id) VALUES (?, ?)').run(
      chatRoomId,
      agentId
    );
  }

  removeAgent(chatRoomId: string, agentId: string): void {
    const db = getDb();
    db.prepare('DELETE FROM chatroom_agents WHERE chatroom_id = ? AND agent_id = ?').run(chatRoomId, agentId);
  }

  getAgents(chatRoomId: string): string[] {
    return this.loadAgentIds(chatRoomId);
  }

  setAgents(chatRoomId: string, agentIds: string[]): void {
    const db = getDb();
    withTransaction(() => {
      db.prepare('DELETE FROM chatroom_agents WHERE chatroom_id = ?').run(chatRoomId);
      const insert = db.prepare(
        'INSERT OR IGNORE INTO chatroom_agents (chatroom_id, agent_id) VALUES (?, ?)'
      );
      for (const agentId of agentIds) {
        insert.run(chatRoomId, agentId);
      }
    });
  }

  findByTeam(teamId: string): ChatRoom[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM chatrooms WHERE team_id = ? ORDER BY created_at DESC')
      .all(teamId) as ChatRoomRow[];
    return rows.map((r) => this.mapRow(r, this.loadAgentIds(r.id)));
  }
}

export const chatrooms = new ChatRoomRepository();
