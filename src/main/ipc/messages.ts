/**
 * IPC handlers for chat messages (CRUD + search).
 *
 * Streaming and team-chat orchestration are handled in `chat.ts`; this
 * module only does message persistence.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse, LLMChatRole, Message, MessageMetadata, SenderType } from '../../shared/types';
import type { MessageRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:messages');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

const SENDER_TYPES: SenderType[] = ['user', 'agent', 'system'];
const ROLES: LLMChatRole[] = ['system', 'user', 'assistant', 'tool'];

export interface MessageHandlerDeps {
  messages: MessageRepository;
}

export function registerMessageHandlers(deps: MessageHandlerDeps): void {
  const { messages: repo } = deps;

  ipcMain.handle(IPC_CHANNELS.MESSAGE.LIST, async (
    _evt,
    args: { chatRoomId: string; limit?: number; offset?: number },
  ): Promise<ApiResponse<Message[]>> => {
    try {
      if (!args?.chatRoomId) return fail('chatRoomId is required');
      const limit = clampInt(args.limit, 1, 1000, 100);
      const offset = clampInt(args.offset, 0, Number.MAX_SAFE_INTEGER, 0);
      const messages = repo
        .findByChatRoom(String(args.chatRoomId), limit, offset)
        .filter((m) => !m.isStreaming);
      return ok(messages);
    } catch (err) {
      return failErr('MESSAGE.LIST', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MESSAGE.GET, async (_evt, id: string): Promise<ApiResponse<Message | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.findById(id));
    } catch (err) {
      return failErr('MESSAGE.GET', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MESSAGE.CREATE, async (
    _evt,
    input: Partial<Message>,
  ): Promise<ApiResponse<Message>> => {
    try {
      const created = repo.create(sanitizeMessageInput(input));
      return ok(created);
    } catch (err) {
      return failErr('MESSAGE.CREATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MESSAGE.DELETE, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.delete(id));
    } catch (err) {
      return failErr('MESSAGE.DELETE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MESSAGE.CLEAR, async (
    _evt,
    args: { chatRoomId: string },
  ): Promise<ApiResponse<number>> => {
    try {
      if (!args?.chatRoomId) return fail('chatRoomId is required');
      const count = repo.deleteByChatRoom(String(args.chatRoomId));
      return ok(count);
    } catch (err) {
      return failErr('MESSAGE.CLEAR', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.MESSAGE.SEARCH, async (
    _evt,
    args: { chatRoomId: string; query: string },
  ): Promise<ApiResponse<Message[]>> => {
    try {
      if (!args?.chatRoomId) return fail('chatRoomId is required');
      const query = String(args.query ?? '').trim();
      if (!query) return ok([]);
      return ok(repo.searchInChatRoom(String(args.chatRoomId), query));
    } catch (err) {
      return failErr('MESSAGE.SEARCH', err);
    }
  });
}

function sanitizeMessageInput(input: Partial<Message> | undefined): import('../db/repositories/messages').MessageCreateInput {
  if (!input) throw new Error('input is required');
  if (!input.chatRoomId) throw new Error('chatRoomId is required');
  const senderType: SenderType = SENDER_TYPES.includes(input.senderType as SenderType)
    ? (input.senderType as SenderType)
    : 'user';
  const role: LLMChatRole | undefined = input.role && ROLES.includes(input.role as LLMChatRole)
    ? (input.role as LLMChatRole)
    : undefined;
  return {
    chatRoomId: String(input.chatRoomId),
    senderType,
    senderId: String(input.senderId ?? senderType),
    content: input.content ?? '',
    role,
    toolCalls: Array.isArray(input.toolCalls) ? input.toolCalls : undefined,
    toolCallId: input.toolCallId ?? undefined,
    parentId: input.parentId ?? undefined,
    metadata: (input.metadata ?? undefined) as MessageMetadata | undefined,
    isStreaming: input.isStreaming ?? false,
    id: input.id ?? undefined,
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : undefined,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
