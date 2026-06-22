/**
 * IPC handlers for agent memories.
 *
 * Read paths go through the in-memory repository. Write paths use a
 * sanitized input. LLM-backed operations (consolidate, extract) are
 * handled by the `MemoryManager`, which is wired with a provider client
 * factory at construction time.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type {
  ApiResponse,
  ConversationSummary,
  Memory,
  MemoryCategory,
  MemoryType,
} from '../../shared/types';
import type { MemoryRepository, AgentRepository } from '../db/repositories';
import type { MemoryManager } from '../orchestrator/memory-manager';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:memories');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

const MEMORY_TYPES: MemoryType[] = ['short_term', 'long_term', 'episodic', 'semantic'];
const MEMORY_CATEGORIES: MemoryCategory[] = [
  'user_preference',
  'fact',
  'instruction',
  'context',
  'task',
];

export interface MemoryHandlerDeps {
  memories: MemoryRepository;
  memoryManager: MemoryManager;
  agents: AgentRepository;
}

export function registerMemoryHandlers(deps: MemoryHandlerDeps): void {
  const { memories: repo, memoryManager, agents: agentRepo } = deps;

  ipcMain.handle(IPC_CHANNELS.MEMORY.LIST, async (
    _evt,
    args: {
      agentId?: string;
      type?: string;
      category?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<ApiResponse<Memory[]>> => {
    try {
      if (!args?.agentId) return fail('agentId is required');
      const agentId = String(args.agentId);
      const options: import('../db/repositories/memories').MemoryQueryOptions = {};
      if (args.type && MEMORY_TYPES.includes(args.type as MemoryType)) {
        options.type = args.type as MemoryType;
      }
      if (args.category && MEMORY_CATEGORIES.includes(args.category as MemoryCategory)) {
        options.category = args.category as MemoryCategory;
      }
      if (typeof args.limit === 'number') options.limit = clampInt(args.limit, 1, 1000, 1000);
      if (typeof args.offset === 'number') options.offset = clampInt(args.offset, 0, Number.MAX_SAFE_INTEGER, 0);
      return ok(repo.findByAgent(agentId, options));
    } catch (err) {
      return failErr('MEMORY.LIST', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY.GET, async (_evt, id: string): Promise<ApiResponse<Memory | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.findById(id));
    } catch (err) {
      return failErr('MEMORY.GET', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY.CREATE, async (
    _evt,
    input: Partial<Memory>,
  ): Promise<ApiResponse<Memory>> => {
    try {
      const created = repo.create(sanitizeMemoryInput(input));
      return ok(created);
    } catch (err) {
      return failErr('MEMORY.CREATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY.UPDATE, async (
    _evt,
    id: string,
    partial: Partial<Memory>,
  ): Promise<ApiResponse<Memory | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.update(id, sanitizeMemoryUpdate(partial)));
    } catch (err) {
      return failErr('MEMORY.UPDATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY.DELETE, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.delete(id));
    } catch (err) {
      return failErr('MEMORY.DELETE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY.DELETE_ALL, async (
    _evt,
    args: { agentId: string },
  ): Promise<ApiResponse<number>> => {
    try {
      if (!args?.agentId) return fail('agentId is required');
      const count = repo.deleteByAgent(String(args.agentId));
      return ok(count);
    } catch (err) {
      return failErr('MEMORY.DELETE_ALL', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY.PIN, async (_evt, id: string): Promise<ApiResponse<Memory | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.update(id, { isPinned: true }));
    } catch (err) {
      return failErr('MEMORY.PIN', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY.UNPIN, async (_evt, id: string): Promise<ApiResponse<Memory | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.update(id, { isPinned: false }));
    } catch (err) {
      return failErr('MEMORY.UNPIN', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY.SEARCH, async (
    _evt,
    args: { agentId: string; query: string; limit?: number; threshold?: number },
  ): Promise<ApiResponse<Memory[]>> => {
    try {
      if (!args?.agentId) return fail('agentId is required');
      const query = String(args.query ?? '').trim();
      if (!query) return ok([]);
      const limit = clampInt(args.limit, 1, 200, 20);
      const threshold = typeof args.threshold === 'number'
        ? Math.max(0, Math.min(1, args.threshold))
        : 0;
      return ok(repo.getTopRelevant(String(args.agentId), query, limit, threshold));
    } catch (err) {
      return failErr('MEMORY.SEARCH', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY.CONSOLIDATE, async (
    _evt,
    args: { agentId: string; chatRoomId: string },
  ): Promise<ApiResponse<ConversationSummary | null>> => {
    try {
      if (!args?.agentId || !args?.chatRoomId) {
        return fail('agentId and chatRoomId are required');
      }
      const agent = agentRepo.findById(String(args.agentId));
      if (!agent) return fail(`Agent not found: ${args.agentId}`);
      const result = await memoryManager.consolidate(
        String(args.agentId),
        String(args.chatRoomId),
        agent.providerId,
      );
      return ok(result);
    } catch (err) {
      return failErr('MEMORY.CONSOLIDATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY.EXTRACT, async (
    _evt,
    args: { agentId: string; text: string; sourceMessageId?: string },
  ): Promise<ApiResponse<Memory[]>> => {
    try {
      if (!args?.agentId || typeof args.text !== 'string') {
        return fail('agentId and text are required');
      }
      const text = String(args.text);
      if (!text.trim()) return ok([]);
      const agent = agentRepo.findById(String(args.agentId));
      if (!agent) return fail(`Agent not found: ${args.agentId}`);
      const result = await memoryManager.extractAndStoreLLM(
        String(args.agentId),
        agent.providerId,
        text,
        args.sourceMessageId ? String(args.sourceMessageId) : undefined,
      );
      return ok(result);
    } catch (err) {
      return failErr('MEMORY.EXTRACT', err);
    }
  });
}

function sanitizeMemoryInput(input: Partial<Memory> | undefined): import('../db/repositories/memories').MemoryCreateInput {
  if (!input) throw new Error('input is required');
  if (!input.agentId) throw new Error('agentId is required');
  if (typeof input.content !== 'string' || !input.content.trim()) {
    throw new Error('content is required');
  }
  const type: MemoryType = MEMORY_TYPES.includes(input.type as MemoryType)
    ? (input.type as MemoryType)
    : 'long_term';
  const category: MemoryCategory = MEMORY_CATEGORIES.includes(input.category as MemoryCategory)
    ? (input.category as MemoryCategory)
    : 'context';
  return {
    agentId: String(input.agentId),
    type,
    content: String(input.content),
    importance: typeof input.importance === 'number' ? Math.max(0, Math.min(1, input.importance)) : 0.5,
    category,
    isPinned: Boolean(input.isPinned),
    sourceMessageId: input.sourceMessageId ?? undefined,
  };
}

function sanitizeMemoryUpdate(input: Partial<Memory> | undefined): import('../db/repositories/memories').MemoryUpdateInput {
  if (!input) return {};
  const out: import('../db/repositories/memories').MemoryUpdateInput = {};
  if (input.type !== undefined && MEMORY_TYPES.includes(input.type as MemoryType)) {
    out.type = input.type as MemoryType;
  }
  if (input.content !== undefined) out.content = String(input.content);
  if (input.importance !== undefined && typeof input.importance === 'number') {
    out.importance = Math.max(0, Math.min(1, input.importance));
  }
  if (input.category !== undefined && MEMORY_CATEGORIES.includes(input.category as MemoryCategory)) {
    out.category = input.category as MemoryCategory;
  }
  if (input.isPinned !== undefined) out.isPinned = Boolean(input.isPinned);
  if (input.sourceMessageId !== undefined) out.sourceMessageId = input.sourceMessageId ?? undefined;
  return out;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
