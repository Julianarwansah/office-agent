import { getDb } from '../index';
import { newId, nowIso, parseJson, stringifyJson, toIntBool, fromIntBool, isoToMs } from '../helpers';
import type {
  Message,
  SenderType,
  LLMChatRole,
  LLMToolCall,
  MessageMetadata,
} from '../../../shared/types';

interface MessageRow {
  id: string;
  chatroom_id: string;
  sender_type: string;
  sender_id: string;
  content: string;
  role: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  parent_id: string | null;
  created_at: string;
  metadata: string | null;
  is_streaming: number;
}

export type MessageCreateInput = Omit<Message, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: number;
};
export type MessageUpdateInput = Partial<Omit<Message, 'id' | 'createdAt' | 'chatRoomId'>>;

export class MessageRepository {
  private mapRow(row: MessageRow): Message {
    return {
      id: row.id,
      chatRoomId: row.chatroom_id,
      senderType: row.sender_type as SenderType,
      senderId: row.sender_id,
      content: row.content,
      role: (row.role as LLMChatRole | undefined) ?? undefined,
      toolCalls: parseJson<LLMToolCall[]>(row.tool_calls),
      toolCallId: row.tool_call_id ?? undefined,
      parentId: row.parent_id ?? undefined,
      createdAt: isoToMs(row.created_at),
      isStreaming: toIntBool(row.is_streaming),
      metadata: parseJson<MessageMetadata>(row.metadata),
    };
  }

  create(input: MessageCreateInput): Message {
    const db = getDb();
    const id = input.id ?? newId();
    const createdAt = input.createdAt ? new Date(input.createdAt).toISOString() : nowIso();

    db.prepare(
      `INSERT INTO messages (
        id, chatroom_id, sender_type, sender_id, content, role, tool_calls, tool_call_id,
        parent_id, created_at, metadata, is_streaming
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.chatRoomId,
      input.senderType,
      input.senderId,
      input.content ?? '',
      input.role ?? null,
      input.toolCalls ? stringifyJson(input.toolCalls) : null,
      input.toolCallId ?? null,
      input.parentId ?? null,
      createdAt,
      input.metadata ? stringifyJson(input.metadata) : null,
      fromIntBool(input.isStreaming ?? false)
    );

    const created = this.findById(id);
    if (!created) throw new Error('MessageRepository.create: failed to read back inserted message');
    return created;
  }

  update(id: string, partial: MessageUpdateInput): Message | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (partial.senderType !== undefined) {
      fields.push('sender_type = ?');
      values.push(partial.senderType);
    }
    if (partial.senderId !== undefined) {
      fields.push('sender_id = ?');
      values.push(partial.senderId);
    }
    if (partial.content !== undefined) {
      fields.push('content = ?');
      values.push(partial.content);
    }
    if (partial.role !== undefined) {
      fields.push('role = ?');
      values.push(partial.role ?? null);
    }
    if (partial.toolCalls !== undefined) {
      fields.push('tool_calls = ?');
      values.push(partial.toolCalls ? stringifyJson(partial.toolCalls) : null);
    }
    if (partial.toolCallId !== undefined) {
      fields.push('tool_call_id = ?');
      values.push(partial.toolCallId ?? null);
    }
    if (partial.parentId !== undefined) {
      fields.push('parent_id = ?');
      values.push(partial.parentId ?? null);
    }
    if (partial.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(partial.metadata ? stringifyJson(partial.metadata) : null);
    }
    if (partial.isStreaming !== undefined) {
      fields.push('is_streaming = ?');
      values.push(fromIntBool(partial.isStreaming));
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findById(id: string): Message | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByChatRoom(chatRoomId: string, limit = 100, offset = 0): Message[] {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM messages WHERE chatroom_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?'
      )
      .all(chatRoomId, limit, offset) as MessageRow[];
    return rows.map((r) => this.mapRow(r));
  }

  findRecent(chatRoomId: string, n: number): Message[] {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM messages WHERE chatroom_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(chatRoomId, n) as MessageRow[];
    return rows.map((r) => this.mapRow(r)).reverse();
  }

  searchInChatRoom(chatRoomId: string, query: string): Message[] {
    const db = getDb();
    const like = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const rows = db
      .prepare(
        `SELECT * FROM messages
         WHERE chatroom_id = ? AND content LIKE ? ESCAPE '\\'
         ORDER BY created_at ASC`
      )
      .all(chatRoomId, like) as MessageRow[];
    return rows.map((r) => this.mapRow(r));
  }

  countByChatRoom(chatRoomId: string): number {
    const db = getDb();
    const row = db
      .prepare('SELECT COUNT(*) as c FROM messages WHERE chatroom_id = ?')
      .get(chatRoomId) as { c: number };
    return row.c;
  }

  deleteByChatRoom(chatRoomId: string): number {
    const db = getDb();
    const result = db.prepare('DELETE FROM messages WHERE chatroom_id = ?').run(chatRoomId);
    return result.changes;
  }

  markStreaming(id: string, isStreaming: boolean): void {
    const db = getDb();
    db.prepare('UPDATE messages SET is_streaming = ? WHERE id = ?').run(fromIntBool(isStreaming), id);
  }

  appendContent(id: string, delta: string): void {
    const db = getDb();
    db.prepare(
      `UPDATE messages
       SET content = COALESCE(content, '') || ?,
           is_streaming = 1
       WHERE id = ?`
    ).run(delta, id);
  }
}

export const messages = new MessageRepository();
