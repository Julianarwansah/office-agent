import { getDb, withTransaction } from '../index';
import { newId, nowIso, isoToMs } from '../helpers';
import type { ChatRoom, ChatRoomType } from '../../../shared/types';
import type { AgentRepository } from './agents';

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
  /**
   * Late-bound dependency on the agent repository. Used to resolve dynamic
   * membership for `type === 'global'` chatrooms (which implicitly contain
   * every agent). Set once at startup via `setAgentsRepository`.
   */
  private agentsRepo: AgentRepository | null = null;

  setAgentsRepository(repo: AgentRepository): void {
    this.agentsRepo = repo;
  }

  private isGlobal(row: ChatRoomRow): boolean {
    return (row.type ?? 'team') === 'global';
  }

  private resolveAgentIds(row: ChatRoomRow, persistedAgentIds: string[]): string[] {
    if (!this.isGlobal(row)) return persistedAgentIds;
    const repo = this.agentsRepo;
    if (!repo) return persistedAgentIds;
    return repo.findAll().map((a) => a.id).sort();
  }

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
    const isGlobal = (input.type ?? 'team') === 'global';
    // For global chatrooms, membership is dynamic (every agent) — we do not
    // store per-agent rows in the join table.
    const agentIds = isGlobal ? [] : (input.agentIds ?? []);

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

    // After all field changes, decide whether the post-update type is global.
    const nextType = partial.type ?? existing.type;
    const becomesGlobal = nextType === 'global';

    withTransaction(() => {
      if (fields.length > 0) {
        values.push(id);
        db.prepare(`UPDATE chatrooms SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      if (becomesGlobal) {
        // Global rooms have dynamic membership — clear any persisted rows.
        db.prepare('DELETE FROM chatroom_agents WHERE chatroom_id = ?').run(id);
      } else if (partial.agentIds !== undefined) {
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
    return this.mapRow(row, this.resolveAgentIds(row, this.loadAgentIds(id)));
  }

  findAll(): ChatRoom[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM chatrooms ORDER BY created_at DESC').all() as ChatRoomRow[];
    return rows.map((r) => this.mapRow(r, this.resolveAgentIds(r, this.loadAgentIds(r.id))));
  }

  addAgent(chatRoomId: string, agentId: string): boolean {
    const db = getDb();
    const row = db.prepare('SELECT type FROM chatrooms WHERE id = ?').get(chatRoomId) as { type: string } | undefined;
    if (!row) return false;
    if ((row.type ?? 'team') === 'global') {
      // Membership is dynamic — nothing to persist.
      return false;
    }
    db.prepare('INSERT OR IGNORE INTO chatroom_agents (chatroom_id, agent_id) VALUES (?, ?)').run(
      chatRoomId,
      agentId
    );
    return true;
  }

  removeAgent(chatRoomId: string, agentId: string): boolean {
    const db = getDb();
    const row = db.prepare('SELECT type FROM chatrooms WHERE id = ?').get(chatRoomId) as { type: string } | undefined;
    if (!row) return false;
    if ((row.type ?? 'team') === 'global') {
      return false;
    }
    const result = db.prepare(
      'DELETE FROM chatroom_agents WHERE chatroom_id = ? AND agent_id = ?'
    ).run(chatRoomId, agentId);
    return result.changes > 0;
  }

  getAgents(chatRoomId: string): string[] {
    const db = getDb();
    const row = db.prepare('SELECT type FROM chatrooms WHERE id = ?').get(chatRoomId) as { type: string } | undefined;
    if (!row) return [];
    return this.resolveAgentIds(
      { id: chatRoomId, name: '', description: null, team_id: null, type: row.type, created_at: '' },
      this.loadAgentIds(chatRoomId),
    );
  }

  setAgents(chatRoomId: string, agentIds: string[]): boolean {
    const db = getDb();
    const row = db.prepare('SELECT type FROM chatrooms WHERE id = ?').get(chatRoomId) as { type: string } | undefined;
    if (!row) return false;
    if ((row.type ?? 'team') === 'global') {
      return false;
    }
    withTransaction(() => {
      db.prepare('DELETE FROM chatroom_agents WHERE chatroom_id = ?').run(chatRoomId);
      const insert = db.prepare(
        'INSERT OR IGNORE INTO chatroom_agents (chatroom_id, agent_id) VALUES (?, ?)'
      );
      for (const agentId of agentIds) {
        insert.run(chatRoomId, agentId);
      }
    });
    return true;
  }

  findByTeam(teamId: string): ChatRoom[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM chatrooms WHERE team_id = ? ORDER BY created_at DESC')
      .all(teamId) as ChatRoomRow[];
    return rows.map((r) => this.mapRow(r, this.resolveAgentIds(r, this.loadAgentIds(r.id))));
  }
}

export const chatrooms = new ChatRoomRepository();
