/**
 * AgentRunner — drives a single agent turn end-to-end:
 *
 *   1. Load agent + team + memories + history.
 *   2. Build the system prompt + chat messages.
 *   3. Stream (or non-stream) the LLM response.
 *   4. Loop on tool_calls: execute each, append tool results, call LLM again.
 *   5. Persist the assistant message, then extract memories.
 *
 * The runner is the lowest-level unit that talks to the LLM. The
 * Orchestrator sits on top of it to coordinate team chat and delegation.
 */

import {
  LLMClient,
  PromptBuilder,
  type ChatRequest,
  type StreamChunk,
} from '../llm';
import { LLMError } from '../llm/types';
import { delegationSuffix } from './prompts';
import { MemoryManager } from './memory-manager';
import { ToolCallAccumulator } from './tool-accumulator';
import type {
  Agent,
  LLMMessage,
  LLMTool,
  LLMToolCall,
  Memory,
  Message,
  ToolExecution,
} from '../../shared/types';
import type {
  AgentRunOptions,
  AgentRunResult,
  OrchestratorDeps,
  OrchestratorEventMap,
  TypedEventEmitter,
  SkillExecutionResult,
} from './types';

const DEFAULT_HISTORY_LIMIT = 20;
const DEFAULT_MEMORY_LIMIT = 10;
const MAX_TOOL_ITERATIONS = 8;

interface ChatClient {
  chat(req: ChatRequest): Promise<{
    content: string;
    toolCalls?: LLMToolCall[];
    finishReason: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }>;
  chatStream(req: ChatRequest): AsyncGenerator<StreamChunk>;
}

export class AgentRunner {
  constructor(
    private readonly deps: OrchestratorDeps,
    private readonly memoryManager: MemoryManager,
  ) {}

