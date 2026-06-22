/**
 * Orchestrator — top-level coordinator for agent execution. Sits above the
 * `AgentRunner` and adds:
 *
 *   - public API used by IPC handlers (`runAgent`, `runTeamChat`,
 *     `delegateToAgent`, `streamChat`)
 *   - event subscription helpers
 *   - multi-agent turn routing (lead responds first, then optional chime-ins)
 *
 * Construction is dependency-injected: no module-level globals, so the
 * orchestrator can be instantiated in tests with fakes.
 */

import { AgentRunner } from './agent-runner';
import { MemoryManager } from './memory-manager';
import type {
  Agent,
  ChatRoom,
  ConversationSummary,
} from '../../shared/types';
import type {
  AgentRunOptions,
  AgentRunResult,
  OrchestratorDeps,
  OrchestratorEventMap,
  OrchestratorListener,
  RunTeamChatOptions,
  TypedEventEmitter,
} from './types';

const DEFAULT_MAX_FOLLOW_UPS = 2;

export interface StreamChunkPayload {
  agentId: string;
  messageId: string;
  delta: string;
  content: string;
}

export class Orchestrator {
  readonly deps: OrchestratorDeps;
  private readonly runner: AgentRunner;
  private readonly memory: MemoryManager;

  constructor(deps: OrchestratorDeps) {
    this.deps = deps;
    this.memory = new MemoryManager(
      deps.memories,
      deps.summaries,
      deps.messages,
      deps.settings,
      (providerId) =>
        deps.providerManager.createClient(providerId).then((c) => {
          // The ProviderManager produces an LLMClient; the MemoryManager
          // needs its `.provider` shape. The runner uses `chat`/`chatStream`
          // on the same object.
          return c as unknown as import('../llm/client').LLMClient;
        }),
    );
    this.runner = new AgentRunner(deps, this.memory);
  }

