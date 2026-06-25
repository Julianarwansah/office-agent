import { getDb } from '../index';
import { newId, nowIso } from '../helpers';
import type { Notification, NotificationType } from '../../../shared/types';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  chatroom_id: string | null;
  agent_id: string | null;
  is_read: number;
  created_at: string;
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    chatroomId: row.chatroom_id ?? undefined,
    agentId: row.agent_id ?? undefined,
    isRead: row.is_read === 1,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export const notificationsRepo = {
  list(limit = 50): Notification[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?')
      .all(limit) as NotificationRow[];
    return rows.map(rowToNotification);
  },

  unreadCount(): number {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as { count: number };
    return row.count;
  },

  create(input: {
    type: NotificationType;
    title: string;
    message?: string;
    chatroomId?: string;
    agentId?: string;
  }): Notification {
    const db = getDb();
    const id = newId();
    const now = nowIso();
    db.prepare(
      'INSERT INTO notifications (id, type, title, message, chatroom_id, agent_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
    ).run(id, input.type, input.title, input.message ?? '', input.chatroomId ?? null, input.agentId ?? null, now);
    return {
      id,
      type: input.type,
      title: input.title,
      message: input.message ?? '',
      chatroomId: input.chatroomId,
      agentId: input.agentId,
      isRead: false,
      createdAt: new Date(now).getTime(),
    };
  },

  markRead(id: string): void {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  },

  markAllRead(): void {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  },

  clearAll(): void {
    const db = getDb();
    db.prepare('DELETE FROM notifications').run();
  },
};
