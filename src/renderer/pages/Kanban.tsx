import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  KanbanSquare,
  Trash2,
  Edit,
  Sparkles,
  ArrowLeft,
  Loader2,
  Columns3,
  ListTodo,
  CalendarDays,
  User as UserIcon,
  Tag,
  Flag,
  MessageSquareText,
  ChevronRight,
  Wand2,
  Send,
  RefreshCw,
} from 'lucide-react';
import { useKanbanStore } from '../stores/kanban';
import { useAgentsStore } from '../stores/agents';
import { useChatRoomsStore } from '../stores/chatrooms';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input, { Textarea, Select } from '../components/ui/Input';
import type {
  Agent,
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  KanbanTaskEvent,
  KanbanTaskEventType,
  KanbanTaskPriority,
  KanbanTaskStatus,
} from '../../shared/types';
import { cn, formatDateTime, formatRelative, getInitial } from '../lib/utils';

const COLUMN_COLORS: Record<KanbanTaskStatus, string> = {
  todo: 'bg-slate-100 dark:bg-slate-800/60',
  in_progress: 'bg-amber-100 dark:bg-amber-900/30',
  review: 'bg-sky-100 dark:bg-sky-900/30',
  done: 'bg-emerald-100 dark:bg-emerald-900/30',
  blocked: 'bg-red-100 dark:bg-red-900/30',
};

const PRIORITY_BADGE: Record<KanbanTaskPriority, { label: string; className: string }> = {
  low: { label: 'Low', className: 'badge-neutral' },
  medium: { label: 'Medium', className: 'badge-primary' },
  high: { label: 'High', className: 'badge-warning' },
  urgent: { label: 'Urgent', className: 'badge-danger' },
};

const STATUS_LABEL: Record<KanbanTaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked',
};

const EVENT_BADGE: Record<KanbanTaskEventType, string> = {
  created: 'badge-primary',
  moved: 'badge-warning',
  assigned: 'badge-success',
  unassigned: 'badge-neutral',
  updated: 'badge-neutral',
  completed: 'badge-success',
  reopened: 'badge-warning',
  commented: 'badge-primary',
  deleted: 'badge-danger',
};

const KanbanPage: React.FC = () => {
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId?: string }>();

  const boards = useKanbanStore((s) => s.boards);
  const loading = useKanbanStore((s) => s.loading);
  const createBoard = useKanbanStore((s) => s.createBoard);
  const updateBoard = useKanbanStore((s) => s.updateBoard);
  const deleteBoard = useKanbanStore((s) => s.deleteBoard);
  const setCurrentBoard = useKanbanStore((s) => s.setCurrentBoard);

  const agents = useAgentsStore((s) => s.agents);
  const agentsById = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents) map.set(a.id, a);
    return map;
  }, [agents]);

  useEffect(() => {
    setCurrentBoard(boardId ?? null);
    return () => setCurrentBoard(null);
  }, [boardId, setCurrentBoard]);

  if (!boardId) {
    return (
      <BoardsList
        boards={boards}
        loading={loading}
        onOpen={(id) => navigate(`/kanban/${id}`)}
        onCreate={async (input) => {
          const created = await createBoard(input);
          navigate(`/kanban/${created.id}`);
        }}
        onUpdate={updateBoard}
        onDelete={async (id) => {
          if (!window.confirm('Delete this board? Tasks and history will be removed.')) return;
          await deleteBoard(id);
        }}
      />
    );
  }

  return (
    <BoardView
      boardId={boardId}
      onBack={() => navigate('/kanban')}
      agentsById={agentsById}
    />
  );
};

export default KanbanPage;

/* ====================================================================== */
/* Boards list                                                            */
/* ====================================================================== */

interface BoardsListProps {
  boards: KanbanBoard[];
  loading: boolean;
  onOpen: (id: string) => void;
  onCreate: (input: { name: string; description?: string; color?: string }) => Promise<void>;
  onUpdate: (id: string, partial: Partial<KanbanBoard>) => Promise<KanbanBoard | null>;
  onDelete: (id: string) => Promise<void>;
}

const BOARD_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#a855f7',
];

