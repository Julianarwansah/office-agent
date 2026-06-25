import { getDb } from '../index';
import { newId, nowIso, isoToMs } from '../helpers';
import type { ToolExecution, ToolExecutionStatus } from '../../../shared/types';

interface ToolExecRow {
  id: string;
  message_id: string;
  tool_name: string;
  arguments: string | null;
  result: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

export type ToolExecutionCreateInput = Omit<ToolExecution, 'id' | 'startedAt'> & {
  startedAt?: number;
};
export type ToolExecutionUpdateInput = Partial<Omit<ToolExecution, 'id' | 'startedAt'>>;

export class ToolExecutionRepository {
  private mapRow(row: ToolExecRow): ToolExecution {
    return {
      id: row.id,
      messageId: row.message_id,
      toolName: row.tool_name,
      arguments: row.arguments ?? '',
      result: row.result ?? undefined,
      status: (row.status as ToolExecutionStatus) ?? 'pending',
      startedAt: isoToMs(row.started_at),
      completedAt: row.completed_at ? isoToMs(row.completed_at) : undefined,
      error: row.error ?? undefined,
    };
  }

  create(input: ToolExecutionCreateInput): ToolExecution {
    const db = getDb();
    const id = newId();
    const startedAt = input.startedAt ? new Date(input.startedAt).toISOString() : nowIso();
    db.prepare(
      `INSERT INTO tool_executions (
        id, message_id, tool_name, arguments, result, status, started_at, completed_at, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.messageId,
      input.toolName,
      input.arguments ?? null,
      input.result ?? null,
      input.status ?? 'pending',
      startedAt,
      input.completedAt ? new Date(input.completedAt).toISOString() : null,
      input.error ?? null
    );
    const created = this.findById(id);
    if (!created) throw new Error('ToolExecutionRepository.create: failed to read back inserted execution');
    return created;
  }

  update(id: string, partial: ToolExecutionUpdateInput): ToolExecution | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (partial.messageId !== undefined) {
      fields.push('message_id = ?');
      values.push(partial.messageId);
    }
    if (partial.toolName !== undefined) {
      fields.push('tool_name = ?');
      values.push(partial.toolName);
    }
    if (partial.arguments !== undefined) {
      fields.push('arguments = ?');
      values.push(partial.arguments ?? null);
    }
    if (partial.result !== undefined) {
      fields.push('result = ?');
      values.push(partial.result ?? null);
    }
    if (partial.status !== undefined) {
      fields.push('status = ?');
      values.push(partial.status);
    }
    if (partial.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(partial.completedAt ? new Date(partial.completedAt).toISOString() : null);
    }
    if (partial.error !== undefined) {
      fields.push('error = ?');
      values.push(partial.error ?? null);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE tool_executions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  findById(id: string): ToolExecution | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM tool_executions WHERE id = ?')
      .get(id) as ToolExecRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByMessage(messageId: string): ToolExecution[] {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM tool_executions WHERE message_id = ? ORDER BY started_at ASC'
      )
      .all(messageId) as ToolExecRow[];
    return rows.map((r) => this.mapRow(r));
  }

  findByChatRoom(chatRoomId: string): ToolExecution[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT te.* FROM tool_executions te
         INNER JOIN messages m ON m.id = te.message_id
         WHERE m.chatroom_id = ?
         ORDER BY te.started_at ASC`
      )
      .all(chatRoomId) as ToolExecRow[];
    return rows.map((r) => this.mapRow(r));
  }

  markRunning(id: string): void {
    const db = getDb();
    db.prepare(
      "UPDATE tool_executions SET status = 'running' WHERE id = ?"
    ).run(id);
  }

  markSuccess(id: string, result: string): void {
    const db = getDb();
    db.prepare(
      `UPDATE tool_executions
       SET status = 'success', result = ?, completed_at = ?, error = NULL
       WHERE id = ?`
    ).run(result, nowIso(), id);
  }

  markError(id: string, error: string): void {
    const db = getDb();
    db.prepare(
      `UPDATE tool_executions
       SET status = 'error', error = ?, completed_at = ?
       WHERE id = ?`
    ).run(error, nowIso(), id);
  }

  countByChatRoom(chatRoomId: string): number {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT COUNT(*) as c FROM tool_executions te
         INNER JOIN messages m ON m.id = te.message_id
         WHERE m.chatroom_id = ?`
      )
      .get(chatRoomId) as { c: number };
    return row.c;
  }

  countByAgent(agentId: string, since?: number): number {
    const db = getDb();
    let sql = `SELECT COUNT(*) as c FROM tool_executions te
               INNER JOIN messages m ON m.id = te.message_id
               WHERE m.sender_id = ? AND m.sender_type = 'agent'`;
    const params: unknown[] = [agentId];
    if (since) {
      sql += ' AND te.started_at >= ?';
      params.push(new Date(since).toISOString());
    }
    const row = db.prepare(sql).get(...params) as { c: number };
    return row.c;
  }

  getSuccessRateByAgent(agentId: string, since?: number): { total: number; success: number; rate: number } {
    const db = getDb();
    let sql = `SELECT
                 COUNT(*) as total,
                 SUM(CASE WHEN te.status = 'success' THEN 1 ELSE 0 END) as success
               FROM tool_executions te
               INNER JOIN messages m ON m.id = te.message_id
               WHERE m.sender_id = ? AND m.sender_type = 'agent'`;
    const params: unknown[] = [agentId];
    if (since) {
      sql += ' AND te.started_at >= ?';
      params.push(new Date(since).toISOString());
    }
    const row = db.prepare(sql).get(...params) as { total: number; success: number };
    const rate = row.total > 0 ? (row.success / row.total) * 100 : 0;
    return { total: row.total, success: row.success, rate: Math.round(rate) };
  }

  getMostUsedSkills(agentId: string, limit = 10, since?: number): Array<{ skillName: string; count: number }> {
    const db = getDb();
    let sql = `SELECT te.tool_name as skill_name, COUNT(*) as count
               FROM tool_executions te
               INNER JOIN messages m ON m.id = te.message_id
               WHERE m.sender_id = ? AND m.sender_type = 'agent'`;
    const params: unknown[] = [agentId];
    if (since) {
      sql += ' AND te.started_at >= ?';
      params.push(new Date(since).toISOString());
    }
    sql += ` GROUP BY te.tool_name
             ORDER BY count DESC
             LIMIT ?`;
    params.push(limit);
    const rows = db.prepare(sql).all(...params) as Array<{ skill_name: string; count: number }>;
    return rows.map((r) => ({ skillName: r.skill_name, count: r.count }));
  }
}

export const toolExecutions = new ToolExecutionRepository();
