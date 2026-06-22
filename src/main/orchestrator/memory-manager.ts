/**
 * MemoryManager — owns the read/write paths for agent memory:
 *   - retrieval of relevant memories for a given prompt
 *   - extraction of candidate memories from conversation text
 *   - consolidation of long conversations into summaries
 *   - assembly of the per-prompt memory context (memories + summary)
 */

import { LLMClient } from '../llm/client';
import { LLMError, ChatRequest } from '../llm/types';
import { PromptBuilder } from '../llm/prompt-builder';
import {
  CONSOLIDATION_SYSTEM,
  CONSOLIDATION_USER,
  MEMORY_EXTRACTION_SYSTEM,
  MEMORY_EXTRACTION_USER,
} from './prompts';
import type {
  ConversationSummary,
  Memory,
  Message,
} from '../../shared/types';
import type {
  MemoryRepositoryLike,
  MessageRepositoryLike,
  SettingsRepositoryLike,
  SummaryRepositoryLike,
} from './types';

/** Minimum number of recent messages before a consolidation pass is worthwhile. */
const CONSOLIDATION_MIN_MESSAGES = 10;
/** Maximum number of recent messages fed into the consolidator. */
const CONSOLIDATION_MAX_MESSAGES = 20;

export interface MemoryContext {
  memories: Memory[];
  summary?: ConversationSummary;
}

export interface ExtractAndStoreOptions {
  /** Hard cap on the number of memories to create per call. */
  maxToCreate?: number;
  /** Override the importance threshold (otherwise uses settings). */
  threshold?: number;
}

