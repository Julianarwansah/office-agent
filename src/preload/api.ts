/**
 * OfficeAPI — type contract for the API exposed to the renderer via
 * `contextBridge.exposeInMainWorld('officeAPI', ...)`.
 *
 * The renderer is sandboxed (contextIsolation=true, nodeIntegration=false) and
 * only ever sees this typed surface; it never touches `ipcRenderer` directly.
 *
 * Every method returns `Promise<ApiResponse<T>>`. Methods with no return data
 * resolve to `ApiResponse<void>`. Event subscribers return an `Unsubscribe`.
 *
 * All IPC channel names come from `src/shared/types.ts` (IPC_CHANNELS).
 */

import type {
  Agent,
  AgentSkill,
  ApiResponse,
  AppSettings,
  ChatRoom,
  ConversationSummary,
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  KanbanTaskEvent,
  KanbanTaskEventType,
  KanbanTaskPriority,
  KanbanTaskStatus,
  LLMTool,
  LLMProvider,
  Memory,
  Message,
  Team,
  Workspace,
  WorkspaceFile,
} from '../shared/types';
import type { PresetProviderTemplate, SkillManifest } from '../shared';

/* -------------------------------------------------------------------------- */
/*  Helpers / shared arg shapes                                               */
/* -------------------------------------------------------------------------- */

/** Stop a push subscription. */
export type Unsubscribe = () => void;

/** Args passed to `chat.send` and `chat.stream`. */
export interface ChatSendArgs {
  chatRoomId: string;
  userMessage: string;
  mentionedAgentIds?: string[];
  agentId?: string;
  parentMessageId?: string;
}

/** Args passed to `terminal.create`. */
export interface TerminalCreateArgs {
  cwd?: string;
  shell?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

/** Payload of `terminal:data` events. */
export interface TerminalDataEvent {
  sessionId: string;
  data: string;
}

/** Payload of `terminal:exit` events. */
export interface TerminalExitEvent {
  sessionId: string;
  code: number | null;
  signal?: string;
}

/* -------------------------------------------------------------------------- */
/*  Orchestrator event map (renderer-facing)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Renderer-facing orchestrator event map. Mirrors what the main process emits
 * on the `orchestrator:event` IPC channel.
 *
 * NOTE: The main-process `OrchestratorEventMap` (see `main/orchestrator/types.ts`)
 * is the producer side; this map is the consumer side used by the renderer
 * stores. Payloads here include `chatRoomId` where the renderer needs it to
 * route events to the correct chat room state.
 */
export interface OrchestratorEventMap {
  'agent:start': {
    chatRoomId: string;
    messageId: string;
    agentId: string;
  };
  'agent:thinking': {
    chatRoomId: string;
    agentId: string;
    messageId: string;
  };
  'agent:content': {
    chatRoomId: string;
    messageId: string;
    agentId: string;
    content: string;
    delta: string;
  };
  'agent:tool_call': {
    chatRoomId: string;
    messageId: string;
    agentId: string;
    toolCall: { id: string; type: 'function'; function: { name: string; arguments: string } };
  };
  'agent:tool_result': {
    chatRoomId: string;
    messageId: string;
    toolCallId: string;
    toolName: string;
    result: string;
    ok: boolean;
  };
  'agent:done': {
    chatRoomId: string;
    messageId: string;
    agentId: string;
    finalContent: string;
  };
  'agent:error': {
    chatRoomId: string;
    messageId?: string;
    agentId?: string;
    error: string;
  };
  'memory:used': {
    agentId: string;
    memories: Memory[];
  };
  'memory:created': {
    agentId: string;
    memory: Memory;
  };
}

export type OrchestratorEventType = keyof OrchestratorEventMap;

/**
 * Wire-format event delivered on the `orchestrator:event` IPC channel.
 * Main always wraps the typed payload as `{ type, payload }`.
 */
export interface OrchestratorRendererEvent<K extends OrchestratorEventType = OrchestratorEventType> {
  type: K;
  payload: OrchestratorEventMap[K];
}

/* -------------------------------------------------------------------------- */
/*  System info                                                               */
/* -------------------------------------------------------------------------- */

export interface SystemInfo {
  platform: NodeJS.Platform;
  versions: {
    app: string;
    electron?: string;
    node?: string;
    chrome?: string;
  };
  arch: string;
  cpus: number;
  totalMemory: number;
  freeMemory: number;
  hostname: string;
}

/* -------------------------------------------------------------------------- */
/*  OfficeAPI — the public surface                                            */
/* -------------------------------------------------------------------------- */

export interface OfficeAPI {
  /* ----------------------------- LLM ----------------------------- */
  llm: {
    list(): Promise<ApiResponse<LLMProvider[]>>;
    get(id: string): Promise<ApiResponse<LLMProvider | null>>;
    create(input: Partial<LLMProvider>): Promise<ApiResponse<LLMProvider>>;
    update(id: string, partial: Partial<LLMProvider>): Promise<ApiResponse<LLMProvider | null>>;
    delete(id: string): Promise<ApiResponse<boolean>>;
    setDefault(id: string): Promise<ApiResponse<boolean>>;
    /**
     * Test a provider's connectivity + auth.
     * Accepts either a provider id (convenience, used by the store) or a
     * structured args object with optional providerId/provider override.
     */
    test(
      args: string | { providerId?: string; provider?: Partial<LLMProvider> },
    ): Promise<ApiResponse<{ success: boolean; message: string; latencyMs: number }>>;
    /**
     * List available model IDs.
     * Accepts either a provider id (used by the renderer store) or a
     * structured args object.
     */
    listModels(
      args: string | { providerId?: string; baseUrl?: string; apiKey?: string },
    ): Promise<ApiResponse<string[]>>;
    /** Provider presets + a suggestion helper. Returns the presets array. */
    presets(): Promise<ApiResponse<PresetProviderTemplate[]>>;
  };

