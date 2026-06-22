import { create } from 'zustand';
import type {
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  KanbanTaskEvent,
} from '../../shared/types';
import { api, unwrap } from '../lib/api';

export interface KanbanStoreState {
  boards: KanbanBoard[];
  currentBoardId: string | null;

  columnsByBoard: Record<string, KanbanColumn[]>;
  tasksByBoard: Record<string, KanbanTask[]>;
  eventsByBoard: Record<string, KanbanTaskEvent[]>;
  eventsByTask: Record<string, KanbanTaskEvent[]>;

  loading: boolean;
  error: string | null;

  loadBoards: () => Promise<void>;
  setCurrentBoard: (id: string | null) => void;
  refreshCurrentBoard: () => Promise<void>;

  createBoard: (input: {
    name: string;
    description?: string;
    color?: string;
    teamId?: string;
    ownerAgentId?: string;
    withDefaultColumns?: boolean;
  }) => Promise<KanbanBoard>;
  updateBoard: (id: string, partial: Partial<KanbanBoard>) => Promise<KanbanBoard | null>;
  deleteBoard: (id: string) => Promise<void>;

  loadColumns: (boardId: string) => Promise<KanbanColumn[]>;
  createColumn: (input: { boardId: string; name: string; status?: KanbanColumn['status']; position?: number; wipLimit?: number }) => Promise<KanbanColumn>;
  updateColumn: (id: string, partial: Partial<KanbanColumn>) => Promise<KanbanColumn | null>;
  deleteColumn: (id: string) => Promise<void>;
  reorderColumns: (boardId: string, orderedIds: string[]) => Promise<KanbanColumn[]>;

  loadTasks: (boardId: string) => Promise<KanbanTask[]>;
  createTask: (input: Partial<KanbanTask> & { title: string; boardId: string; columnId: string }) => Promise<KanbanTask>;
  updateTask: (id: string, partial: Partial<KanbanTask>) => Promise<KanbanTask | null>;
  moveTask: (taskId: string, toColumnId: string, toPosition?: number) => Promise<KanbanTask | null>;
  deleteTask: (id: string) => Promise<void>;

  loadBoardEvents: (boardId: string, limit?: number) => Promise<KanbanTaskEvent[]>;
  loadTaskEvents: (taskId: string) => Promise<KanbanTaskEvent[]>;
  addEvent: (input: Parameters<OfficeAPI['kanban']['addEvent']>[0]) => Promise<KanbanTaskEvent>;

  clearError: () => void;
}