const BoardsList: React.FC<BoardsListProps> = ({ boards, loading, onOpen, onCreate, onUpdate, onDelete }) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<KanbanBoard | null>(null);

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(board: KanbanBoard, e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(board);
    setEditorOpen(true);
  }

  async function handleDelete(board: KanbanBoard, e: React.MouseEvent) {
    e.stopPropagation();
    await onDelete(board.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <KanbanSquare className="text-primary-500" />
            Kanban Boards
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Organize work, assign tasks to agents, and watch the workflow evolve.
          </p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openNew}>
          New Board
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-40 shimmer" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="card relative overflow-hidden p-12 text-center">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-primary-400/20 to-purple-400/20 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-gradient-to-br from-pink-400/20 to-amber-400/20 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-primary-500/30 animate-float">
              <KanbanSquare size={36} strokeWidth={2} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No boards yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Boards let agents and humans collaborate on tasks. Create one manually, or have the
              project-manager / lead-orchestrator agent plan a goal into tasks automatically.
            </p>
            <div className="mt-5">
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openNew}>
                Create your first board
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <BoardCard
              key={b.id}
              board={b}
              onOpen={() => onOpen(b.id)}
              onEdit={(e) => openEdit(b, e)}
              onDelete={(e) => handleDelete(b, e)}
            />
          ))}
        </div>
      )}

      <BoardEditor
        board={editing}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={async (data) => {
          if (data.id) {
            await onUpdate(data.id, data);
          } else {
            await onCreate(data);
          }
        }}
      />
    </div>
  );
};

interface BoardCardProps {
  board: KanbanBoard;
  onOpen: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

const BoardCard: React.FC<BoardCardProps> = ({ board, onOpen, onEdit, onDelete }) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="card group relative flex flex-col overflow-hidden text-left transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
    >
      <div className="h-2 w-full" style={{ backgroundColor: board.color ?? '#6366f1' }} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">{board.name}</h3>
            {board.description && (
              <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{board.description}</p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              title="Edit"
            >
              <Edit size={14} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Columns3 size={12} /> Updated {formatRelative(board.updatedAt)}
          </span>
          <ChevronRight size={14} className="text-slate-400" />
        </div>
      </div>
    </div>
  );
};

interface BoardEditorProps {
  board: KanbanBoard | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    description?: string;
    color?: string;
  }) => Promise<void>;
}

const BoardEditor: React.FC<BoardEditorProps> = ({ board, open, onClose, onSave }) => {
  const [form, setForm] = useState<{
    name: string;
    description: string;
    color: string;
  }>({ name: '', description: '', color: '#6366f1' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        name: board?.name ?? '',
        description: board?.description ?? '',
        color: board?.color ?? '#6366f1',
      });
      setError(null);
    }
  }, [board, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        id: board?.id,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        color: form.color,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save board');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={board ? 'Edit Board' : 'New Board'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" form="board-editor-form" loading={submitting} leftIcon={<Save size={14} />}>
            Save
          </Button>
        </>
      }
    >
      <form id="board-editor-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
        <Input label="Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
        <Textarea
          label="Description"
          rows={3}
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
        />
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Color</label>
          <div className="flex flex-wrap gap-2">
            {BOARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                  form.color === c ? 'border-slate-900 dark:border-white' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
};

function Save(props: { size?: number }) {
  return <SaveIcon size={props.size ?? 14} />;
}
const SaveIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

/* ====================================================================== */
/* Board view                                                             */
/* ====================================================================== */

interface BoardViewProps {
  boardId: string;
  onBack: () => void;
  agentsById: Map<string, Agent>;
}