  /* ----------------------------- Agents --------------------------- */
  agents: {
    list(): Promise<ApiResponse<Agent[]>>;
    get(id: string): Promise<ApiResponse<Agent | null>>;
    create(input: Partial<Agent>): Promise<ApiResponse<Agent>>;
    update(id: string, partial: Partial<Agent>): Promise<ApiResponse<Agent | null>>;
    delete(id: string): Promise<ApiResponse<boolean>>;
    setSkills(id: string, skills: AgentSkill[]): Promise<ApiResponse<Agent | null>>;
  };

  /* ----------------------------- Teams ---------------------------- */
  teams: {
    list(): Promise<ApiResponse<Team[]>>;
    get(id: string): Promise<ApiResponse<Team | null>>;
    create(input: Partial<Team>): Promise<ApiResponse<Team>>;
    update(id: string, partial: Partial<Team>): Promise<ApiResponse<Team | null>>;
    delete(id: string): Promise<ApiResponse<boolean>>;
    /**
     * The renderer stores call add/remove with two positional string args:
     *   api.teams.addAgent(teamId, agentId)
     * We also accept the structured form for completeness.
     */
    addAgent(
      teamIdOrArgs: string | { teamId: string; agentId: string },
      agentId?: string,
    ): Promise<ApiResponse<boolean>>;
    removeAgent(
      teamIdOrArgs: string | { teamId: string; agentId: string },
      agentId?: string,
    ): Promise<ApiResponse<boolean>>;
  };

  /* ----------------------------- Chatrooms ------------------------ */
  chatrooms: {
    list(): Promise<ApiResponse<ChatRoom[]>>;
    get(id: string): Promise<ApiResponse<ChatRoom | null>>;
    create(input: Partial<ChatRoom>): Promise<ApiResponse<ChatRoom>>;
    update(id: string, partial: Partial<ChatRoom>): Promise<ApiResponse<ChatRoom | null>>;
    delete(id: string): Promise<ApiResponse<boolean>>;
    /**
     * Stores call: api.chatrooms.addAgent(chatRoomId, agentId)
     * Structured form is also accepted.
     */
    addAgent(
      chatRoomIdOrArgs: string | { chatRoomId: string; agentId: string },
      agentId?: string,
    ): Promise<ApiResponse<boolean>>;
    removeAgent(
      chatRoomIdOrArgs: string | { chatRoomId: string; agentId: string },
      agentId?: string,
    ): Promise<ApiResponse<boolean>>;
    setAgents(args: { chatRoomId: string; agentIds: string[] }): Promise<ApiResponse<boolean>>;
    /**
     * Find an existing 1:1 (direct) chatroom for the given agent, or create a
     * new one if none exists. Returns the chatroom.
     */
    getOrCreateDirect(args: { agentId: string }): Promise<ApiResponse<ChatRoom>>;
  };

  /* ----------------------------- Messages ------------------------- */
  messages: {
    list(args: { chatRoomId: string; limit?: number; offset?: number }): Promise<ApiResponse<Message[]>>;
    get(id: string): Promise<ApiResponse<Message | null>>;
    create(input: Partial<Message>): Promise<ApiResponse<Message>>;
    delete(id: string): Promise<ApiResponse<boolean>>;
    search(args: { chatRoomId: string; query: string }): Promise<ApiResponse<Message[]>>;
  };

  /* ----------------------------- Chat ----------------------------- */
  chat: {
    send(args: ChatSendArgs): Promise<ApiResponse<void>>;
    stream(args: ChatSendArgs): Promise<ApiResponse<{ messageId: string }>>;
    cancel(): Promise<ApiResponse<void>>;
  };