export class MemoryManager {
  constructor(
    private readonly memoryRepo: MemoryRepositoryLike,
    private readonly summaryRepo: SummaryRepositoryLike,
    private readonly messageRepo: MessageRepositoryLike,
    private readonly settingsRepo: SettingsRepositoryLike,
    /** Client factory used to obtain an LLMClient for a given provider. */
    private readonly clientFactory: (providerId: string) => Promise<LLMClient>,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Retrieval                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Retrieve up to `k` memories most relevant to `query` for `agentId`,
   * filtered by importance. Calls `touchAccess` on every hit so frequently
   * used memories stay warm.
   */
  async retrieveRelevant(
    agentId: string,
    query: string,
    k = 10,
  ): Promise<Memory[]> {
    const settings = this.safeGetSettings();
    const limit = Math.max(1, Math.min(k, settings.maxMemoryItems || k));
    const threshold =
      typeof settings.memoryImportanceThreshold === 'number'
        ? settings.memoryImportanceThreshold
        : 0;
    const memories = this.memoryRepo.getTopRelevant(
      agentId,
      query,
      limit,
      threshold,
    );
    for (const m of memories) {
      try {
        this.memoryRepo.touchAccess(m.id);
      } catch {
        // touchAccess failures must never break retrieval.
      }
    }
    return memories;
  }

  /* ------------------------------------------------------------------ */
  /* Extraction + persistence                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Use the cheap heuristic extractor to find candidate memories in a block
   * of text and persist any that pass the importance threshold.
   */
  async extractAndStore(
    agentId: string,
    conversationText: string,
    sourceMessageId?: string,
    options: ExtractAndStoreOptions = {},
  ): Promise<Memory[]> {
    if (!conversationText || !conversationText.trim()) return [];
    const settings = this.safeGetSettings();
    const threshold =
      options.threshold ?? settings.memoryImportanceThreshold ?? 0;
    const cap = options.maxToCreate ?? 5;

    const candidates = PromptBuilder.extractMemoriesViaHeuristic(conversationText);
    const created: Memory[] = [];
    for (const cand of candidates) {
      if (created.length >= cap) break;
      if (cand.importance < threshold) continue;
      try {
        const memory = this.memoryRepo.create({
          agentId,
          type: 'long_term',
          content: cand.content,
          importance: cand.importance,
          category: cand.category,
          isPinned: false,
          sourceMessageId,
        });
        created.push(memory);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[MemoryManager] failed to persist candidate memory:', err);
      }
    }
    return created;
  }

  /**
   * Extract candidate memories from a list of messages (joined as plain text)
   * and persist any above threshold. Convenience over `extractAndStore`.
   */
  async extractFromMessages(
    agentId: string,
    messages: Message[],
    sourceMessageId?: string,
    options: ExtractAndStoreOptions = {},
  ): Promise<Memory[]> {
    const text = messages.map(messageToText).join('\n');
    return this.extractAndStore(agentId, text, sourceMessageId, options);
  }

  /* ------------------------------------------------------------------ */
  /* Consolidation                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * If the chatroom has more than `CONSOLIDATION_MIN_MESSAGES` recent
   * messages, ask the LLM to summarize them and persist the result.
   * Returns `null` when there is nothing worth consolidating.
   */
  async consolidate(
    agentId: string,
    chatRoomId: string,
    providerId: string,
  ): Promise<ConversationSummary | null> {
    const recent = this.messageRepo.findRecent(
      chatRoomId,
      CONSOLIDATION_MAX_MESSAGES,
    );
    if (recent.length < CONSOLIDATION_MIN_MESSAGES) return null;

    const transcript = recent.map(messageToText).join('\n');
    let summary: string;
    try {
      summary = await this.summarizeWithLLM(providerId, transcript);
    } catch (err) {
      // Consolidation is best-effort; do not throw back to the caller.
      // eslint-disable-next-line no-console
      console.error('[MemoryManager] consolidation failed:', err);
      return null;
    }
    if (!summary || !summary.trim()) return null;

    const start = recent[0];
    const end = recent[recent.length - 1];
    try {
      return this.summaryRepo.create({
        agentId,
        chatRoomId,
        summary: summary.trim(),
        messageCount: recent.length,
        startMessageId: start?.id,
        endMessageId: end?.id,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MemoryManager] failed to persist summary:', err);
      return null;
    }
  }

  /**
   * Return the latest summary for this agent, if any.
   */
  async getLatestSummary(agentId: string): Promise<ConversationSummary | undefined> {
    const all = this.summaryRepo.findByAgent(agentId);
    if (!all || all.length === 0) return undefined;
    return [...all].sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  /* ------------------------------------------------------------------ */
  /* Combined context                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Assemble the full memory context for a single prompt: top-k relevant
   * memories for `query` plus the agent's most recent conversation summary.
   */
  async getContextForPrompt(
    agentId: string,
    query: string,
    k = 10,
  ): Promise<MemoryContext> {
    const [memories, summary] = await Promise.all([
      this.retrieveRelevant(agentId, query, k),
      this.getLatestSummary(agentId),
    ]);
    return { memories, summary };
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                          */
  /* ------------------------------------------------------------------ */

  private async summarizeWithLLM(
    providerId: string,
    transcript: string,
  ): Promise<string> {
    const client = await this.clientFactory(providerId);
    const provider = client.provider;
    const req: ChatRequest = {
      provider,
      messages: [
        { role: 'system', content: CONSOLIDATION_SYSTEM },
        { role: 'user', content: CONSOLIDATION_USER(transcript) },
      ],
      temperature: 0.2,
      maxTokens: 600,
      stream: false,
    };
    try {
      const result = await client.chat(req);
      return (result.content ?? '').trim();
    } catch (err) {
      if (err instanceof LLMError) throw err;
      throw new LLMError(
        `Summarization failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }

  /**
   * Optionally ask the LLM for richer memory extraction than the heuristic.
   * Currently unused by default but kept here for future "smart extraction"
   * features — the AgentRunner can opt in via `extractAndStoreLLM`.
   */
  async extractAndStoreLLM(
    agentId: string,
    providerId: string,
    conversationText: string,
    sourceMessageId?: string,
  ): Promise<Memory[]> {
    if (!conversationText || !conversationText.trim()) return [];
    let parsed: { memories: Array<{ content: string; category: string; importance: number }> };
    try {
      const client = await this.clientFactory(providerId);
      const provider = client.provider;
      const req: ChatRequest = {
        provider,
        messages: [
          { role: 'system', content: MEMORY_EXTRACTION_SYSTEM },
          { role: 'user', content: MEMORY_EXTRACTION_USER(conversationText) },
        ],
        temperature: 0,
        maxTokens: 600,
        stream: false,
      };
      const result = await client.chat(req);
      parsed = parseMemoryJson(result.content);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MemoryManager] LLM extraction failed:', err);
      return [];
    }
    const settings = this.safeGetSettings();
    const threshold = settings.memoryImportanceThreshold ?? 0;
    const created: Memory[] = [];
    for (const cand of parsed.memories ?? []) {
      if (!cand || typeof cand.content !== 'string' || !cand.content.trim()) continue;
      const importance = clampImportance(cand.importance);
      if (importance < threshold) continue;
      try {
        const memory = this.memoryRepo.create({
          agentId,
          type: 'long_term',
          content: cand.content.trim(),
          importance,
          category: normalizeCategory(cand.category),
          isPinned: false,
          sourceMessageId,
        });
        created.push(memory);
      } catch {
        /* ignore */
      }
    }
    return created;
  }

  private safeGetSettings() {
    try {
      return this.settingsRepo.get();
    } catch {
      return {
        theme: 'system' as const,
        localhostPort: 0,
        terminalShell: '',
        workingDirectory: '',
        maxMemoryItems: 10,
        memoryImportanceThreshold: 0,
        autoCreateMemories: true,
        streamResponses: true,
        saveHistory: true,
      };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Module helpers                                                              */
/* -------------------------------------------------------------------------- */

function messageToText(m: Message): string {
  const who =
    m.senderType === 'user' ? 'User' : m.senderType === 'agent' ? 'Agent' : 'System';
  const content = (m.content ?? '').trim();
  return `${who}: ${content}`;
}

function clampImportance(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0.5;
  return Math.max(0, Math.min(1, v));
}

function normalizeCategory(c: unknown): Memory['category'] {
  const allowed: Memory['category'][] = [
    'user_preference',
    'fact',
    'instruction',
    'context',
    'task',
  ];
  return allowed.includes(c as Memory['category'])
    ? (c as Memory['category'])
    : 'context';
}

function parseMemoryJson(raw: string): {
  memories: Array<{ content: string; category: string; importance: number }>;
} {
  if (!raw) return { memories: [] };
  // Strip optional markdown code fences the model sometimes adds.
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'memories' in parsed &&
      Array.isArray((parsed as { memories: unknown }).memories)
    ) {
      return parsed as {
        memories: Array<{ content: string; category: string; importance: number }>;
      };
    }
  } catch {
    /* swallow */
  }
  return { memories: [] };
}