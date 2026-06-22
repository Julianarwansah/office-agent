/**
 * Orchestrator dependency interfaces and event types.
 *
 * The orchestrator is the heart of the system: it loads an agent + team +
 * memories + history, drives the LLM (streaming or non-streaming), executes
 * tool calls, and persists everything back to the database.
 *
 * Repository interfaces are defined locally so that this module does not
 * require the actual repository files to exist. The repositories in
 * `src/main/db/repositories/` are expected to satisfy these shapes.
 */

import type {
  Agent,
  AppSettings,
  ChatRoom,
  ConversationSummary,
  LLMTool,
  LLMToolCall,
  Memory,
  MemoryCategory,
  MemoryType,
  Message,
  Team,
  ToolExecution,
  ToolExecutionStatus,
} from '../../shared/types';

/* -------------------------------------------------------------------------- */
/* Repository interfaces (structural — satisfied by the actual repos)        */
/* -------------------------------------------------------------------------- */

/** Subset of the `better-sqlite3` Database type the orchestrator relies on. */
export interface OrchestratorDatabase {
  prepare(sql: string): unknown;
  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
}

export interface AgentRepositoryLike {
  findById(id: string): Agent | null;
  findAll(): Agent[];
  findByTeam(teamId: string | null): Agent[];
}

export interface MessageRepositoryLike {
  create(
    input: Omit<Message, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
  ): Message;
  update(id: string, partial: Partial<Message>): Message | null;
  appendContent(id: string, delta: string): void;
  markStreaming(id: string, isStreaming: boolean): void;
  findById(id: string): Message | null;
  findByChatRoom(chatRoomId: string, limit?: number, offset?: number): Message[];
  findRecent(chatRoomId: string, n: number): Message[];
}

export interface MemoryRepositoryLike {
  create(
    input: Omit<Memory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'> & {
      id?: string;
      createdAt?: number;
    },
  ): Memory;
  getTopRelevant(
    agentId: string,
    query: string,
    k: number,
    threshold: number,
  ): Memory[];
  touchAccess(id: string): void;
  findByAgent(agentId: string): Memory[];
}

export interface SummaryRepositoryLike {
  create(
    input: Omit<ConversationSummary, 'id' | 'createdAt'> & {
      id?: string;
      createdAt?: number;
    },
  ): ConversationSummary;
  findByAgent(agentId: string): ConversationSummary[];
}

export interface SettingsRepositoryLike {
  get(): AppSettings;
}

export interface ToolExecutionRepositoryLike {
  create(
    input: Omit<ToolExecution, 'id' | 'startedAt'> & {
      id?: string;
      startedAt?: number;
    },
  ): ToolExecution;
  update(
    id: string,
    partial: Partial<Omit<ToolExecution, 'id' | 'startedAt'>>,
  ): ToolExecution | null;
}

export interface TeamRepositoryLike {
  findById(id: string): Team | null;
}

/* -------------------------------------------------------------------------- */
/* Skill registry / executor interfaces                                       */
/* -------------------------------------------------------------------------- */

export interface SkillDefinition {
  name: string;
  displayName: string;
  description: string;
  category?: string;
  parameters?: Record<string, unknown>;
  requiresApproval?: boolean;
  dangerous?: boolean;
}

export interface SkillRegistryLike {
  /** All registered skills, keyed by name. */
  getAll(): SkillDefinition[];
  /** Resolve the tool descriptors available to a given agent. */
  getToolsForAgent(agent: Agent): LLMTool[];
  /** Look up a single skill definition by name. */
  get(name: string): SkillDefinition | undefined;
}