  /* ----------------------------- Memories ------------------------- */
  memories: {
    list(args: { agentId?: string; type?: string; category?: string; limit?: number; offset?: number }): Promise<ApiResponse<Memory[]>>;
    get(id: string): Promise<ApiResponse<Memory | null>>;
    create(input: Partial<Memory>): Promise<ApiResponse<Memory>>;
    update(id: string, partial: Partial<Memory>): Promise<ApiResponse<Memory | null>>;
    delete(id: string): Promise<ApiResponse<boolean>>;
    deleteAll(args: { agentId: string }): Promise<ApiResponse<number>>;
    pin(id: string): Promise<ApiResponse<Memory | null>>;
    unpin(id: string): Promise<ApiResponse<Memory | null>>;
    search(args: { agentId: string; query: string; limit?: number; threshold?: number }): Promise<ApiResponse<Memory[]>>;
    consolidate(args: { agentId: string; chatRoomId: string }): Promise<ApiResponse<ConversationSummary | null>>;
    extract(args: { agentId: string; text: string; sourceMessageId?: string }): Promise<ApiResponse<Memory[]>>;
  };

  /* ----------------------------- Skills --------------------------- */
  skills: {
    list(): Promise<ApiResponse<SkillManifest[]>>;
    get(name: string): Promise<ApiResponse<SkillManifest | null>>;
    /**
     * The renderer store passes a full `Agent`:
     *   api.skills.getTools(agent)
     * The structured form `{ agentId }` is also accepted.
     */
    getTools(args: { agentId: string } | Agent): Promise<ApiResponse<LLMTool[]>>;
    /** Create a new user-defined skill. */
    create(input: Partial<SkillManifest> & { implementation: string }): Promise<ApiResponse<SkillManifest>>;
    /** Update an existing user-defined skill by name. */
    update(name: string, partial: Partial<SkillManifest> & { implementation?: string; enabled?: boolean }): Promise<ApiResponse<SkillManifest | null>>;
    /** Delete a user-defined skill. */
    delete(name: string): Promise<ApiResponse<boolean>>;
    /** Dry-run a user-defined skill's implementation outside the orchestrator. */
    test(args: {
      name?: string;
      manifest?: Partial<SkillManifest>;
      implementation?: string;
      testArgs?: Record<string, unknown>;
      workingDirectory?: string;
    }): Promise<ApiResponse<{
      success: boolean;
      output: string;
      error?: string;
      durationMs: number;
    }>>;
    /** List all persisted user-defined skills (includes implementation). */
    listUser(): Promise<ApiResponse<Array<{
      name: string;
      displayName: string;
      description: string;
      category: string;
      version: string;
      author?: string;
      parameters: SkillManifest['parameters'];
      requiresApproval: boolean;
      dangerous: boolean;
      examples?: SkillManifest['examples'];
      implementation: string;
      enabled: boolean;
      createdAt: number;
      updatedAt: number;
    }>>>;
    /** Fetch a single persisted user-defined skill by name. */
    getUser(name: string): Promise<ApiResponse<{
      name: string;
      displayName: string;
      description: string;
      category: string;
      version: string;
      author?: string;
      parameters: SkillManifest['parameters'];
      requiresApproval: boolean;
      dangerous: boolean;
      examples?: SkillManifest['examples'];
      implementation: string;
      enabled: boolean;
      createdAt: number;
      updatedAt: number;
    } | null>>;
  };

  /* ----------------------------- Terminal ------------------------- */
  terminal: {
    create(args: TerminalCreateArgs): Promise<ApiResponse<{ sessionId: string }>>;
    write(args: { sessionId: string; data: string }): Promise<ApiResponse<void>>;
    resize(args: { sessionId: string; cols: number; rows: number }): Promise<ApiResponse<void>>;
    kill(sessionId: string): Promise<ApiResponse<void>>;
  };

  /* ----------------------------- Workspace ------------------------ */
  workspace: {
    list(): Promise<ApiResponse<Workspace[]>>;
    getDefault(): Promise<ApiResponse<Workspace | null>>;
    create(input: Partial<Workspace>): Promise<ApiResponse<Workspace>>;
    update(id: string, partial: Partial<Workspace>): Promise<ApiResponse<Workspace | null>>;
    delete(id: string): Promise<ApiResponse<boolean>>;
    setDefault(id: string): Promise<ApiResponse<boolean>>;
    listFiles(workspaceId: string): Promise<ApiResponse<WorkspaceFile[]>>;
    /**
     * Stores call: api.workspace.readFile(path)  (single string)
     * Structured form `{ workspaceId?, path }` is also accepted.
     */
    readFile(
      pathOrArgs: string | { workspaceId?: string; path: string },
    ): Promise<ApiResponse<string>>;
    /**
     * Stores call: api.workspace.openInOs(path)  (single string)
     */
    openInOs(pathOrArgs: string | { path: string }): Promise<ApiResponse<void>>;
  };