export const useKanbanStore = create<KanbanStoreState>((set, get) => ({
  boards: [],
  currentBoardId: null,

  columnsByBoard: {},
  tasksByBoard: {},
  eventsByBoard: {},
  eventsByTask: {},

  loading: false,
  error: null,

  loadBoards: async () => {
    set({ loading: true, error: null });
    try {
      const boards = unwrap(await api.kanban.listBoards());
      set({ boards, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to load boards' });
    }
  },

  setCurrentBoard: (id) => set({ currentBoardId: id }),

  refreshCurrentBoard: async () => {
    const id = get().currentBoardId;
    if (!id) return;
    await Promise.all([
      get().loadColumns(id),
      get().loadTasks(id),
      get().loadBoardEvents(id, 100),
    ]);
  },

  createBoard: async (input) => {
    const board = unwrap(await api.kanban.createBoard(input));
    set((s) => ({ boards: [board, ...s.boards] }));
    return board;
  },

  updateBoard: async (id, partial) => {
    const updated = unwrap(await api.kanban.updateBoard(id, partial));
    set((s) => ({
      boards: s.boards.map((b) => (b.id === id ? (updated ?? b) : b)),
    }));
    return updated;
  },

  deleteBoard: async (id) => {
    unwrap(await api.kanban.deleteBoard(id));
    set((s) => {
      const { [id]: _cols, ...restCols } = s.columnsByBoard;
      const { [id]: _tasks, ...restTasks } = s.tasksByBoard;
      const { [id]: _events, ...restEvents } = s.eventsByBoard;
      void _cols; void _tasks; void _events;
      return {
        boards: s.boards.filter((b) => b.id !== id),
        currentBoardId: s.currentBoardId === id ? null : s.currentBoardId,
        columnsByBoard: restCols,
        tasksByBoard: restTasks,
        eventsByBoard: restEvents,
      };
    });
  },

  loadColumns: async (boardId) => {
    const cols = unwrap(await api.kanban.listColumns(boardId));
    set((s) => ({
      columnsByBoard: { ...s.columnsByBoard, [boardId]: cols },
    }));
    return cols;
  },

  createColumn: async (input) => {
    const col = unwrap(await api.kanban.createColumn(input));
    set((s) => {
      const existing = s.columnsByBoard[input.boardId] ?? [];
      return { columnsByBoard: { ...s.columnsByBoard, [input.boardId]: [...existing, col] } };
    });
    return col;
  },

  updateColumn: async (id, partial) => {
    const updated = unwrap(await api.kanban.updateColumn(id, partial));
    set((s) => {
      const next: Record<string, KanbanColumn[]> = {};
      for (const [boardId, cols] of Object.entries(s.columnsByBoard)) {
        next[boardId] = cols.map((c) => (c.id === id ? (updated ?? c) : c));
      }
      return { columnsByBoard: next };
    });
    return updated;
  },

  deleteColumn: async (id) => {
    unwrap(await api.kanban.deleteColumn(id));
    set((s) => {
      const next: Record<string, KanbanColumn[]> = {};
      for (const [boardId, cols] of Object.entries(s.columnsByBoard)) {
        next[boardId] = cols.filter((c) => c.id !== id);
      }
      return { columnsByBoard: next };
    });
  },

  reorderColumns: async (boardId, orderedIds) => {
    const cols = unwrap(await api.kanban.reorderColumns({ boardId, orderedIds }));
    set((s) => ({ columnsByBoard: { ...s.columnsByBoard, [boardId]: cols } }));
    return cols;
  },

  loadTasks: async (boardId) => {
    const tasks = unwrap(await api.kanban.listTasks({ boardId }));
    set((s) => ({ tasksByBoard: { ...s.tasksByBoard, [boardId]: tasks } }));
    return tasks;
  },

  createTask: async (input) => {
    const task = unwrap(await api.kanban.createTask(input));
    set((s) => {
      const existing = s.tasksByBoard[task.boardId] ?? [];
      return { tasksByBoard: { ...s.tasksByBoard, [task.boardId]: [...existing, task] } };
    });
    return task;
  },

  updateTask: async (id, partial) => {
    const updated = unwrap(await api.kanban.updateTask(id, partial));
    set((s) => {
      const next: Record<string, KanbanTask[]> = {};
      for (const [boardId, tasks] of Object.entries(s.tasksByBoard)) {
        next[boardId] = tasks.map((t) => (t.id === id ? (updated ?? t) : t));
      }
      return { tasksByBoard: next };
    });
    return updated;
  },

  moveTask: async (taskId, toColumnId, toPosition) => {
    const updated = unwrap(await api.kanban.moveTask({ taskId, toColumnId, toPosition }));
    if (!updated) return null;
    set((s) => {
      const next: Record<string, KanbanTask[]> = {};
      for (const [boardId, tasks] of Object.entries(s.tasksByBoard)) {
        next[boardId] = tasks.map((t) => (t.id === taskId ? updated : t));
      }
      return { tasksByBoard: next };
    });
    return updated;
  },

  deleteTask: async (id) => {
    unwrap(await api.kanban.deleteTask(id));
    set((s) => {
      const next: Record<string, KanbanTask[]> = {};
      for (const [boardId, tasks] of Object.entries(s.tasksByBoard)) {
        next[boardId] = tasks.filter((t) => t.id !== id);
      }
      return { tasksByBoard: next };
    });
  },

  loadBoardEvents: async (boardId, limit) => {
    const events = unwrap(await api.kanban.listEvents({ boardId, limit }));
    set((s) => ({ eventsByBoard: { ...s.eventsByBoard, [boardId]: events } }));
    return events;
  },

  loadTaskEvents: async (taskId) => {
    const events = unwrap(await api.kanban.listEvents({ taskId }));
    set((s) => ({ eventsByTask: { ...s.eventsByTask, [taskId]: events } }));
    return events;
  },

  addEvent: async (input) => {
    const ev = unwrap(await api.kanban.addEvent(input));
    set((s) => {
      const list = s.eventsByBoard[ev.boardId] ?? [];
      const existing = s.eventsByTask[ev.taskId] ?? [];
      return {
        eventsByBoard: { ...s.eventsByBoard, [ev.boardId]: [ev, ...list].slice(0, 500) },
        eventsByTask: { ...s.eventsByTask, [ev.taskId]: [...existing, ev] },
      };
    });
    return ev;
  },

  clearError: () => set({ error: null }),
}));