const BoardView: React.FC<BoardViewProps> = ({ boardId, onBack, agentsById }) => {
  const board = useKanbanStore((s) => s.boards.find((b) => b.id === boardId) ?? null);
  const columns = useKanbanStore((s) => s.columnsByBoard[boardId] ?? EMPTY_COLUMNS);
  const tasks = useKanbanStore((s) => s.tasksByBoard[boardId] ?? EMPTY_TASKS);
  const events = useKanbanStore((s) => s.eventsByBoard[boardId] ?? EMPTY_EVENTS);

  const loadColumns = useKanbanStore((s) => s.loadColumns);
  const loadTasks = useKanbanStore((s) => s.loadTasks);
  const loadBoardEvents = useKanbanStore((s) => s.loadBoardEvents);
  const refreshBoards = useKanbanStore((s) => s.loadBoards);
  const updateBoard = useKanbanStore((s) => s.updateBoard);
  const deleteBoard = useKanbanStore((s) => s.deleteBoard);
  const createColumn = useKanbanStore((s) => s.createColumn);
  const updateColumn = useKanbanStore((s) => s.updateColumn);
  const deleteColumn = useKanbanStore((s) => s.deleteColumn);
  const reorderColumns = useKanbanStore((s) => s.reorderColumns);
  const createTask = useKanbanStore((s) => s.createTask);
  const updateTask = useKanbanStore((s) => s.updateTask);
  const moveTask = useKanbanStore((s) => s.moveTask);
  const deleteTask = useKanbanStore((s) => s.deleteTask);

  const agentsList = useMemo(() => Array.from(agentsById.values()), [agentsById]);

  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [creatingForColumn, setCreatingForColumn] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null);
  const [editingBoard, setEditingBoard] = useState(false);
  const [aiPlanOpen, setAiPlanOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void refreshBoards();
    void loadColumns(boardId);
    void loadTasks(boardId);
    void loadBoardEvents(boardId, 200);
  }, [boardId, loadColumns, loadTasks, loadBoardEvents, refreshBoards]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    for (const t of tasks) {
      const list = map.get(t.columnId) ?? [];
      list.push(t);
      map.set(t.columnId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
    }
    return map;
  }, [tasks]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshBoards(),
        loadColumns(boardId),
        loadTasks(boardId),
        loadBoardEvents(boardId, 200),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleMoveTask(taskId: string, toColumnId: string) {
    await moveTask(taskId, toColumnId);
    await loadBoardEvents(boardId, 200);
  }

  async function handleDeleteBoard() {
    if (!board) return;
    if (!window.confirm(`Delete board "${board.name}"? This cannot be undone.`)) return;
    await deleteBoard(board.id);
    onBack();
  }

  if (!board) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <Loader2 className="animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading board…</p>
        <Button variant="ghost" leftIcon={<ArrowLeft size={14} />} onClick={onBack}>Back to boards</Button>
      </div>
    );
  }

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100vh-7rem)] flex-col gap-3 px-6 py-6 lg:-mx-8 lg:-my-8 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" leftIcon={<ArrowLeft size={14} />} onClick={onBack}>Boards</Button>
          <div className="h-6 w-1 rounded-full" style={{ backgroundColor: board.color ?? '#6366f1' }} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">{board.name}</h1>
            {board.description && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{board.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            leftIcon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Sparkles size={14} />}
            onClick={() => setAiPlanOpen(true)}
          >
            Generate with AI
          </Button>
          <Button
            variant="ghost"
            leftIcon={<Edit size={14} />}
            onClick={() => setEditingBoard(true)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            leftIcon={<Trash2 size={14} />}
            onClick={() => void handleDeleteBoard()}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-2 scrollbar-thin">
        {columns.map((col) => (
          <KanbanColumnView
            key={col.id}
            column={col}
            tasks={tasksByColumn.get(col.id) ?? []}
            agentsById={agentsById}
            onAddTask={() => setCreatingForColumn(col.id)}
            onEditColumn={() => setEditingColumn(col)}
            onDeleteColumn={async () => {
              if (!window.confirm(`Delete column "${col.name}"? Its tasks will be removed.`)) return;
              await deleteColumn(col.id);
            }}
            onEditTask={(t) => setEditingTask(t)}
            onDeleteTask={async (t) => {
              if (!window.confirm(`Delete task "${t.title}"?`)) return;
              await deleteTask(t.id);
            }}
            onMoveTask={handleMoveTask}
          />
        ))}
        <button
          type="button"
          onClick={() => setAddingColumn(true)}
          className="flex w-72 flex-shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-3 py-6 text-sm font-medium text-slate-500 transition-colors hover:border-primary-400 hover:bg-primary-50/60 hover:text-primary-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:border-primary-500 dark:hover:bg-primary-900/20 dark:hover:text-primary-300"
        >
          <Plus size={16} /> Add column
        </button>
      </div>

      <ActivityTimeline events={events} agentsById={agentsById} />

      {/* ---- Modals ---- */}
      <BoardEditor
        board={editingBoard ? board : null}
        open={editingBoard}
        onClose={() => setEditingBoard(false)}
        onSave={async (data) => {
          await updateBoard(board.id, { name: data.name, description: data.description, color: data.color });
        }}
      />

<ColumnEditor
        column={editingColumn}
        boardId={board.id}
        open={!!editingColumn}
        onClose={() => setEditingColumn(null)}
        onSave={async (data) => {
          if (editingColumn) {
            await updateColumn(editingColumn.id, {
              name: data.name,
              status: data.status,
              position: data.position,
              wipLimit: data.wipLimit ?? undefined,
            });
          }
        }}
      />

      <ColumnEditor
        column={null}
        boardId={board.id}
        open={addingColumn}
        onClose={() => setAddingColumn(false)}
        onSave={async (data) => {
          await createColumn({
            boardId: board.id,
            name: data.name ?? '',
            status: data.status,
            position: data.position,
            wipLimit: data.wipLimit ?? undefined,
          });
        }}
      />

      <TaskEditor
        task={editingTask}
        boardId={board.id}
        defaultColumnId={creatingForColumn ?? undefined}
        agents={agentsList}
        onClose={() => { setEditingTask(null); setCreatingForColumn(null); }}
        onSave={async (data) => {
          if (editingTask) {
            await updateTask(editingTask.id, data);
          } else {
            await createTask({
              ...data,
              boardId: board.id,
              title: data.title ?? 'Untitled',
              columnId: data.columnId ?? creatingForColumn ?? '',
            });
          }
        }}
      />

      <AiPlanModal
        open={aiPlanOpen}
        onClose={() => setAiPlanOpen(false)}
        board={board}
        agents={agentsList}
        onComplete={async () => {
          await handleRefresh();
        }}
      />

      <ColumnEditor
        column={null}
        boardId={board.id}
        open={addingColumn}
        onClose={() => setAddingColumn(false)}
        onSave={async (data) => {
          await createColumn({
            boardId: board.id,
            name: data.name ?? '',
            status: data.status,
            position: data.position,
            wipLimit: typeof data.wipLimit === 'number' ? data.wipLimit : undefined,
          });
        }}
      />

      <TaskEditor
        task={editingTask}
        boardId={board.id}
        defaultColumnId={creatingForColumn ?? undefined}
        agents={agentsList}
        onClose={() => { setEditingTask(null); setCreatingForColumn(null); }}
        onSave={async (data) => {
          if (editingTask) {
            await updateTask(editingTask.id, {
              title: data.title,
              description: data.description,
              columnId: data.columnId ?? editingTask.columnId,
              priority: data.priority,
              status: data.status,
              assigneeAgentId: data.assigneeAgentId,
              tags: data.tags,
              dueDate: data.dueDate,
            });
          } else {
            await createTask({
              ...data,
              boardId: board.id,
              title: data.title ?? 'Untitled',
              columnId: data.columnId ?? columns[0]?.id ?? '',
            });
          }
        }}
      />

      <AiPlanModal
        open={aiPlanOpen}
        onClose={() => setAiPlanOpen(false)}
        board={board}
        agents={agentsList}
        onComplete={async () => {
          await handleRefresh();
        }}
      />
    </div>
  );
};

