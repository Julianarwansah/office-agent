import { getDb } from '../index';
import { newId, nowIso, isoToMs } from '../helpers';
import type { ConversationSummary } from '../../../shared/types';

interface SummaryRow {
  id: string;
  agent_id: string;
  chatroom_id: string;
  summary: string;
  message_count: number;
  start_message_id: string | null;
  end_message_id: string | null;
  created_at: string;
}

export type SummaryCreateInput = Omit<ConversationSummary, 'id' | 'createdAt'>;
export type SummaryUpdateInput = Partial<Omit<ConversationSummary, 'id' | 'createdAt'>>;

export class ConversationSummaryRepository {
  private mapRow(row: SummaryRow): ConversationSummary {
    return {
      id: row.id,
      agentId: row.agent_id,
      chatRoomId: row.chatroom_id,
      summary: row.summary,
      messageCount: row.message_count,
      startMessageId: row.start_message_id ?? undefined,
      endMessageId: row.end_message_id ?? undefined,
      createdAt: isoToMs(row.created_at),
    };
  }

  create(input: SummaryCreateInput): ConversationSummary {
    const db = getDb();
    const id = newId();
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO conversation_summaries (
        id, agent_id, chatroom_id, summary, message_count,
        start_message_id, end_message_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.agentId,
      input.chatRoomId,
      input.summary,
      input.messageCount ?? 0,
      input.startMessageId ?? null,
      input.endMessageId ?? null,
      createdAt
    );
    const created = this.findById(id);
    if (!created) throw new Error('ConversationSummaryRepository.create: failed to read back inserted summary');
    return created;
  }

  update(id: string, partial: SummaryUpdateInput): ConversationSummary | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (partial.agentId !== undefined) {
      fields.push('agent_id = ?');
      values.push(partial.agentId);
    }
    if (partial.chatRoomId !== undefined) {
      fields.push('chatroom_id = ?');
      values.push(partial.chatRoomId);
    }
    if (partial.summary !== undefined) {
      fields.push('summary = ?');
      values.push(partial.summary);
    }
    if (partial.messageCount !== undefined) {
      fields.push('message_count = ?');
      values.push(partial.messageCount);
    }
    if (partial.startMessageId !== undefined) {
      fields.push('start_message_id = ?');
      values.push(partial.startMessageId ?? null);
    }
    if (partial.endMessageId !== undefined) {
      fields.push('end_message_id = ?');
      values.push(partial.endMessageId ?? null);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE conversation_summaries SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  findById(id: string): ConversationSummary | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM conversation_summaries WHERE id = ?')
      .get(id) as SummaryRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByAgent(agentId: string, limit = 50): ConversationSummary[] {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM conversation_summaries WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(agentId, limit) as SummaryRow[];
    return rows.map((r) => this.mapRow(r));
  }

  findByChatRoom(chatRoomId: string, limit = 50): ConversationSummary[] {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM conversation_summaries WHERE chatroom_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(chatRoomId, limit) as SummaryRow[];
    return rows.map((r) => this.mapRow(r));
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM conversation_summaries WHERE id = ?').run(id);
    return result.changes > 0;
  }

  deleteByChatRoom(chatRoomId: string): number {
    const db = getDb();
    const result = db.prepare('DELETE FROM conversation_summaries WHERE chatroom_id = ?').run(chatRoomId);
    return result.changes;
  }

  latestForAgent(agentId: string): ConversationSummary | null {
    const db = getDb();
    const row = db
      .prepare(
        'SELECT * FROM conversation_summaries WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(agentId) as SummaryRow | undefined;
    return row ? this.mapRow(row) : null;
  }
}

export const summaries = new ConversationSummaryRepository();
