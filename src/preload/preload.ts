/**
 * Preload script — runs in an isolated privileged context with access to
 * Electron's `contextBridge` and `ipcRenderer`. It exposes a narrow,
 * fully-typed API surface to the sandboxed renderer through
 * `window.officeAPI` and `window.office`.
 *
 * Design rules:
 *   - The renderer (contextIsolation=true, nodeIntegration=false) must NEVER
 *     touch `ipcRenderer` directly; everything goes through this file.
 *   - Every invoke returns `Promise<ApiResponse<T>>` so the renderer can
 *     uniformly handle success/error.
 *   - Every event subscriber returns an `Unsubscribe` function.
 *   - We never expose raw channel names or `ipcRenderer` to the renderer.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import {
  IPC_CHANNELS,
  RENDERER_EVENT_CHANNELS,
} from '../shared/types';
import type {
  Agent,
  AppSettings,
  ChatRoom,
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  KanbanTaskEvent,
  LLMTool,
  LLMProvider,
  Memory,
  Message,
  Skill,
  Team,
  Workspace,
  WorkspaceFile,
} from '../shared/types';
import type { ApiResponse } from '../shared/types';
import type {
  ChatSendArgs,
  OfficeAPI,
  OfficeGlobals,
  OrchestratorEventMap,
  OrchestratorEventType,
  OrchestratorRendererEvent,
  LLMPresetsPayload,
  TerminalCreateArgs,
  TerminalDataEvent,
  TerminalExitEvent,
  Unsubscribe,
} from './api';
import type { SkillManifest } from '../shared/skills-schema';

/* -------------------------------------------------------------------------- */
/*  Local helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Generic typed wrapper around `ipcRenderer.invoke`. We pass through whatever
 * the main process returns into our `ApiResponse<T>` shape — if main already
 * returns `ApiResponse<T>`, we forward it as-is; otherwise we wrap the raw
 * value in `{ success: true, data }`.
 */
