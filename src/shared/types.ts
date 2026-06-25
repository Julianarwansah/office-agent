import type { SkillParameter } from './skills-schema';

export type LLMChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LLMMessage {
  role: LLMChatRole;
  content: string | null;
  name?: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMFunctionDescriptor {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface LLMTool {
  type: 'function';
  function: LLMFunctionDescriptor;
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type LLMProviderHeaders = Record<string, string>;

export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemPromptPrefix?: string;
  isDefault?: boolean;
  headers?: LLMProviderHeaders;
}

export interface LLMChatRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  tools?: LLMTool[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  stop?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMChatChoice {
  index: number;
  message: LLMMessage;
  finishReason: string | null;
}

export interface LLMChatResponse {
  id: string;
  model: string;
  choices: LLMChatChoice[];
  usage?: LLMUsage;
  created?: number;
  object?: string;
}

export interface LLMChatChunk {
  id: string;
  delta: Partial<LLMMessage> & { role?: LLMChatRole };
  finishReason: string | null;
  model?: string;
}

export type AgentRole = 'lead' | 'member' | 'observer';

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  systemPrompt: string;
  providerId: string;
  teamId?: string;
  role: AgentRole;
  color?: string;
  isLead?: boolean;
  enabledSkills: AgentSkill[];
  temperature?: number;
  maxTokens?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  color?: string;
  avatar?: string;
  createdAt: number;
}

export interface SkillParameterValue {
  [key: string]: string | number | boolean | string[] | SkillParameterValue | undefined;
}

export interface Skill {
  name: string;
  displayName: string;
  description: string;
  category?: string;
  parameters?: SkillParameter[];
  requiresApproval?: boolean;
  dangerous?: boolean;
}

export interface AgentSkill {
  name: string;
  enabled: boolean;
  config?: SkillParameterValue;
}

export type ChatRoomType = 'team' | 'direct' | 'global';

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  teamId?: string;
  type: ChatRoomType;
  agentIds: string[];
  createdAt: number;
}

export type SenderType = 'user' | 'agent' | 'system';

export interface MessageMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export interface Message {
  id: string;
  chatRoomId: string;
  senderType: SenderType;
  senderId: string;
  content: string;
  role?: LLMChatRole;
  toolCalls?: LLMToolCall[];
  toolCallId?: string;
  parentId?: string;
  createdAt: number;
  isStreaming?: boolean;
  metadata?: MessageMetadata;
}

export type NotificationType = 'agent_done' | 'agent_error' | 'agent_input_needed' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  chatroomId?: string;
  agentId?: string;
  isRead: boolean;
  createdAt: number;
}

export type MemoryType = 'short_term' | 'long_term' | 'episodic' | 'semantic';
export type MemoryCategory = 'user_preference' | 'fact' | 'instruction' | 'context' | 'task';

export interface Memory {
  id: string;
  agentId: string;
  type: MemoryType;
  content: string;
  importance: number;
  category: MemoryCategory;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  isPinned: boolean;
  sourceMessageId?: string;
}

export interface ConversationSummary {
  id: string;
  agentId: string;
  chatRoomId: string;
  summary: string;
  messageCount: number;
  startMessageId?: string;
  endMessageId?: string;
  createdAt: number;
}

export type ToolExecutionStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolExecution {
  id: string;
  messageId: string;
  toolName: string;
  arguments: string;
  result?: string;
  status: ToolExecutionStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export type TerminalStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface TerminalSession {
  id: string;
  sessionId: string;
  command: string;
  output: string;
  exitCode?: number;
  startedAt: number;
  completedAt?: number;
  status: TerminalStatus;
}

export interface TerminalCreateOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
  cols?: number;
  rows?: number;
}

export interface WorkspaceFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: number;
  children?: WorkspaceFile[];
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  isDefault?: boolean;
  createdAt: number;
}

export type KanbanTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type KanbanTaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type KanbanTaskEventType =
  | 'created'
  | 'moved'
  | 'assigned'
  | 'unassigned'
  | 'updated'
  | 'completed'
  | 'reopened'
  | 'commented'
  | 'deleted';