  /* ------------------------------------------------------------------ */
  /* Single agent                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Run a single agent in response to `userMessage`. Returns the agent's
   * final assistant message + metadata.
   */
  async runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
    return this.runner.run(opts);
  }

  /**
   * Streamed variant of `runAgent`. `onChunk` is invoked for every assistant
   * content delta in addition to the normal event-bus emissions.
   */
  async streamChat(
    chatRoomId: string,
    agentId: string,
    userMessage: string,
    onChunk: (chunk: StreamChunkPayload) => void,
    options: { parentMessageId?: string; signal?: AbortSignal } = {},
  ): Promise<AgentRunResult> {
    const off = this.deps.eventBus.on('agent:content', (payload) => {
      if (payload.agentId !== agentId) return;
      try {
        onChunk({
          agentId: payload.agentId,
          messageId: payload.messageId,
          delta: payload.delta,
          content: payload.content,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Orchestrator] onChunk handler threw:', err);
      }
    });
    try {
      return await this.runner.run({
        chatRoomId,
        agentId,
        userMessage,
        parentMessageId: options.parentMessageId,
        stream: true,
        signal: options.signal,
      });
    } finally {
      off();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Team chat                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Run a multi-agent turn. The lead agent always responds first; if
   * `letOthersRespond` is true, up to `maxFollowUps` additional agents may
   * chime in based on whether the user message addresses them.
   *
   * Returns an array of results, one per agent that actually responded, in
   * turn order.
   */
  async runTeamChat(
    chatRoomId: string,
    userMessage: string,
    options: Omit<RunTeamChatOptions, 'chatRoomId' | 'userMessage'> = {},
  ): Promise<AgentRunResult[]> {
    const chatRoom = this.deps.chatrooms.findById(chatRoomId);
    if (!chatRoom) {
      throw new Error(`Orchestrator.runTeamChat: chatroom not found: ${chatRoomId}`);
    }
    const agentsInRoom = this.resolveChatRoomAgents(chatRoom);
    if (agentsInRoom.length === 0) {
      return [];
    }

    const mentionedIds = options.agentId
      ? [options.agentId]
      : detectMentionedAgents(userMessage, agentsInRoom);

    // If the user explicitly addressed specific agents, run exactly those.
    if (mentionedIds.length > 0 && !options.agentId) {
      const results: AgentRunResult[] = [];
      for (const agentId of mentionedIds) {
        const agent = agentsInRoom.find((a) => a.id === agentId);
        if (!agent) continue;
        // Each subsequent agent sees the previous agents' responses in
        // history (they're already persisted as messages), so no extra
        // orchestration needed beyond passing the same chatroom.
        const result = await this.runner.run({
          chatRoomId,
          agentId,
          userMessage,
          parentMessageId: options.parentMessageId,
          signal: options.signal,
        });
        results.push(result);
      }
      return results;
    }

    // Default flow: lead first, then optional chime-ins.
    const lead = pickLead(agentsInRoom);
    const results: AgentRunResult[] = [];
    if (lead) {
      const result = await this.runner.run({
        chatRoomId,
        agentId: lead.id,
        userMessage,
        parentMessageId: options.parentMessageId,
        signal: options.signal,
      });
      results.push(result);
    }

    if (options.letOthersRespond) {
      const max = options.maxFollowUps ?? DEFAULT_MAX_FOLLOW_UPS;
      const candidates = agentsInRoom
        .filter((a) => !lead || a.id !== lead.id)
        .filter((a) => shouldChimeIn(a, userMessage, lead))
        .slice(0, max);
      for (const agent of candidates) {
        if (options.signal?.aborted) break;
        try {
          const result = await this.runner.run({
            chatRoomId,
            agentId: agent.id,
            userMessage,
            parentMessageId: options.parentMessageId,
            signal: options.signal,
          });
          results.push(result);
        } catch (err) {
          // Surface the error to the event bus but keep going so a single
          // misbehaving agent doesn't take down the whole team turn.
          this.deps.eventBus.emit('agent:error', {
            agentId: agent.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return results;
  }

  /* ------------------------------------------------------------------ */
  /* Agent delegation (used by the agent_delegate skill)                */
  /* ------------------------------------------------------------------ */

  /**
   * Run `targetAgentId` synchronously (from the caller's perspective) with a
   * synthetic task description. The delegated agent's final content is
   * returned as a string for the caller to feed back into its own context.
   */
  async delegateToAgent(
    targetAgentId: string,
    task: string,
    context: {
      chatRoomId: string;
      parentMessageId?: string;
      signal?: AbortSignal;
    },
  ): Promise<string> {
    const target = this.deps.agents.findById(targetAgentId);
    if (!target) {
      throw new Error(`Orchestrator.delegateToAgent: agent not found: ${targetAgentId}`);
    }
    const result = await this.runner.run({
      chatRoomId: context.chatRoomId,
      agentId: targetAgentId,
      userMessage: task,
      parentMessageId: context.parentMessageId,
      stream: false,
      signal: context.signal,
      historyLimit: 10,
      memoryLimit: 5,
    });
    return result.finalContent;
  }

  /* ------------------------------------------------------------------ */
  /* Memory helpers (re-exported for convenience)                       */
  /* ------------------------------------------------------------------ */

  /** Trigger a consolidation pass for the agent in the given chatroom. */
  async consolidateMemory(
    agentId: string,
    chatRoomId: string,
  ): Promise<ConversationSummary | null> {
    const agent = this.deps.agents.findById(agentId);
    if (!agent) {
      throw new Error(`Orchestrator.consolidateMemory: agent not found: ${agentId}`);
    }
    return this.memory.consolidate(agentId, chatRoomId, agent.providerId);
  }

  /** Manually extract memories from a piece of text for an agent. */
  async extractMemories(
    agentId: string,
    text: string,
    sourceMessageId?: string,
  ) {
    return this.memory.extractAndStore(agentId, text, sourceMessageId);
  }

  /* ------------------------------------------------------------------ */
  /* Event subscription                                                 */
  /* ------------------------------------------------------------------ */

  on<K extends keyof OrchestratorEventMap>(
    event: K,
    listener: OrchestratorListener<K>,
  ): () => void {
    return this.deps.eventBus.on(event, listener);
  }

  off<K extends keyof OrchestratorEventMap>(
    event: K,
    listener: OrchestratorListener<K>,
  ): void {
    this.deps.eventBus.off(event, listener);
  }

  /** Underlying typed event bus (escape hatch for advanced consumers). */
  get eventBus(): TypedEventEmitter<OrchestratorEventMap> {
    return this.deps.eventBus;
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                          */
  /* ------------------------------------------------------------------ */

  private resolveChatRoomAgents(chatRoom: ChatRoom): Agent[] {
    if (chatRoom.agentIds.length === 0) return [];
    const all = this.deps.agents.findAll();
    const byId = new Map(all.map((a) => [a.id, a] as const));
    const out: Agent[] = [];
    for (const id of chatRoom.agentIds) {
      const a = byId.get(id);
      if (a) out.push(a);
    }
    return out;
  }
}

/* -------------------------------------------------------------------------- */
/* Module helpers                                                              */
/* -------------------------------------------------------------------------- */

const MENTION_PATTERNS: Array<(name: string) => RegExp> = [
  (name) => new RegExp(`@${escapeRegExp(name)}\\b`, 'i'),
  (name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i'),
];

function detectMentionedAgents(userMessage: string, agents: Agent[]): string[] {
  const text = userMessage ?? '';
  if (!text.trim()) return [];
  const lower = text.toLowerCase();
  const mentioned: string[] = [];
  for (const agent of agents) {
    const name = agent.name?.trim();
    if (!name) continue;
    for (const make of MENTION_PATTERNS) {
      if (make(name).test(text) || make(name).test(lower)) {
        if (!mentioned.includes(agent.id)) mentioned.push(agent.id);
        break;
      }
    }
  }
  return mentioned;
}

function pickLead(agents: Agent[]): Agent | undefined {
  return (
    agents.find((a) => a.isLead) ??
    agents.find((a) => a.role === 'lead') ??
    agents[0]
  );
}

function shouldChimeIn(
  agent: Agent,
  userMessage: string,
  lead: Agent | undefined,
): boolean {
  if (!userMessage || !userMessage.trim()) return false;
  // Direct mention wins.
  if (new RegExp(`@${escapeRegExp(agent.name)}\\b`, 'i').test(userMessage)) {
    return true;
  }
  // Team-wide prompts ("team", "everyone", "all") let others chime in.
  if (/\b(team|everyone|all of you|all agents)\b/i.test(userMessage)) {
    return true;
  }
  // If this agent has no particular trigger but is on the same team as the
  // lead, allow it (a small cap is enforced by the caller).
  if (lead && lead.teamId && agent.teamId === lead.teamId) {
    return true;
  }
  return false;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}