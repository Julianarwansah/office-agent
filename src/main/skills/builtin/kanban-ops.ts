/**
 * `kanban_ops` — built-in skill that lets an agent (typically the
 * project-manager / orchestrator / lead agent) create and manage Kanban
 * boards, columns, and tasks on behalf of the team.
 *
 * The renderer UI mirrors every operation here, so agents and humans can
 * collaborate on the same boards in real time. All operations return a
 * short, structured summary so the LLM can keep reasoning without bloating
 * its context.
 */

import type { LLMTool } from '../../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from '../types';
import type {
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  KanbanTaskEvent,
  KanbanTaskEventType,
  KanbanTaskPriority,
  KanbanTaskStatus,
} from '../../../shared/types';
import type { SkillManifest, SkillExample } from '../../../shared/skills-schema';
import type { SkillExample } from '../../../shared/skills-schema';

type KanbanOp =
  | 'list_boards'
  | 'get_board'
  | 'create_board'
  | 'update_board'
  | 'delete_board'
  | 'list_columns'
  | 'create_column'
  | 'update_column'
  | 'delete_column'
  | 'reorder_columns'
  | 'list_tasks'
  | 'get_task'
  | 'create_task'
  | 'update_task'
  | 'move_task'
  | 'assign_task'
  | 'unassign_task'
  | 'delete_task'
  | 'list_events'
  | 'comment'
  | 'plan_from_goal';

interface KanbanOpsArgs {
  operation: KanbanOp;
  // board
  boardId?: string;
  boardName?: string;
  boardDescription?: string;
  boardColor?: string;
  teamId?: string;
  ownerAgentId?: string;
  withDefaultColumns?: boolean;
  // column
  columnId?: string;
  columnName?: string;
  columnStatus?: KanbanTaskStatus;
  columnPosition?: number;
  wipLimit?: number;
  orderedColumnIds?: string[];
  // task
  taskId?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskPriority?: KanbanTaskPriority;
  taskStatus?: KanbanTaskStatus;
  assigneeAgentId?: string;
  creatorAgentId?: string;
  dueDate?: number;
  parentTaskId?: string;
  tags?: string[];
  toColumnId?: string;
  toPosition?: number;
  // generic
  eventType?: KanbanTaskEventType;
  message?: string;
  limit?: number;
  // for plan_from_goal
  goal?: string;
  candidates?: Array<{
    title: string;
    description?: string;
    priority?: KanbanTaskPriority;
    assigneeAgentId?: string;
    assigneeName?: string;
    tags?: string[];
  }>;
}

const STATUS_VALUES: KanbanTaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const PRIORITY_VALUES: KanbanTaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const EVENT_VALUES: KanbanTaskEventType[] = [
  'created', 'moved', 'assigned', 'unassigned', 'updated',
  'completed', 'reopened', 'commented', 'deleted',
];

