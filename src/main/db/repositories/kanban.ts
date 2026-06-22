import { getDb, withTransaction } from '../index';
import { newId, nowIso, isoToMs, parseJson, stringifyJson } from '../helpers';
import type {
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  KanbanTaskEvent,
  KanbanTaskEventType,
  KanbanTaskPriority,
  KanbanTaskStatus,
} from '../../../shared/types';

interface BoardRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  team_id: string | null;
  owner_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ColumnRow {
  id: string;
  board_id: string;
  name: string;
  position: number;
  status: string;
  wip_limit: number | null;
  created_at: string;
}

interface TaskRow {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_agent_id: string | null;
  creator_agent_id: string | null;
  due_date: string | null;
  position: number;
  parent_task_id: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface EventRow {
  id: string;
  task_id: string;
  board_id: string;
  event_type: string;
  from_column_id: string | null;
  to_column_id: string | null;
  agent_id: string | null;
  message: string | null;
  metadata: string | null;
  created_at: string;
}

const KANBAN_STATUSES: KanbanTaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const KANBAN_PRIORITIES: KanbanTaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const KANBAN_EVENT_TYPES: KanbanTaskEventType[] = [
  'created', 'moved', 'assigned', 'unassigned', 'updated',
  'completed', 'reopened', 'commented', 'deleted',
];

export const DEFAULT_KANBAN_COLUMNS: ReadonlyArray<{
  name: string;
  status: KanbanTaskStatus;
}> = [
  { name: 'Backlog', status: 'todo' },
  { name: 'To Do', status: 'todo' },
  { name: 'In Progress', status: 'in_progress' },
  { name: 'Review', status: 'review' },
  { name: 'Done', status: 'done' },
];

function clampStatus(v: string | null | undefined, fallback: KanbanTaskStatus = 'todo'): KanbanTaskStatus {
  return v && (KANBAN_STATUSES as string[]).includes(v) ? (v as KanbanTaskStatus) : fallback;
}

function clampPriority(v: string | null | undefined, fallback: KanbanTaskPriority = 'medium'): KanbanTaskPriority {
  return v && (KANBAN_PRIORITIES as string[]).includes(v) ? (v as KanbanTaskPriority) : fallback;
}

function clampEventType(v: string | null | undefined, fallback: KanbanTaskEventType = 'updated'): KanbanTaskEventType {
  return v && (KANBAN_EVENT_TYPES as string[]).includes(v) ? (v as KanbanTaskEventType) : fallback;
}

export type BoardCreateInput = Omit<KanbanBoard, 'id' | 'createdAt' | 'updatedAt'>;
export type BoardUpdateInput = Partial<Omit<KanbanBoard, 'id' | 'createdAt' | 'updatedAt'>>;

// `position` is required on the stored entity, but the create inputs below
// treat it as optional — the repository assigns a default (max + 1) when
// the caller omits it. This matches the long-standing insert behavior.
export type ColumnCreateInput = Omit<KanbanColumn, 'id' | 'createdAt' | 'boardId' | 'position'> & {
  position?: number;
};
export type ColumnUpdateInput = Partial<Omit<KanbanColumn, 'id' | 'createdAt' | 'boardId'>>;

export type TaskCreateInput = Omit<KanbanTask, 'id' | 'createdAt' | 'updatedAt' | 'position'> & {
  position?: number;
};
export type TaskUpdateInput = Partial<Omit<KanbanTask, 'id' | 'createdAt' | 'updatedAt' | 'boardId'>>;

export type EventCreateInput = Omit<KanbanTaskEvent, 'id' | 'createdAt'>;

export class KanbanRepository {
  /* ===================== Boards ===================== */

  private mapBoard(row: BoardRow): KanbanBoard {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      color: row.color ?? undefined,
      teamId: row.team_id ?? undefined,
      ownerAgentId: row.owner_agent_id ?? undefined,
      createdAt: isoToMs(row.created_at),
      updatedAt: isoToMs(row.updated_at),
    };
  }

