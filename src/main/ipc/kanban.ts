/**
 * IPC handlers for Kanban boards, columns, tasks, and events.
 *
 * The Kanban UI lets agents (via the orchestrator) or humans assign work,
 * move tasks across columns, and watch a per-task timeline of events. The
 * renderer talks to these endpoints; agents talk to the same data via the
 * `kanban_ops` built-in skill.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type {
  ApiResponse,
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  KanbanTaskEvent,
  KanbanTaskEventType,
  KanbanTaskPriority,
  KanbanTaskStatus,
} from '../../shared/types';
import type {
  BoardUpdateInput,
  ColumnUpdateInput,
  KanbanRepository,
  TaskUpdateInput,
} from '../db/repositories';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:kanban');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export interface KanbanHandlerDeps {
  kanban: KanbanRepository;
}

const STATUS_VALUES: KanbanTaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const PRIORITY_VALUES: KanbanTaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const EVENT_VALUES: KanbanTaskEventType[] = [
  'created', 'moved', 'assigned', 'unassigned', 'updated',
  'completed', 'reopened', 'commented', 'deleted',
];

export function registerKanbanHandlers(deps: KanbanHandlerDeps): void {
  const { kanban: repo } = deps;

  /* -------------------- Boards -------------------- */

  ipcMain.handle(IPC_CHANNELS.KANBAN.LIST_BOARDS, async (): Promise<ApiResponse<KanbanBoard[]>> => {
    try { return ok(repo.listBoards()); }
    catch (err) { return failErr('KANBAN.LIST_BOARDS', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.GET_BOARD, async (_evt, id: string): Promise<ApiResponse<KanbanBoard | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.findBoardById(id));
    } catch (err) { return failErr('KANBAN.GET_BOARD', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.CREATE_BOARD, async (
    _evt,
    input: { name: string; description?: string; color?: string; teamId?: string; ownerAgentId?: string; withDefaultColumns?: boolean },
  ): Promise<ApiResponse<KanbanBoard>> => {
    try {
      if (!input?.name || typeof input.name !== 'string') return fail('name is required');
      const created = repo.createBoard({
        name: String(input.name).trim(),
        description: input.description?.trim() || undefined,
        color: input.color || undefined,
        teamId: input.teamId || undefined,
        ownerAgentId: input.ownerAgentId || undefined,
      }, { withDefaultColumns: input.withDefaultColumns !== false });
      return ok(created);
    } catch (err) { return failErr('KANBAN.CREATE_BOARD', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.UPDATE_BOARD, async (
    _evt,
    id: string,
    partial: Partial<KanbanBoard>,
  ): Promise<ApiResponse<KanbanBoard | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.updateBoard(id, sanitizeBoardInput(partial)));
    } catch (err) { return failErr('KANBAN.UPDATE_BOARD', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.DELETE_BOARD, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.deleteBoard(id));
    } catch (err) { return failErr('KANBAN.DELETE_BOARD', err); }
  });

  /* -------------------- Columns -------------------- */

  ipcMain.handle(IPC_CHANNELS.KANBAN.LIST_COLUMNS, async (
    _evt,
    boardId: string,
  ): Promise<ApiResponse<KanbanColumn[]>> => {
    try {
      if (!boardId || typeof boardId !== 'string') return fail('boardId is required');
      return ok(repo.listColumns(boardId));
    } catch (err) { return failErr('KANBAN.LIST_COLUMNS', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.CREATE_COLUMN, async (
    _evt,
    input: { boardId: string; name: string; status?: KanbanTaskStatus; position?: number; wipLimit?: number },
  ): Promise<ApiResponse<KanbanColumn>> => {
    try {
      if (!input?.boardId) return fail('boardId is required');
      if (!input.name || typeof input.name !== 'string') return fail('name is required');
      const status = clampStatus(input.status, 'todo');
      const createInput: Parameters<typeof repo.createColumn>[0] = {
        boardId: input.boardId,
        name: String(input.name).trim(),
        status,
      };
      if (typeof input.position === 'number') createInput.position = input.position;
      if (typeof input.wipLimit === 'number') createInput.wipLimit = input.wipLimit;
      const created = repo.createColumn(createInput);
      return ok(created);
    } catch (err) { return failErr('KANBAN.CREATE_COLUMN', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.UPDATE_COLUMN, async (
    _evt,
    id: string,
    partial: Partial<KanbanColumn>,
  ): Promise<ApiResponse<KanbanColumn | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      const update = sanitizeColumnInput(partial);
      return ok(repo.updateColumn(id, update));
    } catch (err) { return failErr('KANBAN.UPDATE_COLUMN', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.DELETE_COLUMN, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.deleteColumn(id));
    } catch (err) { return failErr('KANBAN.DELETE_COLUMN', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.REORDER_COLUMNS, async (
    _evt,
    input: { boardId: string; orderedIds: string[] },
  ): Promise<ApiResponse<KanbanColumn[]>> => {
    try {
      if (!input?.boardId || !Array.isArray(input.orderedIds)) {
        return fail('boardId and orderedIds[] are required');
      }
      return ok(repo.reorderColumns(input.boardId, input.orderedIds.map((id) => String(id))));
    } catch (err) { return failErr('KANBAN.REORDER_COLUMNS', err); }
  });

  /* -------------------- Tasks -------------------- */

  ipcMain.handle(IPC_CHANNELS.KANBAN.LIST_TASKS, async (
    _evt,
    args: { boardId?: string; columnId?: string; assigneeAgentId?: string },
  ): Promise<ApiResponse<KanbanTask[]>> => {
    try {
      if (!args || typeof args !== 'object') return fail('args is required');
      if (args.columnId) return ok(repo.listTasksByColumn(args.columnId));
      if (args.assigneeAgentId) return ok(repo.listTasksByAssignee(args.assigneeAgentId));
      if (args.boardId) return ok(repo.listTasksByBoard(args.boardId));
      return fail('One of boardId, columnId, or assigneeAgentId is required');
    } catch (err) { return failErr('KANBAN.LIST_TASKS', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.GET_TASK, async (_evt, id: string): Promise<ApiResponse<KanbanTask | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.findTaskById(id));
    } catch (err) { return failErr('KANBAN.GET_TASK', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.CREATE_TASK, async (
    _evt,
    input: Partial<KanbanTask> & { title: string; boardId: string; columnId: string },
  ): Promise<ApiResponse<KanbanTask>> => {
    try {
      if (!input?.boardId || !input?.columnId) return fail('boardId and columnId are required');
      if (!input.title || typeof input.title !== 'string') return fail('title is required');
      const created = repo.createTask({
        boardId: input.boardId,
        columnId: input.columnId,
        title: String(input.title).trim(),
        description: input.description ?? undefined,
        status: clampStatus(input.status, 'todo'),
        priority: clampPriority(input.priority, 'medium'),
        assigneeAgentId: input.assigneeAgentId || undefined,
        creatorAgentId: input.creatorAgentId || undefined,
        dueDate: typeof input.dueDate === 'number' ? input.dueDate : undefined,
        parentTaskId: input.parentTaskId || undefined,
        tags: Array.isArray(input.tags) ? input.tags.filter((t) => typeof t === 'string') : undefined,
        position: typeof input.position === 'number' ? input.position : undefined,
      });
      return ok(created);
    } catch (err) { return failErr('KANBAN.CREATE_TASK', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.UPDATE_TASK, async (
    _evt,
    id: string,
    partial: Partial<KanbanTask>,
  ): Promise<ApiResponse<KanbanTask | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.updateTask(id, sanitizeTaskInput(partial)));
    } catch (err) { return failErr('KANBAN.UPDATE_TASK', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.MOVE_TASK, async (
    _evt,
    args: { taskId: string; toColumnId: string; toPosition?: number },
  ): Promise<ApiResponse<KanbanTask | null>> => {
    try {
      if (!args?.taskId || !args?.toColumnId) return fail('taskId and toColumnId are required');
      return ok(repo.moveTask(args.taskId, args.toColumnId, args.toPosition));
    } catch (err) { return failErr('KANBAN.MOVE_TASK', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.DELETE_TASK, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.deleteTask(id));
    } catch (err) { return failErr('KANBAN.DELETE_TASK', err); }
  });

  /* -------------------- Events -------------------- */

  ipcMain.handle(IPC_CHANNELS.KANBAN.LIST_EVENTS, async (
    _evt,
    args: { boardId?: string; taskId?: string; limit?: number },
  ): Promise<ApiResponse<KanbanTaskEvent[]>> => {
    try {
      if (!args || typeof args !== 'object') return fail('args is required');
      if (args.taskId) return ok(repo.listEventsByTask(args.taskId));
      if (args.boardId) return ok(repo.listEventsByBoard(args.boardId, args.limit));
      return fail('boardId or taskId is required');
    } catch (err) { return failErr('KANBAN.LIST_EVENTS', err); }
  });

  ipcMain.handle(IPC_CHANNELS.KANBAN.ADD_EVENT, async (
    _evt,
    input: {
      taskId: string;
      boardId: string;
      eventType: KanbanTaskEventType;
      fromColumnId?: string;
      toColumnId?: string;
      agentId?: string;
      message?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ApiResponse<KanbanTaskEvent>> => {
    try {
      if (!input?.taskId || !input?.boardId) return fail('taskId and boardId are required');
      const eventType = (EVENT_VALUES as string[]).includes(input.eventType)
        ? input.eventType
        : 'commented';
      const created = repo.addEvent({
        taskId: input.taskId,
        boardId: input.boardId,
        eventType,
        fromColumnId: input.fromColumnId || undefined,
        toColumnId: input.toColumnId || undefined,
        agentId: input.agentId || undefined,
        message: input.message?.trim() || undefined,
        metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : undefined,
      });
      return ok(created);
    } catch (err) { return failErr('KANBAN.ADD_EVENT', err); }
  });
}

function clampStatus(v: unknown, fallback: KanbanTaskStatus): KanbanTaskStatus {
  return typeof v === 'string' && (STATUS_VALUES as string[]).includes(v) ? (v as KanbanTaskStatus) : fallback;
}

function clampPriority(v: unknown, fallback: KanbanTaskPriority): KanbanTaskPriority {
  return typeof v === 'string' && (PRIORITY_VALUES as string[]).includes(v) ? (v as KanbanTaskPriority) : fallback;
}

function sanitizeBoardInput(partial: Partial<KanbanBoard> | undefined): BoardUpdateInput {
  if (!partial) return {};
  const out: BoardUpdateInput = {};
  if (partial.name !== undefined) out.name = String(partial.name);
  if (partial.description !== undefined) out.description = partial.description ?? undefined;
  if (partial.color !== undefined) out.color = partial.color ?? undefined;
  if (partial.teamId !== undefined) out.teamId = partial.teamId ?? undefined;
  if (partial.ownerAgentId !== undefined) out.ownerAgentId = partial.ownerAgentId ?? undefined;
  return out;
}

function sanitizeColumnInput(partial: Partial<KanbanColumn> | undefined): ColumnUpdateInput {
  if (!partial) return {};
  const out: ColumnUpdateInput = {};
  if (partial.name !== undefined) out.name = String(partial.name);
  if (partial.position !== undefined && typeof partial.position === 'number') out.position = partial.position;
  if (partial.status !== undefined) out.status = clampStatus(partial.status, 'todo');
  if (partial.wipLimit !== undefined) out.wipLimit = typeof partial.wipLimit === 'number' ? partial.wipLimit : undefined;
  return out;
}

function sanitizeTaskInput(partial: Partial<KanbanTask> | undefined): TaskUpdateInput {
  if (!partial) return {};
  const out: TaskUpdateInput = {};
  if (partial.title !== undefined) out.title = String(partial.title);
  if (partial.description !== undefined) out.description = partial.description ?? undefined;
  if (partial.status !== undefined) out.status = clampStatus(partial.status, 'todo');
  if (partial.priority !== undefined) out.priority = clampPriority(partial.priority, 'medium');
  if (partial.assigneeAgentId !== undefined) out.assigneeAgentId = partial.assigneeAgentId ?? undefined;
  if (partial.creatorAgentId !== undefined) out.creatorAgentId = partial.creatorAgentId ?? undefined;
  if (partial.dueDate !== undefined) out.dueDate = typeof partial.dueDate === 'number' ? partial.dueDate : undefined;
  if (partial.parentTaskId !== undefined) out.parentTaskId = partial.parentTaskId ?? undefined;
  if (partial.tags !== undefined) {
    out.tags = Array.isArray(partial.tags) ? partial.tags.filter((t) => typeof t === 'string') : [];
  }
  return out;
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