async function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<ApiResponse<T>> {
  try {
    const raw = (await ipcRenderer.invoke(channel, ...args)) as unknown;
    if (raw && typeof raw === 'object' && 'success' in (raw as Record<string, unknown>)) {
      return raw as ApiResponse<T>;
    }
    return { success: true, data: raw as T };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Normalize "either a positional pair or a structured args object" inputs. */
function pairOrArgs(
  a: string | { teamId?: string; chatRoomId?: string; agentId?: string } | undefined,
  b: string | undefined,
  key1: 'teamId' | 'chatRoomId',
): { first: string; second: string } {
  if (typeof a === 'string') {
    return { first: a, second: typeof b === 'string' ? b : '' };
  }
  const obj = a ?? {};
  return { first: obj[key1] ?? '', second: obj.agentId ?? '' };
}

function getAgentId(a: string | { agentId?: string } | Agent): string {
  if (typeof a === 'string') return a;
  if ('agentId' in a && typeof (a as { agentId?: string }).agentId === 'string') {
    return (a as { agentId: string }).agentId;
  }
  return (a as Agent).id;
}

/* -------------------------------------------------------------------------- */
/*  OfficeAPI — the exposed object                                            */
/* -------------------------------------------------------------------------- */

const officeAPI: OfficeAPI = {
  /* ----------------------------- LLM ----------------------------- */
  llm: {
    list() {
      return invoke<LLMProvider[]>(IPC_CHANNELS.LLM.LIST);
    },
    get(id) {
      return invoke<LLMProvider | null>(IPC_CHANNELS.LLM.GET, id);
    },
    create(input) {
      return invoke<LLMProvider>(IPC_CHANNELS.LLM.CREATE, input);
    },
    update(id, partial) {
      return invoke<LLMProvider | null>(IPC_CHANNELS.LLM.UPDATE, id, partial);
    },
    delete(id) {
      return invoke<boolean>(IPC_CHANNELS.LLM.DELETE, id);
    },
    setDefault(id) {
      return invoke<boolean>(IPC_CHANNELS.LLM.SET_DEFAULT, id);
    },
    test(args) {
      const payload = typeof args === 'string' ? { providerId: args } : args;
      return invoke<{ success: boolean; message: string; latencyMs: number }>(
        IPC_CHANNELS.LLM.TEST,
        payload,
      );
    },
    listModels(args) {
      const payload = typeof args === 'string' ? { providerId: args } : args;
      return invoke<string[]>(IPC_CHANNELS.LLM.LIST_MODELS, payload);
    },
    presets() {
      return invoke<LLMPresetsPayload>(IPC_CHANNELS.LLM.PRESETS);
    },
  },

  /* ----------------------------- Agents --------------------------- */
  agents: {
    list() {
      return invoke<Agent[]>(IPC_CHANNELS.AGENT.LIST);
    },
    get(id) {
      return invoke<Agent | null>(IPC_CHANNELS.AGENT.GET, id);
    },
    create(input) {
      return invoke<Agent>(IPC_CHANNELS.AGENT.CREATE, input);
    },
    update(id, partial) {
      return invoke<Agent | null>(IPC_CHANNELS.AGENT.UPDATE, id, partial);
    },
    delete(id) {
      return invoke<boolean>(IPC_CHANNELS.AGENT.DELETE, id);
    },
    setSkills(id, skills) {
      return invoke<Agent | null>(IPC_CHANNELS.AGENT.SET_SKILLS, id, skills);
    },
  },

  /* ----------------------------- Teams ---------------------------- */
  teams: {
    list() {
      return invoke<Team[]>(IPC_CHANNELS.TEAM.LIST);
    },
    get(id) {
      return invoke<Team | null>(IPC_CHANNELS.TEAM.GET, id);
    },
    create(input) {
      return invoke<Team>(IPC_CHANNELS.TEAM.CREATE, input);
    },
    update(id, partial) {
      return invoke<Team | null>(IPC_CHANNELS.TEAM.UPDATE, id, partial);
    },
    delete(id) {
      return invoke<boolean>(IPC_CHANNELS.TEAM.DELETE, id);
    },
    addAgent(a, b) {
      const { first, second } = pairOrArgs(a, b, 'teamId');
      return invoke<boolean>(IPC_CHANNELS.TEAM.ADD_AGENT, { teamId: first, agentId: second });
    },
    removeAgent(a, b) {
      const { first, second } = pairOrArgs(a, b, 'teamId');
      return invoke<boolean>(IPC_CHANNELS.TEAM.REMOVE_AGENT, { teamId: first, agentId: second });
    },
  },

  /* ----------------------------- Chatrooms ------------------------ */
  chatrooms: {
    list() {
      return invoke<ChatRoom[]>(IPC_CHANNELS.CHATROOM.LIST);
    },
    get(id) {
      return invoke<ChatRoom | null>(IPC_CHANNELS.CHATROOM.GET, id);
    },
    create(input) {
      return invoke<ChatRoom>(IPC_CHANNELS.CHATROOM.CREATE, input);
    },
    update(id, partial) {
      return invoke<ChatRoom | null>(IPC_CHANNELS.CHATROOM.UPDATE, id, partial);
    },
    delete(id) {
      return invoke<boolean>(IPC_CHANNELS.CHATROOM.DELETE, id);
    },
    addAgent(a, b) {
      const { first, second } = pairOrArgs(a, b, 'chatRoomId');
      return invoke<boolean>(IPC_CHANNELS.CHATROOM.ADD_AGENT, { chatRoomId: first, agentId: second });
    },
    removeAgent(a, b) {
      const { first, second } = pairOrArgs(a, b, 'chatRoomId');
      return invoke<boolean>(IPC_CHANNELS.CHATROOM.REMOVE_AGENT, { chatRoomId: first, agentId: second });
    },
    setAgents(args) {
      return invoke<boolean>(IPC_CHANNELS.CHATROOM.SET_AGENTS, args);
    },
    getOrCreateDirect(args) {
      return invoke<ChatRoom>(IPC_CHANNELS.CHATROOM.GET_OR_CREATE_DIRECT, args);
    },
  },

  /* ----------------------------- Messages ------------------------- */
  messages: {
    list(args) {
      return invoke<Message[]>(IPC_CHANNELS.MESSAGE.LIST, args);
    },
    get(id) {
      return invoke<Message | null>(IPC_CHANNELS.MESSAGE.GET, id);
    },
    create(input) {
      return invoke<Message>(IPC_CHANNELS.MESSAGE.CREATE, input);
    },
    delete(id) {
      return invoke<boolean>(IPC_CHANNELS.MESSAGE.DELETE, id);
    },
    clear(args) {
      return invoke<number>(IPC_CHANNELS.MESSAGE.CLEAR, args);
    },
    search(args) {
      return invoke<Message[]>(IPC_CHANNELS.MESSAGE.SEARCH, args);
    },
  },

  /* ----------------------------- Chat ----------------------------- */
  chat: {
    send(args: ChatSendArgs) {
      return invoke<Message>(IPC_CHANNELS.CHAT.SEND, args);
    },
    stream(args: ChatSendArgs) {
      return invoke<Message>(IPC_CHANNELS.CHAT.STREAM, args);
    },
    cancel(chatRoomId?: string) {
      return invoke<void>(IPC_CHANNELS.CHAT.CANCEL, chatRoomId);
    },
  },

  /* ----------------------------- Memories ------------------------- */
  memories: {
    list(args) {
      return invoke<Memory[]>(IPC_CHANNELS.MEMORY.LIST, args);
    },
    get(id) {
      return invoke<Memory | null>(IPC_CHANNELS.MEMORY.GET, id);
    },
    create(input) {
      return invoke<Memory>(IPC_CHANNELS.MEMORY.CREATE, input);
    },
    update(id, partial) {
      return invoke<Memory | null>(IPC_CHANNELS.MEMORY.UPDATE, id, partial);
    },
    delete(id) {
      return invoke<boolean>(IPC_CHANNELS.MEMORY.DELETE, id);
    },
    deleteAll(args) {
      return invoke<number>(IPC_CHANNELS.MEMORY.DELETE_ALL, args);
    },
    pin(id) {
      return invoke<Memory | null>(IPC_CHANNELS.MEMORY.PIN, id);
    },
    unpin(id) {
      return invoke<Memory | null>(IPC_CHANNELS.MEMORY.UNPIN, id);
    },
    search(args) {
      return invoke<Memory[]>(IPC_CHANNELS.MEMORY.SEARCH, args);
    },
    consolidate(args) {
      return invoke<import('../shared/types').ConversationSummary | null>(IPC_CHANNELS.MEMORY.CONSOLIDATE, args);
    },
    extract(args) {
      return invoke<Memory[]>(IPC_CHANNELS.MEMORY.EXTRACT, args);
    },
  },

  /* ----------------------------- Skills --------------------------- */
  skills: {
    list() {
      return invoke<Skill[]>(IPC_CHANNELS.SKILL.LIST);
    },
    get(name) {
      return invoke<Skill | null>(IPC_CHANNELS.SKILL.GET, name);
    },
    getTools(args) {
      return invoke<LLMTool[]>(IPC_CHANNELS.SKILL.GET_TOOLS, {
        agentId: getAgentId(args),
      });
    },
    create(input) {
      return invoke<SkillManifest>(IPC_CHANNELS.SKILL.CREATE, input);
    },
    update(name, partial) {
      return invoke<SkillManifest | null>(IPC_CHANNELS.SKILL.UPDATE, name, partial);
    },
    delete(name) {
      return invoke<boolean>(IPC_CHANNELS.SKILL.DELETE, name);
    },
    test(args) {
      return invoke<{
        success: boolean;
        output: string;
        error?: string;
        durationMs: number;
      }>(IPC_CHANNELS.SKILL.TEST, args);
    },
    listUser() {
      return invoke<Awaited<ReturnType<OfficeAPI['skills']['listUser']>> extends ApiResponse<infer T> ? T : never>(
        IPC_CHANNELS.SKILL.LIST_USER,
      );
    },
    getUser(name) {
      return invoke<Awaited<ReturnType<OfficeAPI['skills']['getUser']>> extends ApiResponse<infer T> ? T : never>(
        IPC_CHANNELS.SKILL.GET_USER,
        name,
      );
    },
  },

  /* ----------------------------- Terminal ------------------------- */
  terminal: {
    create(args: TerminalCreateArgs) {
      return invoke<{ sessionId: string }>(IPC_CHANNELS.TERMINAL.CREATE, args);
    },
    write(args) {
      return invoke<void>(IPC_CHANNELS.TERMINAL.WRITE, args);
    },
    resize(args) {
      return invoke<void>(IPC_CHANNELS.TERMINAL.RESIZE, args);
    },
    kill(sessionId) {
      return invoke<void>(IPC_CHANNELS.TERMINAL.KILL, sessionId);
    },
  },

  /* ----------------------------- Workspace ------------------------ */
  workspace: {
    list() {
      return invoke<Workspace[]>(IPC_CHANNELS.WORKSPACE.LIST);
    },
    getDefault() {
      return invoke<Workspace | null>(IPC_CHANNELS.WORKSPACE.GET_DEFAULT);
    },
    create(input) {
      return invoke<Workspace>(IPC_CHANNELS.WORKSPACE.CREATE, input);
    },
    update(id, partial) {
      return invoke<Workspace | null>(IPC_CHANNELS.WORKSPACE.UPDATE, id, partial);
    },
    delete(id) {
      return invoke<boolean>(IPC_CHANNELS.WORKSPACE.DELETE, id);
    },
    setDefault(id) {
      return invoke<boolean>(IPC_CHANNELS.WORKSPACE.SET_DEFAULT, id);
    },
    listFiles(workspaceId) {
      return invoke<WorkspaceFile[]>(IPC_CHANNELS.WORKSPACE.LIST_FILES, workspaceId);
    },
    readFile(a) {
      const payload = typeof a === 'string' ? { path: a } : a;
      return invoke<string>(IPC_CHANNELS.WORKSPACE.READ_FILE, payload);
    },
    openInOs(a) {
      const payload = typeof a === 'string' ? { path: a } : a;
      return invoke<void>(IPC_CHANNELS.WORKSPACE.OPEN_IN_OS, payload);
    },
  },

  /* ----------------------------- Settings ------------------------- */
  settings: {
    getAll() {
      return invoke<Record<string, unknown>>(IPC_CHANNELS.SETTINGS.GET_ALL);
    },
    getApp() {
      return invoke<AppSettings>(IPC_CHANNELS.SETTINGS.GET_APP);
    },
    saveApp(partial) {
      return invoke<AppSettings>(IPC_CHANNELS.SETTINGS.SAVE_APP, partial);
    },
    get(key) {
      return invoke<unknown>(IPC_CHANNELS.SETTINGS.GET, key);
    },
    set(args) {
      return invoke<void>(IPC_CHANNELS.SETTINGS.SET, args);
    },
    delete(key) {
      return invoke<void>(IPC_CHANNELS.SETTINGS.DELETE, key);
    },
  },

  /* ----------------------------- System --------------------------- */
  system: {
    getInfo() {
      return invoke<import('./api').SystemInfo>(IPC_CHANNELS.SYSTEM.GET_INFO);
    },
    openExternal(args) {
      return invoke<void>(IPC_CHANNELS.SYSTEM.OPEN_EXTERNAL, args);
    },
    getLocalhostUrl() {
      return invoke<string>(IPC_CHANNELS.SYSTEM.GET_LOCALHOST_URL);
    },
  },

  /* ----------------------------- App ------------------------------ */
  app: {
    quit() {
      return invoke<void>(IPC_CHANNELS.APP.QUIT);
    },
    minimize() {
      return invoke<void>(IPC_CHANNELS.APP.MINIMIZE);
    },
    maximize() {
      return invoke<void>(IPC_CHANNELS.APP.MAXIMIZE);
    },
    toggleDevTools() {
      return invoke<void>(IPC_CHANNELS.APP.TOGGLE_DEVTOOLS);
    },
  },

  /* ----------------------------- Kanban --------------------------- */
  kanban: {
    listBoards() {
      return invoke<KanbanBoard[]>(IPC_CHANNELS.KANBAN.LIST_BOARDS);
    },
    getBoard(id) {
      return invoke<KanbanBoard | null>(IPC_CHANNELS.KANBAN.GET_BOARD, id);
    },
    createBoard(input) {
      return invoke<KanbanBoard>(IPC_CHANNELS.KANBAN.CREATE_BOARD, input);
    },
    updateBoard(id, partial) {
      return invoke<KanbanBoard | null>(IPC_CHANNELS.KANBAN.UPDATE_BOARD, id, partial);
    },
    deleteBoard(id) {
      return invoke<boolean>(IPC_CHANNELS.KANBAN.DELETE_BOARD, id);
    },

    listColumns(boardId) {
      return invoke<KanbanColumn[]>(IPC_CHANNELS.KANBAN.LIST_COLUMNS, boardId);
    },
    createColumn(input) {
      return invoke<KanbanColumn>(IPC_CHANNELS.KANBAN.CREATE_COLUMN, input);
    },
    updateColumn(id, partial) {
      return invoke<KanbanColumn | null>(IPC_CHANNELS.KANBAN.UPDATE_COLUMN, id, partial);
    },
    deleteColumn(id) {
      return invoke<boolean>(IPC_CHANNELS.KANBAN.DELETE_COLUMN, id);
    },
    reorderColumns(args) {
      return invoke<KanbanColumn[]>(IPC_CHANNELS.KANBAN.REORDER_COLUMNS, args);
    },

    listTasks(args) {
      return invoke<KanbanTask[]>(IPC_CHANNELS.KANBAN.LIST_TASKS, args);
    },
    getTask(id) {
      return invoke<KanbanTask | null>(IPC_CHANNELS.KANBAN.GET_TASK, id);
    },
    createTask(input) {
      return invoke<KanbanTask>(IPC_CHANNELS.KANBAN.CREATE_TASK, input);
    },
    updateTask(id, partial) {
      return invoke<KanbanTask | null>(IPC_CHANNELS.KANBAN.UPDATE_TASK, id, partial);
    },
    moveTask(args) {
      return invoke<KanbanTask | null>(IPC_CHANNELS.KANBAN.MOVE_TASK, args);
    },
    deleteTask(id) {
      return invoke<boolean>(IPC_CHANNELS.KANBAN.DELETE_TASK, id);
    },

    listEvents(args) {
      return invoke<KanbanTaskEvent[]>(IPC_CHANNELS.KANBAN.LIST_EVENTS, args);
    },
    addEvent(input) {
      return invoke<KanbanTaskEvent>(IPC_CHANNELS.KANBAN.ADD_EVENT, input);
    },
  },

  /* ----------------------------- Events --------------------------- */
  events: {
    onOrchestrator(
      a: ((event: OrchestratorRendererEvent) => void) | OrchestratorEventType,
      b?: <K extends OrchestratorEventType>(payload: OrchestratorEventMap[K]) => void,
    ): Unsubscribe {
      if (typeof a === 'function') {
        // 1-arg form: subscribe to all events.
        const handler = a;
        const wrapped = (_evt: IpcRendererEvent, payload: OrchestratorRendererEvent): void => {
          try {
            handler(payload);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[preload] orchestrator handler threw:', err);
          }
        };
        ipcRenderer.on(RENDERER_EVENT_CHANNELS.ORCHESTRATOR, wrapped);
        return () => {
          ipcRenderer.removeListener(RENDERER_EVENT_CHANNELS.ORCHESTRATOR, wrapped);
        };
      }

      // 2-arg form: filter by event type.
      const eventType = a;
      const handler = b as (payload: OrchestratorEventMap[typeof eventType]) => void;
      const wrapped = (
        _evt: IpcRendererEvent,
        payload: OrchestratorRendererEvent,
      ): void => {
        if (!payload || payload.type !== eventType) return;
        try {
          handler(payload.payload);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[preload] orchestrator handler threw:', err);
        }
      };
      ipcRenderer.on(RENDERER_EVENT_CHANNELS.ORCHESTRATOR, wrapped);
      return () => {
        ipcRenderer.removeListener(RENDERER_EVENT_CHANNELS.ORCHESTRATOR, wrapped);
      };
    },

    onTerminalData(handler: (event: TerminalDataEvent) => void): Unsubscribe {
      const wrapped = (_evt: IpcRendererEvent, payload: TerminalDataEvent): void => {
        try {
          handler(payload);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[preload] terminal:data handler threw:', err);
        }
      };
      ipcRenderer.on(RENDERER_EVENT_CHANNELS.TERMINAL_DATA, wrapped);
      return () => {
        ipcRenderer.removeListener(RENDERER_EVENT_CHANNELS.TERMINAL_DATA, wrapped);
      };
    },

    onTerminalExit(handler: (event: TerminalExitEvent) => void): Unsubscribe {
      const wrapped = (_evt: IpcRendererEvent, payload: TerminalExitEvent): void => {
        try {
          handler(payload);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[preload] terminal:exit handler threw:', err);
        }
      };
      ipcRenderer.on(RENDERER_EVENT_CHANNELS.TERMINAL_EXIT, wrapped);
      return () => {
        ipcRenderer.removeListener(RENDERER_EVENT_CHANNELS.TERMINAL_EXIT, wrapped);
      };
    },
  },
};

/* -------------------------------------------------------------------------- */
/*  Static globals                                                            */
/* -------------------------------------------------------------------------- */

const office: OfficeGlobals = {
  platform: process.platform,
  versions: {
    app: '0.0.0',
    electron: process.versions.electron ?? 'unknown',
    node: process.versions.node ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
  },
};

/* -------------------------------------------------------------------------- */
/*  Bridge to renderer                                                        */
/* -------------------------------------------------------------------------- */

contextBridge.exposeInMainWorld('officeAPI', officeAPI);
contextBridge.exposeInMainWorld('office', office);