function manifest(): SkillManifest {
  return {
    name: 'kanban_ops',
    displayName: 'Kanban Operations',
    description:
      'Create and manage Kanban boards, columns, and tasks. Agents can break down goals into tasks, assign work to other agents, move tasks across columns, and add comments. Every operation is logged as an event so the UI shows a full workflow timeline.',
    category: 'productivity',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      { name: 'operation', type: 'string' as const, description: 'Kanban operation to perform', required: true,
        enum: [
          'list_boards', 'get_board', 'create_board', 'update_board', 'delete_board',
          'list_columns', 'create_column', 'update_column', 'delete_column', 'reorder_columns',
          'list_tasks', 'get_task', 'create_task', 'update_task', 'move_task',
          'assign_task', 'unassign_task', 'delete_task',
          'list_events', 'comment', 'plan_from_goal',
        ] },
      { name: 'boardId', type: 'string' as const, description: 'Board id (for get/update/delete/list_columns/list_tasks)', required: false },
      { name: 'boardName', type: 'string' as const, description: 'Board name (for create_board)', required: false },
      { name: 'boardDescription', type: 'string' as const, description: 'Board description', required: false },
      { name: 'boardColor', type: 'string' as const, description: 'Hex color for the board header (e.g. #6366f1)', required: false },
      { name: 'teamId', type: 'string' as const, description: 'Optional team id this board belongs to', required: false },
      { name: 'ownerAgentId', type: 'string' as const, description: 'Agent id of the board owner (defaults to caller)', required: false },

      { name: 'columnId', type: 'string' as const, description: 'Column id (for update/delete column)', required: false },
      { name: 'columnName', type: 'string' as const, description: 'Column name (for create/update column)', required: false },
      { name: 'columnStatus', type: 'string' as const, description: 'Column status enum', required: false,
        enum: ['todo', 'in_progress', 'review', 'done', 'blocked'] },
      { name: 'columnPosition', type: 'number' as const, description: 'Column position/order', required: false },
      { name: 'wipLimit', type: 'number' as const, description: 'Work-in-progress limit for the column', required: false },
      { name: 'orderedColumnIds', type: 'array' as const, description: 'Array of column ids in desired order (for reorder_columns)', required: false },

      { name: 'taskId', type: 'string' as const, description: 'Task id (for get/update/move/assign/delete/comment)', required: false },
      { name: 'taskTitle', type: 'string' as const, description: 'Task title (for create_task)', required: false },
      { name: 'taskDescription', type: 'string' as const, description: 'Task description', required: false },
      { name: 'taskPriority', type: 'string' as const, description: 'Task priority', required: false,
        enum: ['low', 'medium', 'high', 'urgent'] },
      { name: 'taskStatus', type: 'string' as const, description: 'Task status', required: false,
        enum: ['todo', 'in_progress', 'review', 'done', 'blocked'] },
      { name: 'assigneeAgentId', type: 'string' as const, description: 'Agent id assigned to the task', required: false },
      { name: 'creatorAgentId', type: 'string' as const, description: 'Agent id that created the task (defaults to caller)', required: false },
      { name: 'dueDate', type: 'number' as const, description: 'Due date as a unix ms timestamp', required: false },
      { name: 'parentTaskId', type: 'string' as const, description: 'Parent task id for sub-tasks', required: false },
      { name: 'tags', type: 'array' as const, description: 'Array of free-form tag strings', required: false },
      { name: 'toColumnId', type: 'string' as const, description: 'Destination column id (for move_task)', required: false },
      { name: 'toPosition', type: 'number' as const, description: 'Destination position within the column (for move_task)', required: false },

      { name: 'eventType', type: 'string' as const, description: 'Event type (for comment/add_event)', required: false,
        enum: ['commented', 'updated', 'reopened', 'completed'] },
      { name: 'message', type: 'string' as const, description: 'Comment / event message', required: false },
      { name: 'limit', type: 'number' as const, description: 'Maximum events to return (for list_events)', required: false },

      { name: 'goal', type: 'string' as const, description: 'High-level goal description (for plan_from_goal)', required: false },
      { name: 'candidates', type: 'array' as const, description: 'Pre-decomposed tasks (for plan_from_goal)', required: false },
    ],
    requiresApproval: false,
    dangerous: false,
    examples: [
      { title: 'Create a board with default columns',
        input: { operation: 'create_board', boardName: 'Q3 Roadmap' } },
      { title: 'Plan a project into tasks',
        input: {
          operation: 'plan_from_goal', boardId: '<board-id>',
          goal: 'Ship a CLI tool that exports CSV',
          candidates: [
            { title: 'Design CSV schema', priority: 'medium' },
            { title: 'Implement exporter', priority: 'high' },
            { title: 'Write tests', priority: 'medium' },
          ],
        } },
      { title: 'Move a task forward',
        input: { operation: 'move_task', taskId: '<task-id>', toColumnId: '<in-progress-column-id>' } },
      { title: 'Assign a task to a specific agent',
        input: { operation: 'assign_task', taskId: '<task-id>', assigneeAgentId: '<agent-id>' } },
    ] as unknown as SkillExample[],
  };
}