const EMPTY_COLUMNS: KanbanColumn[] = [];
const EMPTY_TASKS: KanbanTask[] = [];
const EMPTY_EVENTS: KanbanTaskEvent[] = [];

/* ====================================================================== */
/* Column                                                                 */
/* ====================================================================== */

interface KanbanColumnViewProps {
  column: KanbanColumn;
  tasks: KanbanTask[];
  agentsById: Map<string, Agent>;
  onAddTask: () => void;
  onEditColumn: () => void;
  onDeleteColumn: () => void;
  onEditTask: (t: KanbanTask) => void;
  onDeleteTask: (t: KanbanTask) => void;
  onMoveTask: (taskId: string, toColumnId: string) => void;
}

const KanbanColumnView: React.FC<KanbanColumnViewProps> = ({
  column,
  tasks,
  agentsById,
  onAddTask,
  onEditColumn,
  onDeleteColumn,
  onEditTask,
  onDeleteTask,
  onMoveTask,
}) => {
  const [hovered, setHovered] = useState(false);
  const [editingMenu, setEditingMenu] = useState(false);

  return (
    <div
      className={cn(
        'flex w-72 flex-shrink-0 flex-col gap-2 rounded-xl border border-slate-200/80 bg-white/80 p-2 backdrop-blur-sm transition-all dark:border-slate-700/80 dark:bg-slate-900/60',
        hovered && 'ring-2 ring-primary-300/60 dark:ring-primary-500/40',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setHovered(true);
      }}
      onDragLeave={() => setHovered(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHovered(false);
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) onMoveTask(taskId, column.id);
      }}
    >
      <header className={cn('flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-medium', COLUMN_COLORS[column.status])}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{column.name}</span>
          <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
            {tasks.length}
          </span>
          {typeof column.wipLimit === 'number' && column.wipLimit > 0 && tasks.length > column.wipLimit && (
            <span className="rounded-full bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-900/50 dark:text-red-200">
              WIP {column.wipLimit}
            </span>
          )}
        </div>
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={onAddTask}
            className="rounded p-1 text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
            title="Add task"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={() => setEditingMenu((v) => !v)}
            className="rounded p-1 text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
            title="Column options"
          >
            <span className="text-base leading-none">⋯</span>
          </button>
          {editingMenu && (
            <div
              className="absolute right-0 top-8 z-10 w-36 rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800"
              onMouseLeave={() => setEditingMenu(false)}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => { setEditingMenu(false); onEditColumn(); }}
              >
                <Edit size={12} /> Rename / edit
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => { setEditingMenu(false); onDeleteColumn(); }}
              >
                <Trash2 size={12} /> Delete column
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pb-1 scrollbar-thin">
        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
            Drop tasks here
          </div>
        )}
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            assignee={t.assigneeAgentId ? agentsById.get(t.assigneeAgentId) : undefined}
            onClick={() => onEditTask(t)}
            onDelete={() => onDeleteTask(t)}
          />
        ))}
      </div>
    </div>
  );
};