export interface SkillExecutionResult {
  ok: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SkillDelegateContext {
  agentId: string;
  chatRoomId: string;
  parentMessageId?: string;
  userMessage: string;
  signal?: AbortSignal;
}

export type SkillAgentDelegate = (
  targetAgentId: string,
  task: string,
  context: SkillDelegateContext,
) => Promise<string>;

export interface SkillExecutorLike {
  /** Execute a single tool call. Implementations should record the call. */
  execute(
    agent: Agent,
    toolCall: LLMToolCall,
    context: { chatRoomId: string; messageId: string; signal?: AbortSignal },
  ): Promise<SkillExecutionResult>;
  /** Record a tool call/result without actually executing it (for audit). */
  record(
    messageId: string,
    toolCall: LLMToolCall,
    result: SkillExecutionResult,
    status: ToolExecutionStatus,
  ): Promise<ToolExecution>;
}

/* -------------------------------------------------------------------------- */
/* Top-level orchestrator dependencies                                        */
/* -------------------------------------------------------------------------- */

export interface OrchestratorDeps {
  db: OrchestratorDatabase;
  agents: AgentRepositoryLike;
  teams: TeamRepositoryLike;
  messages: MessageRepositoryLike;
  chatrooms: {
    findById(id: string): ChatRoom | null;
  };
  memories: MemoryRepositoryLike;
  summaries: SummaryRepositoryLike;
  settings: SettingsRepositoryLike;
  toolExecutions: ToolExecutionRepositoryLike;
  /** ProviderManager or a compatible resolver that can produce an LLMClient. */
  providerManager: {
    createClient(providerId: string): Promise<{
      chat(req: unknown): Promise<{
        content: string;
        toolCalls?: LLMToolCall[];
        finishReason: string;
        usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
      }>;
      chatStream(req: unknown): AsyncIterable<{
        type: 'start' | 'content' | 'tool_call' | 'done' | 'error';
        contentDelta?: string;
        toolCall?: LLMToolCall;
        finishReason?: string;
        error?: string;
      }>;
    }>;
  };
  skillRegistry: SkillRegistryLike;
  skillExecutor: SkillExecutorLike;
  eventBus: TypedEventEmitter<OrchestratorEventMap>;
}

/* -------------------------------------------------------------------------- */
/* Run options / result                                                       */
/* -------------------------------------------------------------------------- */

export interface AgentRunOptions {
  chatRoomId: string;
  agentId: string;
  userMessage: string;
  parentMessageId?: string;
  stream?: boolean;
  signal?: AbortSignal;
  /** Optional override of how many recent messages to include in context. */
  historyLimit?: number;
  /** Optional override of how many memories to retrieve. */
  memoryLimit?: number;
}

export interface AgentRunResult {
  messageId: string;
  agentMessage: Message;
  toolExecutions: ToolExecution[];
  memoriesUsed: Memory[];
  memoriesCreated: Memory[];
  /** Final assistant content (post-tool-calls). */
  finalContent: string;
}

export interface RunTeamChatOptions {
  chatRoomId: string;
  userMessage: string;
  /** When provided, skip mention detection and run this agent first. */
  agentId?: string;
  parentMessageId?: string;
  signal?: AbortSignal;
  /** When true, after the lead agent responds, also let other agents chime in. */
  letOthersRespond?: boolean;
  /** Maximum number of non-lead agents allowed to chime in. */
  maxFollowUps?: number;
}

/* -------------------------------------------------------------------------- */
/* Event map                                                                   */
/* -------------------------------------------------------------------------- */

export interface OrchestratorEventMap {
  'agent:start': {
    agentId: string;
    chatRoomId: string;
    messageId: string;
    parentMessageId?: string;
  };
  'agent:thinking': {
    agentId: string;
    messageId: string;
  };
  'agent:content': {
    agentId: string;
    messageId: string;
    delta: string;
    content: string;
  };
  'agent:tool_call': {
    agentId: string;
    messageId: string;
    toolCall: LLMToolCall;
  };
  'agent:tool_result': {
    agentId: string;
    messageId: string;
    toolCallId: string;
    toolName: string;
    result: string;
    ok: boolean;
  };
  'agent:done': {
    agentId: string;
    messageId: string;
    finalContent: string;
  };
  'agent:error': {
    agentId: string;
    messageId?: string;
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
export type OrchestratorListener<K extends OrchestratorEventName> = (
  payload: OrchestratorEventMap[K],
) => void;

/** Listener type alias generic over any event map. */
export type ListenerOf<EventMap, K extends keyof EventMap> = (
  payload: EventMap[K],
) => void;

/* eslint-disable @typescript-eslint/no-explicit-any */
/* -------------------------------------------------------------------------- */
/* TypedEventEmitter                                                           */
/* -------------------------------------------------------------------------- */

type AnyListener = (payload: any) => void;

/**
 * Lightweight, strictly-typed event emitter. The `EventMap` type describes
 * event names as keys and payloads as values; listeners receive the
 * payload type that matches the event they subscribed to.
 */
export class TypedEventEmitter<EventMap extends Record<string, any>> {
  private readonly listeners: Map<keyof EventMap, Set<AnyListener>> = new Map();

  on<K extends keyof EventMap>(event: K, listener: ListenerOf<EventMap, K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = listener as AnyListener;
    set.add(wrapped);
    return () => this.off(event, listener);
  }

  off<K extends keyof EventMap>(event: K, listener: ListenerOf<EventMap, K>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener as AnyListener);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    for (const listener of Array.from(set)) {
      try {
        (listener as ListenerOf<EventMap, K>)(payload);
      } catch (err) {
        // Listeners must never break each other. Swallow + log.
        // eslint-disable-next-line no-console
        console.error(`[TypedEventEmitter] listener for "${String(event)}" threw:`, err);
      }
    }
  }

  removeAllListeners<K extends keyof EventMap>(event?: K): void {
    if (event === undefined) {
      this.listeners.clear();
      return;
    }
    this.listeners.delete(event);
  }

  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export interface ExtractedMemory {
  content: string;
  category: MemoryCategory;
  importance: number;
  type?: MemoryType;
}