  /**
   * Run a single agent turn and return the produced message + bookkeeping.
   */
  async run(opts: AgentRunOptions): Promise<AgentRunResult> {
    const { chatRoomId, agentId, userMessage, parentMessageId, signal } = opts;
    const stream = opts.stream ?? this.shouldStream();

    const agent = this.deps.agents.findById(agentId);
    if (!agent) {
      throw new Error(`AgentRunner: agent not found: ${agentId}`);
    }
    const team = agent.teamId ? this.deps.teams.findById(agent.teamId) : null;

    const historyLimit = Math.max(2, opts.historyLimit ?? DEFAULT_HISTORY_LIMIT);
    const memoryLimit = Math.max(1, opts.memoryLimit ?? DEFAULT_MEMORY_LIMIT);

    // 1. Retrieve memories relevant to this user message.
    const memoryContext = await this.memoryManager.getContextForPrompt(
      agentId,
      userMessage,
      memoryLimit,
    );
    const memoriesUsed = memoryContext.memories;
    if (memoriesUsed.length > 0) {
      this.emit('memory:used', {
        agentId,
        memoryIds: memoriesUsed.map((m) => m.id),
      });
    }

    // 2. Build the system prompt.
    const tools = this.deps.skillRegistry.getToolsForAgent(agent);
    const hasDelegate = tools.some((t) => t.function.name === 'agent_delegate');
    const systemPrompt =
      PromptBuilder.buildSystemPrompt({
        agent,
        memories: memoriesUsed,
        teamInstructions: team?.instructions,
        systemPromptPrefix: delegationSuffix(hasDelegate) || undefined,
      }) + (memoryContext.summary ? `\n\n## Conversation Summary\n${memoryContext.summary.summary}` : '');

    // 3. Recent history (excluding the current user message, which we'll add
    //    explicitly so callers can re-run with edited content if they want).
    const recentRaw = this.deps.messages.findRecent(chatRoomId, historyLimit + 1);
    const history = recentRaw
      .filter((m) => m.id !== parentMessageId)
      .slice(-historyLimit);

    const llmMessages: LLMMessage[] = PromptBuilder.buildChatMessages({
      systemPrompt,
      history,
      userMessage,
    });

    // 4. Create the assistant message shell (will be filled during streaming).
    const assistantMessage = this.deps.messages.create({
      chatRoomId,
      senderType: 'agent',
      senderId: agent.id,
      content: '',
      role: 'assistant',
      parentId: parentMessageId,
      isStreaming: true,
      metadata: { agentName: agent.name, agentColor: agent.color ?? null },
    });

    this.emit('agent:start', {
      agentId,
      chatRoomId,
      messageId: assistantMessage.id,
      parentMessageId,
    });
    this.emit('agent:thinking', { agentId, messageId: assistantMessage.id });

    const client = (await this.deps.providerManager.createClient(
      agent.providerId,
    )) as unknown as ChatClient;

    const toolExecutions: ToolExecution[] = [];
    let finalContent = '';
    let memoriesCreated: Memory[] = [];

    try {
      finalContent = await this.runAgentLoop({
        agent,
        client,
        tools,
        chatRoomId,
        llmMessages,
        assistantMessageId: assistantMessage.id,
        stream,
        signal,
        toolExecutions,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.deps.messages.update(assistantMessage.id, {
        isStreaming: false,
        content: assistantMessage.content || `[error] ${message}`,
        metadata: {
          ...(assistantMessage.metadata ?? {}),
          error: message,
          failed: true,
        },
      });
      this.emit('agent:error', {
        agentId,
        messageId: assistantMessage.id,
        error: message,
      });
      throw err;
    }

    // 5. Mark message complete and persist final state.
    const updated = this.deps.messages.update(assistantMessage.id, {
      content: finalContent,
      isStreaming: false,
    });
    const persistedMessage = updated ?? {
      ...assistantMessage,
      content: finalContent,
      isStreaming: false,
    };

    // 6. Extract memories from the new assistant turn (best effort).
    if (finalContent && finalContent.trim()) {
      try {
        memoriesCreated = await this.memoryManager.extractAndStore(
          agentId,
          finalContent,
          persistedMessage.id,
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[AgentRunner] memory extraction failed:', err);
      }
      if (memoriesCreated.length > 0) {
        this.emit('memory:created', { agentId, memories: memoriesCreated });
      }
    }

    this.emit('agent:done', {
      agentId,
      messageId: persistedMessage.id,
      finalContent,
    });

    return {
      messageId: persistedMessage.id,
      agentMessage: persistedMessage,
      toolExecutions,
      memoriesUsed,
      memoriesCreated,
      finalContent,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Agent loop: handle tool_calls, re-call LLM, until done.            */
  /* ------------------------------------------------------------------ */

  private async runAgentLoop(args: {
    agent: Agent;
    client: ChatClient;
    tools: LLMTool[];
    chatRoomId: string;
    llmMessages: LLMMessage[];
    assistantMessageId: string;
    stream: boolean;
    signal?: AbortSignal;
    toolExecutions: ToolExecution[];
  }): Promise<string> {
    const {
      agent,
      client,
      tools,
      chatRoomId,
      assistantMessageId,
      stream,
      signal,
      toolExecutions,
    } = args;
    let messages = args.llmMessages;
    let finalContent = '';

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const chatReq: ChatRequest = {
        provider: (client as unknown as LLMClient).provider,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        toolChoice: tools.length > 0 ? 'auto' : undefined,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        stream,
        signal,
      };

      let content = '';
      let toolCalls: LLMToolCall[] | undefined;
      let finishReason = 'stop';

      if (stream) {
        const result = await this.streamTurn(client, chatReq, assistantMessageId);
        content = result.content;
        toolCalls = result.toolCalls.length > 0 ? result.toolCalls : undefined;
        finishReason = result.finishReason;
      } else {
        const result = await client.chat(chatReq);
        content = result.content ?? '';
        toolCalls = result.toolCalls;
        finishReason = result.finishReason;
        if (content) {
          this.deps.messages.appendContent(assistantMessageId, content);
          this.emit('agent:content', {
            agentId: agent.id,
            messageId: assistantMessageId,
            delta: content,
            content,
          });
        }
      }

      finalContent = content;

      // If the model wants to call tools, execute them and continue.
      if (toolCalls && toolCalls.length > 0) {
        // Record the assistant turn that contains the tool_calls.
        const assistantTurn: LLMMessage = {
          role: 'assistant',
          content: content || null,
          toolCalls,
        };
        messages = [...messages, assistantTurn];

        // Persist the tool_calls onto the message so future replay works.
        this.deps.messages.update(assistantMessageId, {
          toolCalls,
          content: content,
        });

        for (const toolCall of toolCalls) {
          if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          this.emit('agent:tool_call', {
            agentId: agent.id,
            messageId: assistantMessageId,
            toolCall,
          });

          const result = await this.executeToolCall({
            agent,
            toolCall,
            chatRoomId,
            messageId: assistantMessageId,
            signal,
          });

          toolExecutions.push(result.execution);
          this.emit('agent:tool_result', {
            agentId: agent.id,
            messageId: assistantMessageId,
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            result: result.result.output,
            ok: result.result.ok,
          });

          const toolMessage: LLMMessage = {
            role: 'tool',
            content: result.result.output,
            toolCallId: toolCall.id,
            name: toolCall.function.name,
          };
          messages = [...messages, toolMessage];
        }

        // Update the message with the current content + any accumulated
        // tool calls. Then continue to the next iteration.
        continue;
      }

      // No tool calls — we're done.
      void finishReason;
      return finalContent;
    }

    // Exhausted iterations; return what we have. Caller still treats this as
    // a successful completion with a possibly truncated tool loop.
    return finalContent;
  }

  /* ------------------------------------------------------------------ */
  /* Streaming helper                                                   */
  /* ------------------------------------------------------------------ */

  private async streamTurn(
    client: ChatClient,
    req: ChatRequest,
    messageId: string,
  ): Promise<{ content: string; toolCalls: LLMToolCall[]; finishReason: string }> {
    let content = '';
    const accumulator = new ToolCallAccumulator();
    let finishReason = 'stop';
    let sawError: string | null = null;

    try {
      for await (const chunk of client.chatStream(req)) {
        if (chunk.type === 'start') {
          // nothing to do; arrival of the stream is enough
          continue;
        }
        if (chunk.type === 'content') {
          const delta = chunk.contentDelta ?? '';
          if (!delta) continue;
          content += delta;
          this.deps.messages.appendContent(messageId, delta);
          this.emit('agent:content', {
            agentId: this.lastAgentId ?? '',
            messageId,
            delta,
            content,
          });
          continue;
        }
        if (chunk.type === 'tool_call') {
          const tc = chunk.toolCall;
          if (!tc) continue;
          // We need the *delta* from the raw chunk; the chunk.toolCall is
          // already-merged for the *snapshot*. To still get correct merging
          // when the chunk emits merged snapshots, we re-derive the delta by
          // comparing to the previous accumulator state for this index.
          // The simplest approach: find the index of this tool call by id.
          const index = this.indexForToolCall(accumulator, tc);
          accumulator.addDelta(index, {
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          });
          continue;
        }
        if (chunk.type === 'done') {
          if (chunk.finishReason) finishReason = chunk.finishReason;
          break;
        }
        if (chunk.type === 'error') {
          sawError = chunk.error ?? 'Unknown stream error';
          break;
        }
      }
    } catch (err) {
      sawError = err instanceof Error ? err.message : String(err);
    }

    if (sawError) {
      throw new LLMError(sawError);
    }

    return {
      content,
      toolCalls: accumulator.getAll(),
      finishReason,
    };
  }

  private lastAgentId: string | null = null;

  private indexForToolCall(acc: ToolCallAccumulator, tc: LLMToolCall): number {
    // Look for an existing slot whose id matches.
    const snap = acc.snapshot();
    const existing = snap.find((s) => s.id === tc.id);
    if (existing) return existing.index;
    // Otherwise this is a new call — take the next free index.
    return acc.size();
  }

  /* ------------------------------------------------------------------ */
  /* Tool execution                                                     */
  /* ------------------------------------------------------------------ */

  private async executeToolCall(args: {
    agent: Agent;
    toolCall: LLMToolCall;
    chatRoomId: string;
    messageId: string;
    signal?: AbortSignal;
  }): Promise<{ result: SkillExecutionResult; execution: ToolExecution }> {
    const { agent, toolCall, chatRoomId, messageId, signal } = args;
    try {
      const result = await this.deps.skillExecutor.execute(agent, toolCall, {
        chatRoomId,
        messageId,
        signal,
      });
      const execution = await this.deps.skillExecutor.record(
        messageId,
        toolCall,
        result,
        result.ok ? 'success' : 'error',
      );
      return { result, execution };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failure: SkillExecutionResult = {
        ok: false,
        output: '',
        error: message,
      };
      try {
        const execution = await this.deps.skillExecutor.record(
          messageId,
          toolCall,
          failure,
          'error',
        );
        return { result: failure, execution };
      } catch {
        // If even recording fails, synthesize a minimal execution record so
        // the agent loop can keep going.
        return {
          result: failure,
          execution: {
            id: `tool_${messageId}_${toolCall.id}`,
            messageId,
            toolName: toolCall.function.name,
            arguments: toolCall.function.arguments,
            status: 'error',
            startedAt: Date.now(),
            completedAt: Date.now(),
            error: message,
          },
        };
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Utilities                                                          */
  /* ------------------------------------------------------------------ */

  private emit<K extends keyof OrchestratorEventMap>(
    event: K,
    payload: OrchestratorEventMap[K],
  ): void {
    this.deps.eventBus.emit(event, payload);
  }

  private shouldStream(): boolean {
    try {
      const settings = this.deps.settings.get();
      return settings.streamResponses !== false;
    } catch {
      return true;
    }
  }
}