  createBoard(input: BoardCreateInput, options?: { withDefaultColumns?: boolean }): KanbanBoard {
    const db = getDb();
    const id = newId();
    const now = nowIso();
    const withDefaults = options?.withDefaultColumns !== false;
    withTransaction(() => {
      db.prepare(
        `INSERT INTO kanban_boards (id, name, description, color, team_id, owner_agent_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.name,
        input.description ?? null,
        input.color ?? null,
        input.teamId ?? null,
        input.ownerAgentId ?? null,
        now,
        now,
      );
      if (withDefaults) {
        const insertCol = db.prepare(
          `INSERT INTO kanban_columns (id, board_id, name, position, status, wip_limit, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        DEFAULT_KANBAN_COLUMNS.forEach((c, idx) => {
          insertCol.run(newId(), id, c.name, idx, c.status, null, now);
        });
      }
    });
    const created = this.findBoardById(id);
    if (!created) throw new Error('KanbanRepository.createBoard: failed to read back inserted board');
    return created;
  }

  updateBoard(id: string, partial: BoardUpdateInput): KanbanBoard | null {
    const db = getDb();
    const existing = this.findBoardById(id);
    if (!existing) return null;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (partial.name !== undefined) { fields.push('name = ?'); values.push(partial.name); }
    if (partial.description !== undefined) { fields.push('description = ?'); values.push(partial.description ?? null); }
    if (partial.color !== undefined) { fields.push('color = ?'); values.push(partial.color ?? null); }
    if (partial.teamId !== undefined) { fields.push('team_id = ?'); values.push(partial.teamId ?? null); }
    if (partial.ownerAgentId !== undefined) { fields.push('owner_agent_id = ?'); values.push(partial.ownerAgentId ?? null); }
    if (fields.length === 0) return existing;
    fields.push('updated_at = ?');
    values.push(nowIso());
    values.push(id);
    db.prepare(`UPDATE kanban_boards SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findBoardById(id);
  }

  deleteBoard(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM kanban_boards WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findBoardById(id: string): KanbanBoard | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM kanban_boards WHERE id = ?').get(id) as BoardRow | undefined;
    return row ? this.mapBoard(row) : null;
  }

  listBoards(): KanbanBoard[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM kanban_boards ORDER BY updated_at DESC').all() as BoardRow[];
    return rows.map((r) => this.mapBoard(r));
  }

  /* ===================== Columns ===================== */

  private mapColumn(row: ColumnRow): KanbanColumn {
    return {
      id: row.id,
      boardId: row.board_id,
      name: row.name,
      position: row.position,
      status: clampStatus(row.status, 'todo'),
      wipLimit: row.wip_limit ?? undefined,
      createdAt: isoToMs(row.created_at),
    };
  }

  createColumn(input: ColumnCreateInput & { boardId: string }): KanbanColumn {
    const db = getDb();
    const id = newId();
    const now = nowIso();
    const max = db
      .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM kanban_columns WHERE board_id = ?')
      .get(input.boardId) as { m: number };
    const position = typeof input.position === 'number' ? input.position : max.m + 1;
    db.prepare(
      `INSERT INTO kanban_columns (id, board_id, name, position, status, wip_limit, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.boardId,
      input.name,
      position,
      input.status ?? 'todo',
      input.wipLimit ?? null,
      now,
    );
    this.touchBoard(input.boardId);
    const created = this.findColumnById(id);
    if (!created) throw new Error('KanbanRepository.createColumn: failed to read back inserted column');
    return created;
  }

  updateColumn(id: string, partial: ColumnUpdateInput): KanbanColumn | null {
    const db = getDb();
    const existing = this.findColumnById(id);
    if (!existing) return null;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (partial.name !== undefined) { fields.push('name = ?'); values.push(partial.name); }
    if (partial.position !== undefined) { fields.push('position = ?'); values.push(partial.position); }
    if (partial.status !== undefined) { fields.push('status = ?'); values.push(partial.status); }
    if (partial.wipLimit !== undefined) { fields.push('wip_limit = ?'); values.push(partial.wipLimit ?? null); }
    if (fields.length === 0) return existing;
    values.push(id);
    db.prepare(`UPDATE kanban_columns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    this.touchBoard(existing.boardId);
    return this.findColumnById(id);
  }

  deleteColumn(id: string): boolean {
    const db = getDb();
    const existing = this.findColumnById(id);
    if (!existing) return false;
    const result = db.prepare('DELETE FROM kanban_columns WHERE id = ?').run(id);
    if (result.changes > 0) this.touchBoard(existing.boardId);
    return result.changes > 0;
  }

  findColumnById(id: string): KanbanColumn | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM kanban_columns WHERE id = ?').get(id) as ColumnRow | undefined;
    return row ? this.mapColumn(row) : null;
  }

  listColumns(boardId: string): KanbanColumn[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM kanban_columns WHERE board_id = ? ORDER BY position ASC, created_at ASC')
      .all(boardId) as ColumnRow[];
    return rows.map((r) => this.mapColumn(r));
  }

  reorderColumns(boardId: string, orderedIds: string[]): KanbanColumn[] {
    const db = getDb();
    withTransaction(() => {
      const stmt = db.prepare('UPDATE kanban_columns SET position = ? WHERE id = ? AND board_id = ?');
      orderedIds.forEach((id, idx) => stmt.run(idx, id, boardId));
      this.touchBoard(boardId);
    });
    return this.listColumns(boardId);
  }

  /* ===================== Tasks ===================== */

  private mapTask(row: TaskRow): KanbanTask {
    const tags = parseJson<string[]>(row.tags);
    return {
      id: row.id,
      boardId: row.board_id,
      columnId: row.column_id,
      title: row.title,
      description: row.description ?? undefined,
      status: clampStatus(row.status, 'todo'),
      priority: clampPriority(row.priority, 'medium'),
      assigneeAgentId: row.assignee_agent_id ?? undefined,
      creatorAgentId: row.creator_agent_id ?? undefined,
      dueDate: row.due_date ? isoToMs(row.due_date) : undefined,
      position: row.position,
      parentTaskId: row.parent_task_id ?? undefined,
      tags: Array.isArray(tags) ? tags : undefined,
      createdAt: isoToMs(row.created_at),
      updatedAt: isoToMs(row.updated_at),
      completedAt: row.completed_at ? isoToMs(row.completed_at) : undefined,
    };
  }

  createTask(input: TaskCreateInput): KanbanTask {
    const db = getDb();
    const id = newId();
    const now = nowIso();
    const max = db
      .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM kanban_tasks WHERE column_id = ?')
      .get(input.columnId) as { m: number };
    const position = typeof input.position === 'number' ? input.position : max.m + 1;
    db.prepare(
      `INSERT INTO kanban_tasks (
        id, board_id, column_id, title, description, status, priority,
        assignee_agent_id, creator_agent_id, due_date, position,
        parent_task_id, tags, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.boardId,
      input.columnId,
      input.title,
      input.description ?? null,
      input.status ?? 'todo',
      input.priority ?? 'medium',
      input.assigneeAgentId ?? null,
      input.creatorAgentId ?? null,
      input.dueDate ? new Date(input.dueDate).toISOString() : null,
      position,
      input.parentTaskId ?? null,
      input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null,
      now,
      now,
      input.completedAt ? new Date(input.completedAt).toISOString() : null,
    );
    this.touchBoard(input.boardId);
    this.addEvent({
      taskId: id,
      boardId: input.boardId,
      eventType: 'created',
      toColumnId: input.columnId,
      agentId: input.creatorAgentId,
      message: `Task "${input.title}" created`,
      metadata: { priority: input.priority ?? 'medium' },
    });
    const created = this.findTaskById(id);
    if (!created) throw new Error('KanbanRepository.createTask: failed to read back inserted task');
    return created;
  }

  updateTask(id: string, partial: TaskUpdateInput): KanbanTask | null {
    const db = getDb();
    const existing = this.findTaskById(id);
    if (!existing) return null;
    const fields: string[] = [];
    const values: unknown[] = [];
    const changedFields: string[] = [];
    if (partial.title !== undefined && partial.title !== existing.title) {
      fields.push('title = ?'); values.push(partial.title); changedFields.push('title');
    }
    if (partial.description !== undefined && partial.description !== existing.description) {
      fields.push('description = ?'); values.push(partial.description ?? null); changedFields.push('description');
    }
    if (partial.priority !== undefined && partial.priority !== existing.priority) {
      fields.push('priority = ?'); values.push(partial.priority); changedFields.push('priority');
    }
    if (partial.assigneeAgentId !== undefined && partial.assigneeAgentId !== existing.assigneeAgentId) {
      fields.push('assignee_agent_id = ?'); values.push(partial.assigneeAgentId ?? null);
      changedFields.push('assignee');
    }
    if (partial.dueDate !== undefined) {
      const newIso = partial.dueDate ? new Date(partial.dueDate).toISOString() : null;
      fields.push('due_date = ?'); values.push(newIso); changedFields.push('due_date');
    }
    if (partial.parentTaskId !== undefined) {
      fields.push('parent_task_id = ?'); values.push(partial.parentTaskId ?? null); changedFields.push('parent');
    }
    if (partial.tags !== undefined) {
      fields.push('tags = ?'); values.push(partial.tags.length > 0 ? JSON.stringify(partial.tags) : null);
      changedFields.push('tags');
    }
    if (partial.status !== undefined && partial.status !== existing.status) {
      fields.push('status = ?'); values.push(partial.status); changedFields.push('status');
      if (partial.status === 'done') {
        fields.push('completed_at = ?'); values.push(nowIso());
      } else if (existing.status === 'done') {
        fields.push('completed_at = ?'); values.push(null);
      }
    }
    if (fields.length === 0) return existing;
    fields.push('updated_at = ?'); values.push(nowIso());
    values.push(id);
    db.prepare(`UPDATE kanban_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    this.touchBoard(existing.boardId);
    const eventType: KanbanTaskEventType =
      changedFields.includes('assignee') ? (partial.assigneeAgentId ? 'assigned' : 'unassigned')
      : changedFields.includes('status') ? (partial.status === 'done' ? 'completed' : 'updated')
      : 'updated';
    this.addEvent({
      taskId: id,
      boardId: existing.boardId,
      eventType,
      agentId: partial.assigneeAgentId,
      message: `Task updated (${changedFields.join(', ') || 'fields'})`,
      metadata: { fields: changedFields },
    });
    return this.findTaskById(id);
  }

  moveTask(id: string, toColumnId: string, toPosition?: number): KanbanTask | null {
    const db = getDb();
    const existing = this.findTaskById(id);
    if (!existing) return null;
    const targetCol = this.findColumnById(toColumnId);
    if (!targetCol || targetCol.boardId !== existing.boardId) {
      return null;
    }
    const fromColumnId = existing.columnId;
    const status = clampStatus(targetCol.status, existing.status);
    const max = db
      .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM kanban_tasks WHERE column_id = ? AND id != ?')
      .get(toColumnId, id) as { m: number };
    const position = typeof toPosition === 'number' ? toPosition : max.m + 1;
    db.prepare(
      `UPDATE kanban_tasks SET column_id = ?, position = ?, status = ?, updated_at = ?, completed_at = ?
       WHERE id = ?`
    ).run(
      toColumnId,
      position,
      status,
      nowIso(),
      status === 'done' ? nowIso() : (existing.status === 'done' ? null : (existing.completedAt ? new Date(existing.completedAt).toISOString() : null)),
      id,
    );
    this.touchBoard(existing.boardId);
    this.addEvent({
      taskId: id,
      boardId: existing.boardId,
      eventType: 'moved',
      fromColumnId,
      toColumnId,
      message: `Moved to "${targetCol.name}"`,
    });
    return this.findTaskById(id);
  }

  deleteTask(id: string): boolean {
    const db = getDb();
    const existing = this.findTaskById(id);
    if (!existing) return false;
    const result = db.prepare('DELETE FROM kanban_tasks WHERE id = ?').run(id);
    if (result.changes > 0) {
      this.touchBoard(existing.boardId);
      // Events for the task are removed automatically by ON DELETE CASCADE.
    }
    return result.changes > 0;
  }

  findTaskById(id: string): KanbanTask | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(id) as TaskRow | undefined;
    return row ? this.mapTask(row) : null;
  }

  listTasksByBoard(boardId: string): KanbanTask[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM kanban_tasks WHERE board_id = ? ORDER BY position ASC, created_at ASC')
      .all(boardId) as TaskRow[];
    return rows.map((r) => this.mapTask(r));
  }

  listTasksByColumn(columnId: string): KanbanTask[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM kanban_tasks WHERE column_id = ? ORDER BY position ASC, created_at ASC')
      .all(columnId) as TaskRow[];
    return rows.map((r) => this.mapTask(r));
  }

  listTasksByAssignee(agentId: string): KanbanTask[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM kanban_tasks WHERE assignee_agent_id = ? ORDER BY updated_at DESC')
      .all(agentId) as TaskRow[];
    return rows.map((r) => this.mapTask(r));
  }

  /* ===================== Events ===================== */

  private mapEvent(row: EventRow): KanbanTaskEvent {
    const metadata = parseJson<Record<string, unknown>>(row.metadata);
    return {
      id: row.id,
      taskId: row.task_id,
      boardId: row.board_id,
      eventType: clampEventType(row.event_type, 'updated'),
      fromColumnId: row.from_column_id ?? undefined,
      toColumnId: row.to_column_id ?? undefined,
      agentId: row.agent_id ?? undefined,
      message: row.message ?? undefined,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      createdAt: isoToMs(row.created_at),
    };
  }

  addEvent(input: EventCreateInput): KanbanTaskEvent {
    const db = getDb();
    const id = newId();
    const now = nowIso();
    db.prepare(
      `INSERT INTO kanban_task_events (
        id, task_id, board_id, event_type, from_column_id, to_column_id,
        agent_id, message, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.taskId,
      input.boardId,
      input.eventType,
      input.fromColumnId ?? null,
      input.toColumnId ?? null,
      input.agentId ?? null,
      input.message ?? null,
      input.metadata ? stringifyJson(input.metadata) : null,
      now,
    );
    return this.findEventById(id)!;
  }

  findEventById(id: string): KanbanTaskEvent | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM kanban_task_events WHERE id = ?').get(id) as EventRow | undefined;
    return row ? this.mapEvent(row) : null;
  }

  listEventsByTask(taskId: string): KanbanTaskEvent[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM kanban_task_events WHERE task_id = ? ORDER BY created_at ASC')
      .all(taskId) as EventRow[];
    return rows.map((r) => this.mapEvent(r));
  }

  listEventsByBoard(boardId: string, limit?: number): KanbanTaskEvent[] {
    const db = getDb();
    const safeLimit = typeof limit === 'number' && limit > 0 ? Math.min(limit, 500) : 200;
    const rows = db
      .prepare('SELECT * FROM kanban_task_events WHERE board_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(boardId, safeLimit) as EventRow[];
    return rows.map((r) => this.mapEvent(r));
  }

  /* ===================== Helpers ===================== */

  private touchBoard(boardId: string): void {
    const db = getDb();
    db.prepare('UPDATE kanban_boards SET updated_at = ? WHERE id = ?').run(nowIso(), boardId);
  }

  /** Cascade-counting aggregate used by the UI for headers. */
  countTasksByColumn(boardId: string): Record<string, number> {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT column_id AS columnId, COUNT(*) AS c
         FROM kanban_tasks WHERE board_id = ?
         GROUP BY column_id`
      )
      .all(boardId) as Array<{ columnId: string; c: number }>;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.columnId] = r.c;
    return out;
  }
}

export const kanban = new KanbanRepository();
