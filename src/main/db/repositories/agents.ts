import { getDb, withTransaction } from '../index';
import { newId, nowIso, parseJson, fromIntBool, toIntBool, isoToMs } from '../helpers';
import type { Agent, AgentRole, AgentSkill, SkillParameterValue } from '../../../shared/types';

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

interface AgentSkillRow {
  agent_id: string;
  skill_name: string;
  enabled: number;
  config: string | null;
}

export type AgentCreateInput = Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'enabledSkills'> & {
  enabledSkills?: AgentSkill[];
};
export type AgentUpdateInput = Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'enabledSkills'>> & {
  enabledSkills?: AgentSkill[];
};

export class AgentRepository {
  private mapRow(row: AgentRow, skills: AgentSkill[]): Agent {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      avatar: row.avatar ?? undefined,
      systemPrompt: row.system_prompt,
      providerId: row.provider_id,
      teamId: row.team_id ?? undefined,
      role: (row.role as AgentRole) ?? 'member',
      color: row.color ?? undefined,
      isLead: toIntBool(row.is_lead),
      enabledSkills: skills,
      temperature: row.temperature ?? undefined,
      maxTokens: row.max_tokens ?? undefined,
      createdAt: isoToMs(row.created_at),
      updatedAt: isoToMs(row.updated_at),
    };
  }

  private loadSkills(agentId: string): AgentSkill[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM agent_skills WHERE agent_id = ? ORDER BY skill_name ASC')
      .all(agentId) as AgentSkillRow[];
    return rows.map((r) => {
      const config = parseJson<SkillParameterValue>(r.config);
      return {
        name: r.skill_name,
        enabled: toIntBool(r.enabled),
        config: config && Object.keys(config).length > 0 ? config : undefined,
      };
    });
  }

  create(input: AgentCreateInput): Agent {
    const db = getDb();
    const id = newId();
    const now = nowIso();
    const skills = input.enabledSkills ?? [];

    withTransaction(() => {
      db.prepare(
        `INSERT INTO agents (
          id, name, description, avatar, system_prompt, provider_id, team_id,
          role, color, is_lead, temperature, max_tokens, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.name,
        input.description ?? null,
        input.avatar ?? null,
        input.systemPrompt ?? '',
        input.providerId,
        input.teamId ?? null,
        input.role ?? 'member',
        input.color ?? null,
        fromIntBool(input.isLead ?? false),
        input.temperature ?? null,
        input.maxTokens ?? null,
        now,
        now
      );

      const insertSkill = db.prepare(
        'INSERT INTO agent_skills (agent_id, skill_name, enabled, config) VALUES (?, ?, ?, ?)'
      );
      for (const skill of skills) {
        insertSkill.run(
          id,
          skill.name,
          fromIntBool(skill.enabled),
          skill.config ? JSON.stringify(skill.config) : null
        );
      }
    });

    const created = this.findById(id);
    if (!created) throw new Error('AgentRepository.create: failed to read back inserted agent');
    return created;
  }

  update(id: string, partial: AgentUpdateInput): Agent | null {
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
    if (partial.avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(partial.avatar ?? null);
    }
    if (partial.systemPrompt !== undefined) {
      fields.push('system_prompt = ?');
      values.push(partial.systemPrompt);
    }
    if (partial.providerId !== undefined) {
      fields.push('provider_id = ?');
      values.push(partial.providerId);
    }
    if (partial.teamId !== undefined) {
      fields.push('team_id = ?');
      values.push(partial.teamId ?? null);
    }
    if (partial.role !== undefined) {
      fields.push('role = ?');
      values.push(partial.role);
    }
    if (partial.color !== undefined) {
      fields.push('color = ?');
      values.push(partial.color ?? null);
    }
    if (partial.isLead !== undefined) {
      fields.push('is_lead = ?');
      values.push(fromIntBool(partial.isLead));
    }
    if (partial.temperature !== undefined) {
      fields.push('temperature = ?');
      values.push(partial.temperature ?? null);
    }
    if (partial.maxTokens !== undefined) {
      fields.push('max_tokens = ?');
      values.push(partial.maxTokens ?? null);
    }

    withTransaction(() => {
      if (fields.length > 0) {
        fields.push('updated_at = ?');
        values.push(nowIso());
        values.push(id);
        db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      if (partial.enabledSkills !== undefined) {
        this.setSkills(id, partial.enabledSkills);
      }
    });

    return this.findById(id);
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findById(id: string): Agent | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
    if (!row) return null;
    return this.mapRow(row, this.loadSkills(id));
  }

  findAll(): Agent[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM agents ORDER BY is_lead DESC, name ASC').all() as AgentRow[];
    return rows.map((r) => this.mapRow(r, this.loadSkills(r.id)));
  }

  findByTeam(teamId: string | null): Agent[] {
    const db = getDb();
    if (teamId === null) {
      const rows = db
        .prepare('SELECT * FROM agents WHERE team_id IS NULL ORDER BY name ASC')
        .all() as AgentRow[];
      return rows.map((r) => this.mapRow(r, this.loadSkills(r.id)));
    }
    const rows = db
      .prepare('SELECT * FROM agents WHERE team_id = ? ORDER BY is_lead DESC, name ASC')
      .all(teamId) as AgentRow[];
    return rows.map((r) => this.mapRow(r, this.loadSkills(r.id)));
  }

  setSkills(agentId: string, skills: AgentSkill[]): void {
    const db = getDb();
    withTransaction(() => {
      db.prepare('DELETE FROM agent_skills WHERE agent_id = ?').run(agentId);
      const insert = db.prepare(
        'INSERT INTO agent_skills (agent_id, skill_name, enabled, config) VALUES (?, ?, ?, ?)'
      );
      for (const skill of skills) {
        insert.run(
          agentId,
          skill.name,
          fromIntBool(skill.enabled),
          skill.config ? JSON.stringify(skill.config) : null
        );
      }
      db.prepare('UPDATE agents SET updated_at = ? WHERE id = ?').run(nowIso(), agentId);
    });
  }

  getSkills(agentId: string): AgentSkill[] {
    return this.loadSkills(agentId);
  }

  search(query: string): Agent[] {
    const db = getDb();
    const like = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const rows = db
      .prepare(
        `SELECT * FROM agents
         WHERE name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'
         ORDER BY name ASC`
      )
      .all(like, like) as AgentRow[];
    return rows.map((r) => this.mapRow(r, this.loadSkills(r.id)));
  }

  countByTeam(teamId: string): number {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as c FROM agents WHERE team_id = ?').get(teamId) as { c: number };
    return row.c;
  }
}

export const agents = new AgentRepository();