interface KanbanRepoLike {
  listBoards(): KanbanBoard[];
  findBoardById(id: string): KanbanBoard | null;
  createBoard(input: { name: string; description?: string; color?: string; teamId?: string; ownerAgentId?: string },
    options?: { withDefaultColumns?: boolean }): KanbanBoard;
  updateBoard(id: string, partial: Partial<KanbanBoard>): KanbanBoard | null;
  deleteBoard(id: string): boolean;

  listColumns(boardId: string): KanbanColumn[];
  findColumnById(id: string): KanbanColumn | null;
  createColumn(input: { boardId: string; name: string; status?: KanbanTaskStatus; position?: number; wipLimit?: number }): KanbanColumn;
  updateColumn(id: string, partial: Partial<KanbanColumn>): KanbanColumn | null;
  deleteColumn(id: string): boolean;
  reorderColumns(boardId: string, orderedIds: string[]): KanbanColumn[];

  listTasksByBoard(boardId: string): KanbanTask[];
  listTasksByColumn(columnId: string): KanbanTask[];
  listTasksByAssignee(agentId: string): KanbanTask[];
  findTaskById(id: string): KanbanTask | null;
  createTask(input: {
    boardId: string; columnId: string; title: string;
    description?: string; status?: KanbanTaskStatus; priority?: KanbanTaskPriority;
    assigneeAgentId?: string; creatorAgentId?: string; dueDate?: number;
    parentTaskId?: string; tags?: string[]; position?: number;
  }): KanbanTask;
  updateTask(id: string, partial: Partial<KanbanTask>): KanbanTask | null;
  moveTask(id: string, toColumnId: string, toPosition?: number): KanbanTask | null;
  deleteTask(id: string): boolean;

  listEventsByTask(taskId: string): KanbanTaskEvent[];
  listEventsByBoard(boardId: string, limit?: number): KanbanTaskEvent[];
  addEvent(input: {
    taskId: string; boardId: string; eventType: KanbanTaskEventType;
    fromColumnId?: string; toColumnId?: string; agentId?: string;
    message?: string; metadata?: Record<string, unknown>;
  }): KanbanTaskEvent;
}

interface AgentLookup {
  findById(id: string): { id: string; name: string } | null;
  findAll(): Array<{ id: string; name: string }>;
}

function clampStatus(v: unknown, fallback: KanbanTaskStatus): KanbanTaskStatus {
  return typeof v === 'string' && (STATUS_VALUES as string[]).includes(v) ? (v as KanbanTaskStatus) : fallback;
}

function clampPriority(v: unknown, fallback: KanbanTaskPriority): KanbanTaskPriority {
  return typeof v === 'string' && (PRIORITY_VALUES as string[]).includes(v) ? (v as KanbanTaskPriority) : fallback;
}

function clampEventType(v: unknown, fallback: KanbanTaskEventType = 'commented'): KanbanTaskEventType {
  return typeof v === 'string' && (EVENT_VALUES as string[]).includes(v) ? (v as KanbanTaskEventType) : fallback;
}

function summary(text: string, data?: Record<string, unknown>): SkillResult {
  return { success: true, output: text, data };
}

function errResult(msg: string): SkillResult {
  return { success: false, output: '', error: msg };
}

function requireRepo(repo: KanbanRepoLike | undefined): KanbanRepoLike {
  if (!repo) {
    throw new Error('Kanban repository not available. Pass ctx.kanbanRepo when executing this skill.');
  }
  return repo;
}

function boardLine(b: KanbanBoard): string {
  return `- [${b.id}] ${b.name}${b.description ? ` — ${b.description}` : ''} (updated ${new Date(b.updatedAt).toISOString()})`;
}

function taskLine(t: KanbanTask, columnsById: Map<string, KanbanColumn>): string {
  const col = columnsById.get(t.columnId);
  const colName = col ? col.name : '?';
  const assignee = t.assigneeAgentId ? ` assignee=${t.assigneeAgentId}` : '';
  return `- [${t.id}] (${colName}) ${t.title} [${t.priority}]${assignee}`;
}