  /* ----------------------------- Settings ------------------------- */
  settings: {
    getAll(): Promise<ApiResponse<Record<string, unknown>>>;
    getApp(): Promise<ApiResponse<AppSettings>>;
    saveApp(partial: Partial<AppSettings>): Promise<ApiResponse<AppSettings>>;
    get(key: string): Promise<ApiResponse<unknown>>;
    set(args: { key: string; value: unknown }): Promise<ApiResponse<void>>;
    delete(key: string): Promise<ApiResponse<void>>;
  };

  /* ----------------------------- System --------------------------- */
  system: {
    getInfo(): Promise<ApiResponse<SystemInfo>>;
    openExternal(args: { url: string }): Promise<ApiResponse<void>>;
    getLocalhostUrl(): Promise<ApiResponse<string>>;
  };

  /* ----------------------------- App ------------------------------ */
  app: {
    quit(): Promise<ApiResponse<void>>;
    minimize(): Promise<ApiResponse<void>>;
    maximize(): Promise<ApiResponse<void>>;
    toggleDevTools(): Promise<ApiResponse<void>>;
  };

  /* ----------------------------- Kanban --------------------------- */
  kanban: {
    listBoards(): Promise<ApiResponse<KanbanBoard[]>>;
    getBoard(id: string): Promise<ApiResponse<KanbanBoard | null>>;
    createBoard(input: {
      name: string;
      description?: string;
      color?: string;
      teamId?: string;
      ownerAgentId?: string;
      withDefaultColumns?: boolean;
    }): Promise<ApiResponse<KanbanBoard>>;
    updateBoard(id: string, partial: Partial<KanbanBoard>): Promise<ApiResponse<KanbanBoard | null>>;
    deleteBoard(id: string): Promise<ApiResponse<boolean>>;

    listColumns(boardId: string): Promise<ApiResponse<KanbanColumn[]>>;
    createColumn(input: {
      boardId: string;
      name: string;
      status?: KanbanTaskStatus;
      position?: number;
      wipLimit?: number;
    }): Promise<ApiResponse<KanbanColumn>>;
    updateColumn(id: string, partial: Partial<KanbanColumn>): Promise<ApiResponse<KanbanColumn | null>>;
    deleteColumn(id: string): Promise<ApiResponse<boolean>>;
    reorderColumns(args: { boardId: string; orderedIds: string[] }): Promise<ApiResponse<KanbanColumn[]>>;

    listTasks(args: { boardId?: string; columnId?: string; assigneeAgentId?: string }): Promise<ApiResponse<KanbanTask[]>>;
    getTask(id: string): Promise<ApiResponse<KanbanTask | null>>;
    createTask(input: Partial<KanbanTask> & { title: string; boardId: string; columnId: string }): Promise<ApiResponse<KanbanTask>>;
    updateTask(id: string, partial: Partial<KanbanTask>): Promise<ApiResponse<KanbanTask | null>>;
    moveTask(args: { taskId: string; toColumnId: string; toPosition?: number }): Promise<ApiResponse<KanbanTask | null>>;
    deleteTask(id: string): Promise<ApiResponse<boolean>>;

    listEvents(args: { boardId?: string; taskId?: string; limit?: number }): Promise<ApiResponse<KanbanTaskEvent[]>>;
    addEvent(input: {
      taskId: string;
      boardId: string;
      eventType: KanbanTaskEventType;
      fromColumnId?: string;
      toColumnId?: string;
      agentId?: string;
      message?: string;
      metadata?: Record<string, unknown>;
    }): Promise<ApiResponse<KanbanTaskEvent>>;
  };

  /* ----------------------------- Events --------------------------- */
  events: {
    /**
     * Overloaded subscribe:
     *   onOrchestrator(handler)                        — receive every event
     *   onOrchestrator(eventType, handler)             — filtered by event type
     * Always returns an Unsubscribe function.
     */
    onOrchestrator(handler: (event: OrchestratorRendererEvent) => void): Unsubscribe;
    onOrchestrator<K extends OrchestratorEventType>(
      eventType: K,
      handler: (payload: OrchestratorEventMap[K]) => void,
    ): Unsubscribe;
    onTerminalData(handler: (event: TerminalDataEvent) => void): Unsubscribe;
    onTerminalExit(handler: (event: TerminalExitEvent) => void): Unsubscribe;
  };
}

/* -------------------------------------------------------------------------- */
/*  Static globals (window.office)                                            */
/* -------------------------------------------------------------------------- */

export interface OfficeGlobals {
  platform: NodeJS.Platform;
  versions: {
    app: string;
    electron: string;
    node: string;
    chrome: string;
  };
}
