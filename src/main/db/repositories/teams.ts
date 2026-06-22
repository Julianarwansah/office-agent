import { getDb } from '../index';
import { newId, nowIso, isoToMs } from '../helpers';
import type { Team, Agent } from '../../../shared/types';

interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  color: string | null;
  avatar: string | null;
  created_at: string;
}

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  system_prompt: string;
  provider_id: string;
  team_id: string | null;
  role: string;
  color: string | null;
  is_lead: number;
  temperature: number | null;
  max_tokens: number | null;
  created_at: string;
  updated_at: string;
}

export type TeamCreateInput = Omit<Team, 'id' | 'createdAt'>;
export type TeamUpdateInput = Partial<Omit<Team, 'id' | 'createdAt'>>;

export class TeamRepository {
  private mapRow(row: TeamRow): Team {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      instructions: row.instructions ?? undefined,
      color: row.color ?? undefined,
      avatar: row.avatar ?? undefined,
      createdAt: isoToMs(row.created_at),
    };
  }

  private mapAgentRow(row: AgentRow): Agent {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      avatar: row.avatar ?? undefined,
      systemPrompt: row.system_prompt,
      providerId: row.provider_id,
      teamId: row.team_id ?? undefined,
      role: (row.role as Agent['role']) ?? 'member',
      color: row.color ?? undefined,
      isLead: row.is_lead === 1,
      enabledSkills: [],
      temperature: row.temperature ?? undefined,
      maxTokens: row.max_tokens ?? undefined,
      createdAt: isoToMs(row.created_at),
      updatedAt: isoToMs(row.updated_at),
    };
  }

  create(input: TeamCreateInput): Team {
    const db = getDb();
    const id = newId();
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO teams (id, name, description, instructions, color, avatar, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name,
      input.description ?? null,
      input.instructions ?? null,
      input.color ?? null,
      input.avatar ?? null,
      createdAt
    );
    const created = this.findById(id);
    if (!created) throw new Error('TeamRepository.create: failed to read back inserted team');
    return created;
  }

  update(id: string, partial: TeamUpdateInput): Team | null {
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
    if (partial.instructions !== undefined) {
      fields.push('instructions = ?');
      values.push(partial.instructions ?? null);
    }
    if (partial.color !== undefined) {
      fields.push('color = ?');
      values.push(partial.color ?? null);
    }
    if (partial.avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(partial.avatar ?? null);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE teams SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM teams WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findById(id: string): Team | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM teams WHERE id = ?').get(id) as TeamRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  findAll(): Team[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM teams ORDER BY created_at ASC').all() as TeamRow[];
    return rows.map((r) => this.mapRow(r));
  }

  addAgent(teamId: string, agentId: string): void {
    const db = getDb();
    db.prepare('UPDATE agents SET team_id = ?, updated_at = ? WHERE id = ?').run(teamId, nowIso(), agentId);
  }

  removeAgent(teamId: string, agentId: string): void {
    const db = getDb();
    db.prepare('UPDATE agents SET team_id = NULL, updated_at = ? WHERE id = ? AND team_id = ?').run(
      nowIso(),
      agentId,
      teamId
    );
  }

  getAgents(teamId: string): Agent[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM agents WHERE team_id = ? ORDER BY is_lead DESC, name ASC')
      .all(teamId) as AgentRow[];
    return rows.map((r) => this.mapAgentRow(r));
  }

  findByAgentId(agentId: string): Team[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT t.* FROM teams t
         INNER JOIN agents a ON a.team_id = t.id
         WHERE a.id = ?`
      )
      .all(agentId) as TeamRow[];
    return rows.map((r) => this.mapRow(r));
  }
}

export const teams = new TeamRepository();