export const kanbanOpsSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'kanban_ops',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: [
              'list_boards', 'get_board', 'create_board', 'update_board', 'delete_board',
              'list_columns', 'create_column', 'update_column', 'delete_column', 'reorder_columns',
              'list_tasks', 'get_task', 'create_task', 'update_task', 'move_task',
              'assign_task', 'unassign_task', 'delete_task',
              'list_events', 'comment', 'plan_from_goal',
            ] },
            boardId: { type: 'string' },
            boardName: { type: 'string' },
            boardDescription: { type: 'string' },
            boardColor: { type: 'string' },
            teamId: { type: 'string' },
            ownerAgentId: { type: 'string' },
            withDefaultColumns: { type: 'boolean' },
            columnId: { type: 'string' },
            columnName: { type: 'string' },
            columnStatus: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done', 'blocked'] },
            columnPosition: { type: 'number' },
            wipLimit: { type: 'number' },
            orderedColumnIds: { type: 'array', items: { type: 'string' } },
            taskId: { type: 'string' },
            taskTitle: { type: 'string' },
            taskDescription: { type: 'string' },
            taskPriority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            taskStatus: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done', 'blocked'] },
            assigneeAgentId: { type: 'string' },
            creatorAgentId: { type: 'string' },
            dueDate: { type: 'number' },
            parentTaskId: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            toColumnId: { type: 'string' },
            toPosition: { type: 'number' },
            eventType: { type: 'string', enum: ['commented', 'updated', 'reopened', 'completed'] },
            message: { type: 'string' },
            limit: { type: 'number' },
            goal: { type: 'string' },
            candidates: { type: 'array' },
          },
          required: ['operation'],
        },
      },
    };
  },

  async execute(rawArgs, ctx): Promise<SkillResult> {
    const args = (rawArgs ?? {}) as unknown as KanbanOpsArgs;
    if (!args.operation || typeof args.operation !== 'string') {
      return errResult('Parameter "operation" is required.');
    }
    let repo: KanbanRepoLike;
    try {
      repo = requireRepo(ctx.kanbanRepo as KanbanRepoLike | undefined);
    } catch (e) {
      return errResult((e as Error).message);
    }
    const agentsLookup = ctx.agentsRepo as AgentLookup | undefined;

    switch (args.operation) {
      case 'list_boards': {
        const boards = repo.listBoards();
        const list = boards.length ? boards.map(boardLine).join('\n') : '(no boards yet)';
        return summary(`Found ${boards.length} board(s):\n${list}`, { count: boards.length, boards });
      }
      case 'get_board': {
        if (!args.boardId) return errResult('boardId is required.');
        const board = repo.findBoardById(args.boardId);
        if (!board) return errResult(`Board not found: ${args.boardId}`);
        const columns = repo.listColumns(board.id);
        const tasks = repo.listTasksByBoard(board.id);
        const colById = new Map(columns.map((c) => [c.id, c]));
        const taskList = tasks.map((t) => taskLine(t, colById)).join('\n');
        const colsList = columns.map((c) => `- [${c.id}] ${c.name} (status=${c.status}, position=${c.position})`).join('\n');
        return summary(
          `Board "${board.name}":\nColumns:\n${colsList || '(no columns)'}\nTasks:\n${taskList || '(no tasks)'}`,
          { board, columns, tasks },
        );
      }
      case 'create_board': {
        if (!args.boardName) return errResult('boardName is required.');
        const created = repo.createBoard({
          name: String(args.boardName).trim(),
          description: args.boardDescription?.trim() || undefined,
          color: args.boardColor || undefined,
          teamId: args.teamId || undefined,
          ownerAgentId: args.ownerAgentId || ctx.agent.id,
        }, { withDefaultColumns: args.withDefaultColumns !== false });
        return summary(`Created board "${created.name}" with id=${created.id}`, { board: created });
      }
      case 'update_board': {
        if (!args.boardId) return errResult('boardId is required.');
        const update: Partial<KanbanBoard> = {};
        if (args.boardName !== undefined) update.name = String(args.boardName);
        if (args.boardDescription !== undefined) update.description = args.boardDescription;
        if (args.boardColor !== undefined) update.color = args.boardColor;
        if (args.teamId !== undefined) update.teamId = args.teamId;
        if (args.ownerAgentId !== undefined) update.ownerAgentId = args.ownerAgentId;
        const updated = repo.updateBoard(args.boardId, update);
        if (!updated) return errResult(`Board not found: ${args.boardId}`);
        return summary(`Updated board ${updated.id}`, { board: updated });
      }
      case 'delete_board': {
        if (!args.boardId) return errResult('boardId is required.');
        const ok = repo.deleteBoard(args.boardId);
        return summary(ok ? 'Board deleted.' : 'Board not found.', { deleted: ok });
      }
      case 'list_columns': {
        if (!args.boardId) return errResult('boardId is required.');
        const cols = repo.listColumns(args.boardId);
        const list = cols.map((c) => `- [${c.id}] ${c.name} (status=${c.status}, position=${c.position})`).join('\n');
        return summary(`Columns (${cols.length}):\n${list || '(none)'}`, { columns: cols });
      }
      case 'create_column': {
        if (!args.boardId) return errResult('boardId is required.');
        if (!args.columnName) return errResult('columnName is required.');
        const created = repo.createColumn({
          boardId: args.boardId,
          name: String(args.columnName).trim(),
          status: clampStatus(args.columnStatus, 'todo'),
          position: typeof args.columnPosition === 'number' ? args.columnPosition : undefined,
          wipLimit: typeof args.wipLimit === 'number' ? args.wipLimit : undefined,
        });
        return summary(`Created column "${created.name}" (id=${created.id}).`, { column: created });
      }
      case 'update_column': {
        if (!args.columnId) return errResult('columnId is required.');
        const update: Partial<KanbanColumn> = {};
        if (args.columnName !== undefined) update.name = String(args.columnName);
        if (args.columnStatus !== undefined) update.status = clampStatus(args.columnStatus, 'todo');
        if (args.columnPosition !== undefined && typeof args.columnPosition === 'number') {
          update.position = args.columnPosition;
        }
        if (args.wipLimit !== undefined) update.wipLimit = typeof args.wipLimit === 'number' ? args.wipLimit : undefined;
        const updated = repo.updateColumn(args.columnId, update);
        if (!updated) return errResult(`Column not found: ${args.columnId}`);
        return summary(`Updated column ${updated.id}`, { column: updated });
      }
      case 'delete_column': {
        if (!args.columnId) return errResult('columnId is required.');
        const ok = repo.deleteColumn(args.columnId);
        return summary(ok ? 'Column deleted.' : 'Column not found.', { deleted: ok });
      }
      case 'reorder_columns': {
        if (!args.boardId) return errResult('boardId is required.');
        if (!Array.isArray(args.orderedColumnIds)) return errResult('orderedColumnIds is required.');
        const cols = repo.reorderColumns(args.boardId, args.orderedColumnIds.map((s) => String(s)));
        return summary(`Reordered ${cols.length} column(s).`, { columns: cols });
      }
      case 'list_tasks': {
        let tasks: KanbanTask[] = [];
        if (args.columnId) tasks = repo.listTasksByColumn(args.columnId);
        else if (args.assigneeAgentId) tasks = repo.listTasksByAssignee(args.assigneeAgentId);
        else if (args.boardId) tasks = repo.listTasksByBoard(args.boardId);
        else return errResult('One of boardId, columnId, or assigneeAgentId is required.');

        const colIds = Array.from(new Set(tasks.map((t) => t.columnId)));
        const cols = colIds
          .map((id) => repo.findColumnById(id))
          .filter((c): c is KanbanColumn => !!c);
        const colById = new Map(cols.map((c) => [c.id, c]));
        const list = tasks.map((t) => taskLine(t, colById)).join('\n');
        return summary(`Tasks (${tasks.length}):\n${list || '(none)'}`, { tasks });
      }
      case 'get_task': {
        if (!args.taskId) return errResult('taskId is required.');
        const task = repo.findTaskById(args.taskId);
        if (!task) return errResult(`Task not found: ${args.taskId}`);
        const events = repo.listEventsByTask(task.id);
        return summary(
          `Task "${task.title}" (priority=${task.priority}, status=${task.status}, assignee=${task.assigneeAgentId ?? 'unassigned'}):\n${events.map((e) => `  · [${e.eventType}] ${e.message ?? ''} (${new Date(e.createdAt).toISOString()})`).join('\n') || '(no events yet)'}`,
          { task, events },
        );
      }
      case 'create_task': {
        if (!args.boardId) return errResult('boardId is required.');
        if (!args.columnId) return errResult('columnId is required.');
        if (!args.taskTitle) return errResult('taskTitle is required.');
        const created = repo.createTask({
          boardId: args.boardId,
          columnId: args.columnId,
          title: String(args.taskTitle).trim(),
          description: args.taskDescription,
          status: clampStatus(args.taskStatus, 'todo'),
          priority: clampPriority(args.taskPriority, 'medium'),
          assigneeAgentId: args.assigneeAgentId,
          creatorAgentId: args.creatorAgentId ?? ctx.agent.id,
          dueDate: typeof args.dueDate === 'number' ? args.dueDate : undefined,
          parentTaskId: args.parentTaskId,
          tags: Array.isArray(args.tags) ? args.tags.filter((t) => typeof t === 'string') : undefined,
        });
        return summary(`Created task "${created.title}" (id=${created.id}).`, { task: created });
      }
      case 'update_task': {
        if (!args.taskId) return errResult('taskId is required.');
        const update: Partial<KanbanTask> = {};
        if (args.taskTitle !== undefined) update.title = String(args.taskTitle);
        if (args.taskDescription !== undefined) update.description = args.taskDescription;
        if (args.taskPriority !== undefined) update.priority = clampPriority(args.taskPriority, 'medium');
        if (args.taskStatus !== undefined) update.status = clampStatus(args.taskStatus, 'todo');
        if (args.dueDate !== undefined && typeof args.dueDate === 'number') update.dueDate = args.dueDate;
        if (args.parentTaskId !== undefined) update.parentTaskId = args.parentTaskId;
        if (args.tags !== undefined) update.tags = Array.isArray(args.tags) ? args.tags.filter((t) => typeof t === 'string') : [];
        if (args.assigneeAgentId !== undefined) update.assigneeAgentId = args.assigneeAgentId;
        const updated = repo.updateTask(args.taskId, update);
        if (!updated) return errResult(`Task not found: ${args.taskId}`);
        return summary(`Updated task "${updated.title}".`, { task: updated });
      }
      case 'move_task': {
        if (!args.taskId) return errResult('taskId is required.');
        if (!args.toColumnId) return errResult('toColumnId is required.');
        const moved = repo.moveTask(args.taskId, args.toColumnId, typeof args.toPosition === 'number' ? args.toPosition : undefined);
        if (!moved) return errResult(`Failed to move task ${args.taskId}.`);
        const targetCol = repo.findColumnById(moved.columnId);
        return summary(`Moved task "${moved.title}" to "${targetCol?.name ?? moved.columnId}".`, { task: moved });
      }
      case 'assign_task': {
        if (!args.taskId) return errResult('taskId is required.');
        if (!args.assigneeAgentId) return errResult('assigneeAgentId is required.');
        const updated = repo.updateTask(args.taskId, { assigneeAgentId: args.assigneeAgentId });
        if (!updated) return errResult(`Task not found: ${args.taskId}`);
        let assigneeName = args.assigneeAgentId;
        if (agentsLookup) {
          const a = agentsLookup.findById(args.assigneeAgentId);
          if (a) assigneeName = `${a.name} (${a.id})`;
        }
        return summary(`Assigned task "${updated.title}" to ${assigneeName}.`, { task: updated });
      }
      case 'unassign_task': {
        if (!args.taskId) return errResult('taskId is required.');
        const updated = repo.updateTask(args.taskId, { assigneeAgentId: undefined });
        if (!updated) return errResult(`Task not found: ${args.taskId}`);
        return summary(`Unassigned task "${updated.title}".`, { task: updated });
      }
      case 'delete_task': {
        if (!args.taskId) return errResult('taskId is required.');
        const ok = repo.deleteTask(args.taskId);
        return summary(ok ? 'Task deleted.' : 'Task not found.', { deleted: ok });
      }
      case 'list_events': {
        type EventInfo = { id: string; taskId?: string; eventType: KanbanTaskEventType; message?: string; agentId?: string; createdAt: number };
        let events: EventInfo[];
        if (args.taskId) events = repo.listEventsByTask(args.taskId);
        else if (args.boardId) events = repo.listEventsByBoard(args.boardId, typeof args.limit === 'number' ? args.limit : undefined);
        else return errResult('boardId or taskId is required.');
        const list = events.map((e) => `  · ${new Date(e.createdAt).toISOString()} [${e.eventType}] ${e.message ?? ''} (agent=${e.agentId ?? 'user'})`).join('\n');
        return summary(`Events (${events.length}):\n${list || '(none)'}`, { events });
      }
      case 'comment': {
        if (!args.taskId) return errResult('taskId is required.');
        if (!args.boardId) return errResult('boardId is required.');
        if (!args.message) return errResult('message is required.');
        const ev = repo.addEvent({
          taskId: args.taskId,
          boardId: args.boardId,
          eventType: clampEventType(args.eventType, 'commented'),
          agentId: ctx.agent.id,
          message: args.message,
          metadata: { fromAgentName: ctx.agent.name },
        });
        return summary(`Comment added to task ${args.taskId}.`, { event: ev });
      }
      case 'plan_from_goal': {
        if (!args.boardId) return errResult('boardId is required.');
        const columns = repo.listColumns(args.boardId);
        if (columns.length === 0) return errResult('Board has no columns. Add columns before planning tasks.');
        const todoCol =
          columns.find((c) => c.status === 'todo' || /todo|backlog/i.test(c.name)) ??
          columns[0];

        const candidates = Array.isArray(args.candidates) ? args.candidates : [];
        if (candidates.length === 0) {
          return errResult('Provide at least one candidate task in "candidates" (title required for each).');
        }

        const created: KanbanTask[] = [];
        const unresolved: Array<{ index: number; reason: string }> = [];
        candidates.forEach((cand, idx) => {
          if (!cand.title || typeof cand.title !== 'string') {
            unresolved.push({ index: idx, reason: 'missing title' });
            return;
          }
          let assigneeId = cand.assigneeAgentId;
          if (!assigneeId && cand.assigneeName && agentsLookup) {
            const match = agentsLookup.findAll().find((a) => a.name.toLowerCase() === cand.assigneeName!.toLowerCase());
            if (match) assigneeId = match.id;
          }
          if (cand.assigneeAgentId && !assigneeId) {
            unresolved.push({ index: idx, reason: `assignee id ${cand.assigneeAgentId} not found` });
          }
          const task = repo.createTask({
            boardId: args.boardId!,
            columnId: todoCol.id,
            title: String(cand.title).trim(),
            description: cand.description,
            priority: clampPriority(cand.priority, 'medium'),
            assigneeAgentId: assigneeId,
            creatorAgentId: ctx.agent.id,
            tags: Array.isArray(cand.tags) ? cand.tags : undefined,
          });
          created.push(task);
        });

        const lines = created.map((t) => `- ${t.title} (id=${t.id}${t.assigneeAgentId ? ` → ${t.assigneeAgentId}` : ''})`).join('\n');
        const unresolvedLine = unresolved.length
          ? `\n\nUnresolved candidates: ${unresolved.map((u) => `[#${u.index} ${u.reason}]`).join(', ')}`
          : '';
        return summary(
          `Planned ${created.length} task(s) into "${todoCol.name}":\n${lines}${unresolvedLine}` +
          (args.goal ? `\n\nGoal: ${args.goal}` : ''),
          { created, unresolved, column: todoCol },
        );
      }
      default:
        return errResult(`Unhandled operation: ${args.operation}`);
    }
  },
};

export default kanbanOpsSkill;