interface TaskCardProps {
  task: KanbanTask;
  assignee?: Agent;
  onClick: () => void;
  onDelete: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, assignee, onClick, onDelete }) => {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onClick}
      className="card group cursor-grab p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
      title={task.description ?? task.title}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-slate-100">
          {task.title}
        </h4>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 transition-opacity group-hover:opacity-100 text-slate-400 hover:text-red-500"
          title="Delete task"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={cn('text-[10px] !py-0', PRIORITY_BADGE[task.priority].className)}>
          <Flag size={9} className="mr-0.5" /> {PRIORITY_BADGE[task.priority].label}
        </span>
        {Array.isArray(task.tags) && task.tags.slice(0, 2).map((t) => (
          <span key={t} className="badge-neutral !py-0 text-[10px]">{t}</span>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1">
          {assignee ? (
            <>
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: assignee.color ?? '#6366f1' }}
                title={assignee.name}
              >
                {getInitial(assignee.name)}
              </span>
              <span className="truncate max-w-[8rem]">{assignee.name}</span>
            </>
          ) : (
            <>
              <UserIcon size={11} />
              <span>Unassigned</span>
            </>
          )}
        </div>
        {typeof task.dueDate === 'number' && (
          <span className="flex items-center gap-1" title={formatDateTime(task.dueDate)}>
            <CalendarDays size={11} /> {formatRelative(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
};

/* ====================================================================== */
/* Column editor                                                          */
/* ====================================================================== */

interface ColumnEditorProps {
  column: KanbanColumn | null;
  boardId: string;
  open: boolean;
  onClose: () => void;
  onSave: (data: { name?: string; status?: KanbanTaskStatus; position?: number; wipLimit?: number | null }) => Promise<void>;
}

const ColumnEditor: React.FC<ColumnEditorProps> = ({ column, open, onClose, onSave }) => {
  const [form, setForm] = useState<{
    name: string;
    status: KanbanTaskStatus;
    wipLimit: string;
  }>({ name: '', status: 'todo', wipLimit: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        name: column?.name ?? '',
        status: column?.status ?? 'todo',
        wipLimit: typeof column?.wipLimit === 'number' ? String(column.wipLimit) : '',
      });
      setError(null);
    }
  }, [column, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const wip = form.wipLimit.trim();
      await onSave({
        name: form.name.trim(),
        status: form.status,
        wipLimit: wip ? Number(wip) : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save column');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={column ? 'Edit Column' : 'New Column'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" form="column-editor-form" loading={submitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="column-editor-form" onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
        <Input label="Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => setForm((f) => ({ ...f, status: v as KanbanTaskStatus }))}
          options={(['todo', 'in_progress', 'review', 'done', 'blocked'] as KanbanTaskStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
        <Input
          label="WIP Limit (optional)"
          type="number"
          value={form.wipLimit}
          onChange={(v) => setForm((f) => ({ ...f, wipLimit: v }))}
          placeholder="e.g. 3"
        />
      </form>
    </Modal>
  );
};

/* ====================================================================== */
/* Task editor                                                            */
/* ====================================================================== */

interface TaskEditorProps {
  task: KanbanTask | null;
  boardId: string;
  defaultColumnId?: string;
  agents: Agent[];
  onClose: () => void;
  onSave: (data: Partial<KanbanTask> & { title?: string; boardId?: string; columnId?: string }) => Promise<void>;
}

const TaskEditor: React.FC<TaskEditorProps> = ({ task, boardId, defaultColumnId, agents, onClose, onSave }) => {
  const columns = useKanbanStore((s) => s.columnsByBoard[boardId] ?? EMPTY_COLUMNS);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    columnId: string;
    priority: KanbanTaskPriority;
    status: KanbanTaskStatus;
    assigneeAgentId: string;
    tagsInput: string;
    dueDate: string;
  }>({
    title: '',
    description: '',
    columnId: '',
    priority: 'medium',
    status: 'todo',
    assigneeAgentId: '',
    tagsInput: '',
    dueDate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const eventsByTask = useKanbanStore((s) => (task ? s.eventsByTask[task.id] ?? EMPTY_EVENTS : EMPTY_EVENTS));
  const loadTaskEvents = useKanbanStore((s) => s.loadTaskEvents);
  const addEvent = useKanbanStore((s) => s.addEvent);

  useEffect(() => {
    if (task) {
      void loadTaskEvents(task.id);
    }
  }, [task, loadTaskEvents]);

  useEffect(() => {
    setForm({
      title: task?.title ?? '',
      description: task?.description ?? '',
      columnId: task?.columnId ?? defaultColumnId ?? columns[0]?.id ?? '',
      priority: task?.priority ?? 'medium',
      status: task?.status ?? 'todo',
      assigneeAgentId: task?.assigneeAgentId ?? '',
      tagsInput: Array.isArray(task?.tags) ? task!.tags!.join(', ') : '',
      dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    });
    setComment('');
    setError(null);
  }, [task, defaultColumnId, columns]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    try {
      const tags = form.tagsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const dueDate = form.dueDate ? new Date(form.dueDate).getTime() : undefined;
      await onSave({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        columnId: form.columnId,
        priority: form.priority,
        status: form.status,
        assigneeAgentId: form.assigneeAgentId || undefined,
        tags: tags.length ? tags : undefined,
        dueDate,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddComment() {
    if (!task || !comment.trim()) return;
    await addEvent({
      taskId: task.id,
      boardId: task.boardId,
      eventType: 'commented',
      message: comment.trim(),
    });
    setComment('');
  }

  return (
    <Modal
      open={!!task || !!defaultColumnId}
      onClose={onClose}
      title={task ? 'Edit Task' : 'New Task'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" form="task-editor-form" loading={submitting} leftIcon={<Save size={14} />}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <form id="task-editor-form" onSubmit={handleSubmit} className="space-y-3 md:col-span-1">
          {error && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}
          <Input label="Title *" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} required />
          <Textarea
            label="Description"
            rows={4}
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            placeholder="What needs to be done?"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Column"
              value={form.columnId}
              onChange={(v) => setForm((f) => ({ ...f, columnId: v }))}
              options={columns.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={(v) => setForm((f) => ({ ...f, priority: v as KanbanTaskPriority }))}
              options={(['low', 'medium', 'high', 'urgent'] as KanbanTaskPriority[]).map((p) => ({ value: p, label: PRIORITY_BADGE[p].label }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Assignee"
              value={form.assigneeAgentId}
              onChange={(v) => setForm((f) => ({ ...f, assigneeAgentId: v }))}
              options={[{ value: '', label: 'Unassigned' }, ...agents.map((a) => ({ value: a.id, label: a.name }))]}
            />
            <Input
              label="Due date"
              type="date"
              value={form.dueDate}
              onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))}
            />
          </div>
          <Input
            label="Tags"
            value={form.tagsInput}
            onChange={(v) => setForm((f) => ({ ...f, tagsInput: v }))}
            placeholder="comma,separated"
            hint={<span className="flex items-center gap-1"><Tag size={11} /> Used for grouping and filtering.</span>}
          />
        </form>

        {task && (
          <div className="space-y-3 md:col-span-1">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <MessageSquareText size={14} /> Activity
              </h3>
              <ul className="space-y-1.5 text-xs">
                {eventsByTask.length === 0 && <li className="text-slate-400">No activity yet.</li>}
                {eventsByTask.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-2">
                    <span className={cn('mt-0.5', EVENT_BADGE[ev.eventType])}>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                    </span>
                    <div className="flex-1">
                      <p className="text-slate-700 dark:text-slate-200">
                        <span className="font-medium">{ev.eventType}</span>
                        {ev.message ? <>: {ev.message}</> : null}
                      </p>
                      <p className="text-[10px] text-slate-400">{formatDateTime(ev.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-end gap-2">
                <Textarea
                  rows={2}
                  value={comment}
                  onChange={setComment}
                  placeholder="Add a comment…"
                />
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Send size={12} />}
                  onClick={() => void handleAddComment()}
                  disabled={!comment.trim()}
                >
                  Post
                </Button>
              </div>
            </div>
            {task.completedAt && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ Completed {formatDateTime(task.completedAt)}
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              Created {formatDateTime(task.createdAt)} · Updated {formatRelative(task.updatedAt)}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

/* ====================================================================== */
/* AI Plan Modal                                                          */
/* ====================================================================== */

interface AiPlanModalProps {
  open: boolean;
  onClose: () => void;
  board: KanbanBoard;
  agents: Agent[];
  onComplete: () => Promise<void>;
}

const AiPlanModal: React.FC<AiPlanModalProps> = ({ open, onClose, board, agents, onComplete }) => {
  const getOrCreateDirect = useChatRoomsStore((s) => s.getOrCreateDirect);
  const sendMessage = useChatRoomsStore((s) => s.sendMessage);
  const setCurrentChatRoom = useChatRoomsStore((s) => s.setCurrentChatRoom);
  const navigate = useNavigate();

  const defaultAgentId = useMemo(() => {
    const pm = agents.find((a) => /project.?manager/i.test(a.name) || (a.description ?? '').toLowerCase().includes('project'));
    if (pm) return pm.id;
    const lead = agents.find((a) => a.isLead || a.role === 'lead');
    return lead?.id ?? agents[0]?.id ?? '';
  }, [agents]);

  const [agentId, setAgentId] = useState(defaultAgentId);
  const [goal, setGoal] = useState('');
  const [scope, setScope] = useState('plan');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAgentId(defaultAgentId);
      setGoal('');
      setScope('plan');
      setError(null);
    }
  }, [open, defaultAgentId]);

  async function handleGenerate() {
    if (!agentId) {
      setError('Pick an orchestrator agent first.');
      return;
    }
    if (!goal.trim()) {
      setError('Describe a goal first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const room = await getOrCreateDirect(agentId);
      const boardHint = `Use board id="${board.id}" (name: "${board.name}") for ALL kanban operations.`;
      const instruction = scope === 'plan'
        ? `Plan this goal into a Kanban board:\n\n${goal.trim()}\n\n${boardHint}\n\n` +
          `Steps you MUST follow, in order:\n` +
          `1. Call kanban_ops with operation="create_column" ONLY if the existing default columns don't fit. Otherwise reuse the default "To Do" / "In Progress" / "Review" / "Done" columns.\n` +
          `2. Call kanban_ops with operation="plan_from_goal" passing boardId, goal, and a "candidates" array of 4-8 well-scoped tasks. Each task should have: title (required), description (optional), priority (low|medium|high|urgent), and assigneeAgentId when you know which agent fits best (use the IDs from this team).\n` +
          `3. Add a brief comment to each created task using kanban_ops "comment" so the team knows the rationale.\n` +
          `4. Reply with a concise summary of the board and the next concrete step.\n`
        : `Analyze this board and propose improvements:\n\n${goal.trim()}\n\n${boardHint}\n\n` +
          `Steps:\n` +
          `1. Call kanban_ops with operation="get_board" to read the current state.\n` +
          `2. Call kanban_ops with operation="list_events" with boardId to see the recent workflow.\n` +
          `3. Suggest concrete actions (new tasks, reassignments, or comments) and execute the ones the user is most likely to want.\n` +
          `4. Reply with a concise summary.`;
      await sendMessage({
        chatRoomId: room.id,
        userMessage: instruction,
        agentId,
      });
      setCurrentChatRoom(room.id);
      onClose();
      // Refresh board view after a beat so any synchronous creates show up.
      setTimeout(() => { void onComplete(); }, 800);
      navigate(`/chat/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispatch the orchestrator');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary-500" />
          <span>Generate with AI</span>
        </div>
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" loading={submitting} leftIcon={<Wand2 size={14} />} onClick={() => void handleGenerate()}>
            Run orchestrator
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Pick the agent that should drive the Kanban (usually the <strong>Project Manager</strong> or <strong>Lead Orchestrator</strong>) and describe your goal.
          The agent will run with the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">kanban_ops</code> skill enabled and
          write directly into <span className="font-semibold">{board.name}</span>. You'll see the new tasks appear here.
        </p>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            label="Orchestrator agent"
            value={agentId}
            onChange={setAgentId}
            options={[
              ...(defaultAgentId ? [] : [{ value: '', label: '(no agents yet — create one first)' }]),
              ...agents.map((a) => ({ value: a.id, label: a.name })),
            ]}
            hint="Best: a lead/project-manager agent that already has kanban_ops enabled."
          />
          <Select
            label="Mode"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'plan', label: 'Plan a new goal into tasks' },
              { value: 'review', label: 'Review board & propose changes' },
            ]}
          />
        </div>

        <Textarea
          label="Goal / instructions"
          rows={6}
          value={goal}
          onChange={setGoal}
          placeholder="Example: Build a CLI that exports our customers table to CSV. Frontend uses React, backend uses Node."
        />

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          <p className="font-medium text-slate-700 dark:text-slate-200">What the agent will do</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Create / reuse columns for the workflow.</li>
            <li>Break the goal into concrete tasks with priorities and (when possible) assignees.</li>
            <li>Comment on each task so the team can see the rationale and progress.</li>
            <li>Reply with a concise summary you can follow up on.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};

/* ====================================================================== */
/* Activity timeline (footer of board view)                                */
/* ====================================================================== */

const ActivityTimeline: React.FC<{ events: KanbanTaskEvent[]; agentsById: Map<string, Agent> }> = ({ events, agentsById }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? events : events.slice(0, 5);

  if (events.length === 0) {
    return (
      <div className="card flex items-center gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
        <ListTodo size={14} /> No workflow activity yet — drag tasks across columns to see the timeline here.
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-2 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <ListTodo size={14} /> Workflow timeline ({events.length})
        </h3>
        {events.length > 5 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-primary-600 hover:underline dark:text-primary-400"
          >
            {expanded ? 'Collapse' : 'Show all'}
          </button>
        )}
      </div>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
        {visible.map((ev) => {
          const agent = ev.agentId ? agentsById.get(ev.agentId) : undefined;
          return (
            <li key={ev.id} className="flex items-center gap-1">
              <span className={cn('badge !py-0 text-[10px]', EVENT_BADGE[ev.eventType])}>
                {ev.eventType}
              </span>
              {agent && (
                <span className="flex items-center gap-1" title={agent.name}>
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ backgroundColor: agent.color ?? '#6366f1' }}
                  >
                    {getInitial(agent.name)}
                  </span>
                </span>
              )}
              <span className="truncate max-w-[14rem]" title={ev.message}>
                {ev.message ?? '(no message)'}
              </span>
              <span className="text-[10px] text-slate-400">{formatRelative(ev.createdAt)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