export interface KanbanBoard {
  id: string;
  name: string;
  description?: string;
  color?: string;
  teamId?: string;
  ownerAgentId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface KanbanColumn {
  id: string;
  boardId: string;
  name: string;
  position: number;
  status: KanbanTaskStatus;
  wipLimit?: number;
  createdAt: number;
}

export interface KanbanTask {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  status: KanbanTaskStatus;
  priority: KanbanTaskPriority;
  assigneeAgentId?: string;
  creatorAgentId?: string;
  dueDate?: number;
  position: number;
  parentTaskId?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface KanbanTaskEvent {
  id: string;
  taskId: string;
  boardId: string;
  eventType: KanbanTaskEventType;
  fromColumnId?: string;
  toColumnId?: string;
  agentId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export type AppTheme = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: AppTheme;
  localhostPort: number;
  defaultProviderId?: string;
  terminalShell: string;
  workingDirectory: string;
  maxMemoryItems: number;
  memoryImportanceThreshold: number;
  autoCreateMemories: boolean;
  streamResponses: boolean;
  saveHistory: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type StreamEventType = 'start' | 'delta' | 'tool_call' | 'tool_result' | 'done' | 'error';

export interface StreamEvent {
  type: StreamEventType;
  payload: unknown;
}

/**
 * Renderer-facing orchestrator event map. Mirrors the payloads that the main
 * process pushes to the renderer on the `orchestrator:event` IPC channel.
 *
 * NOTE: This is the consumer-side type used by renderer stores. The producer-
 * side map in `src/main/orchestrator/types.ts` has a similar shape but is
 * owned by the main process.
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
    toolCall: LLMToolCall;
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
    memoryIds: string[];
  };
  'memory:created': {
    agentId: string;
    memories: Memory[];
  };
}

export type OrchestratorEventName = keyof OrchestratorEventMap;

export const IPC_CHANNELS = {
  LLM: {
    CHAT: 'llm:chat',
    CHAT_STREAM: 'llm:chat:stream',
    CHAT_CANCEL: 'llm:chat:cancel',
    LIST: 'llm:list',
    GET: 'llm:get',
    CREATE: 'llm:create',
    UPDATE: 'llm:update',
    DELETE: 'llm:delete',
    SET_DEFAULT: 'llm:set-default',
    TEST: 'llm:test',
    LIST_MODELS: 'llm:list-models',
    PRESETS: 'llm:presets',
  },
  AGENT: {
    LIST: 'agent:list',
    GET: 'agent:get',
    CREATE: 'agent:create',
    UPDATE: 'agent:update',
    DELETE: 'agent:delete',
    DUPLICATE: 'agent:duplicate',
    EXPORT: 'agent:export',
    IMPORT: 'agent:import',
    SET_SKILLS: 'agent:set-skills',
  },
  TEAM: {
    LIST: 'team:list',
    GET: 'team:get',
    CREATE: 'team:create',
    UPDATE: 'team:update',
    DELETE: 'team:delete',
    ADD_AGENT: 'team:add-agent',
    REMOVE_AGENT: 'team:remove-agent',
  },
  CHATROOM: {
    LIST: 'chatroom:list',
    GET: 'chatroom:get',
    CREATE: 'chatroom:create',
    UPDATE: 'chatroom:update',
    DELETE: 'chatroom:delete',
    ADD_AGENT: 'chatroom:add-agent',
    REMOVE_AGENT: 'chatroom:remove-agent',
    SET_AGENTS: 'chatroom:set-agents',
    GET_OR_CREATE_DIRECT: 'chatroom:get-or-create-direct',
  },
  MESSAGE: {
    LIST: 'message:list',
    GET: 'message:get',
    CREATE: 'message:create',
    DELETE: 'message:delete',
    SEARCH: 'message:search',
    SEND: 'message:send',
    STREAM: 'message:stream',
    CLEAR: 'message:clear',
    REGENERATE: 'message:regenerate',
    GET_THREAD: 'message:get-thread',
    SEND_REPLY: 'message:send-reply',
  },
  CHAT: {
    SEND: 'chat:send',
    STREAM: 'chat:stream',
    CANCEL: 'chat:cancel',
  },
  MEMORY: {
    LIST: 'memory:list',
    GET: 'memory:get',
    CREATE: 'memory:create',
    UPDATE: 'memory:update',
    DELETE: 'memory:delete',
    DELETE_ALL: 'memory:delete-all',
    PIN: 'memory:pin',
    UNPIN: 'memory:unpin',
    SEARCH: 'memory:search',
    CONSOLIDATE: 'memory:consolidate',
    EXTRACT: 'memory:extract',
    CLEAR: 'memory:clear',
  },
  SKILL: {
    LIST: 'skill:list',
    GET: 'skill:get',
    GET_TOOLS: 'skill:get-tools',
    INSTALL: 'skill:install',
    UNINSTALL: 'skill:uninstall',
    EXECUTE: 'skill:execute',
    TOGGLE: 'skill:toggle',
    CREATE: 'skill:create',
    UPDATE: 'skill:update',
    DELETE: 'skill:delete',
    TEST: 'skill:test',
    LIST_USER: 'skill:list-user',
    GET_USER: 'skill:get-user',
  },
  TERMINAL: {
    CREATE: 'terminal:create',
    WRITE: 'terminal:write',
    RESIZE: 'terminal:resize',
    KILL: 'terminal:kill',
    DATA: 'terminal:data',
    EXIT: 'terminal:exit',
    LIST: 'terminal:list',
  },
  FILE: {
    READ: 'file:read',
    WRITE: 'file:write',
    APPEND: 'file:append',
    DELETE: 'file:delete',
    EXISTS: 'file:exists',
    STAT: 'file:stat',
    MKDIR: 'file:mkdir',
    RENAME: 'file:rename',
  },
  SETTINGS: {
    GET: 'settings:get',
    GET_ALL: 'settings:get-all',
    GET_APP: 'settings:get-app',
    SAVE_APP: 'settings:save-app',
    UPDATE: 'settings:update',
    SET: 'settings:set',
    DELETE: 'settings:delete',
    RESET: 'settings:reset',
  },
  WORKSPACE: {
    LIST: 'workspace:list',
    GET_DEFAULT: 'workspace:get-default',
    CREATE: 'workspace:create',
    UPDATE: 'workspace:update',
    DELETE: 'workspace:delete',
    SET_DEFAULT: 'workspace:set-default',
    LIST_FILES: 'workspace:list-files',
    READ_FILE: 'workspace:read-file',
    READ: 'workspace:read',
    SEARCH: 'workspace:search',
    OPEN: 'workspace:open',
    OPEN_IN_OS: 'workspace:open-in-os',
  },
  SYSTEM: {
    GET_INFO: 'system:get-info',
    OPEN_EXTERNAL: 'system:open-external',
    GET_LOCALHOST_URL: 'system:get-localhost-url',
  },
  APP: {
    READY: 'app:ready',
    QUIT: 'app:quit',
    MINIMIZE: 'app:minimize',
    MAXIMIZE: 'app:maximize',
    TOGGLE_DEVTOOLS: 'app:toggle-devtools',
    OPEN_EXTERNAL: 'app:open-external',
    PLATFORM: 'app:platform',
    VERSION: 'app:version',
  },
  KANBAN: {
    LIST_BOARDS: 'kanban:list-boards',
    GET_BOARD: 'kanban:get-board',
    CREATE_BOARD: 'kanban:create-board',
    UPDATE_BOARD: 'kanban:update-board',
    DELETE_BOARD: 'kanban:delete-board',
    LIST_COLUMNS: 'kanban:list-columns',
    CREATE_COLUMN: 'kanban:create-column',
    UPDATE_COLUMN: 'kanban:update-column',
    DELETE_COLUMN: 'kanban:delete-column',
    REORDER_COLUMNS: 'kanban:reorder-columns',
    LIST_TASKS: 'kanban:list-tasks',
    GET_TASK: 'kanban:get-task',
    CREATE_TASK: 'kanban:create-task',
    UPDATE_TASK: 'kanban:update-task',
    MOVE_TASK: 'kanban:move-task',
    DELETE_TASK: 'kanban:delete-task',
    LIST_EVENTS: 'kanban:list-events',
    ADD_EVENT: 'kanban:add-event',
  },
  ANALYTICS: {
    AGENT: 'analytics:agent',
    OVERVIEW: 'analytics:overview',
  },
  NOTIFICATIONS: {
    LIST: 'notifications:list',
    UNREAD_COUNT: 'notifications:unread-count',
    MARK_READ: 'notifications:mark-read',
    MARK_ALL_READ: 'notifications:mark-all-read',
    CLEAR_ALL: 'notifications:clear-all',
  },
} as const;

export type IpcChannelName =
  | (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS][keyof (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]];

/** Channel used to push orchestrator events from main to renderer. */
export const RENDERER_EVENT_CHANNELS = {
  ORCHESTRATOR: 'orchestrator:event',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',
} as const;
