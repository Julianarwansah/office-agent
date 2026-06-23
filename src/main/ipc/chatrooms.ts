/**
 * IPC handlers for chat rooms.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse, ChatRoom, ChatRoomType } from '../../shared/types';
import type { ChatRoomRepository, AgentRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:chatrooms');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export interface ChatRoomHandlerDeps {
  chatrooms: ChatRoomRepository;
  agents?: AgentRepository;
}

export function registerChatRoomHandlers(deps: ChatRoomHandlerDeps): void {
  const { chatrooms: repo } = deps;

  ipcMain.handle(IPC_CHANNELS.CHATROOM.LIST, async (): Promise<ApiResponse<ChatRoom[]>> => {
    try {
      return ok(repo.findAll());
    } catch (err) {
      return failErr('CHATROOM.LIST', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHATROOM.GET, async (_evt, id: string): Promise<ApiResponse<ChatRoom | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.findById(id));
    } catch (err) {
      return failErr('CHATROOM.GET', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHATROOM.CREATE, async (_evt, input: Partial<ChatRoom>): Promise<ApiResponse<ChatRoom>> => {
    try {
      const sanitized = sanitizeChatRoomInput(input);
      const validationError = validateChatRoomAgents(sanitized.type ?? 'team', sanitized.agentIds ?? [], deps);
      if (validationError) return fail(validationError);
      const created = repo.create(sanitized);
      return ok(created);
    } catch (err) {
      return failErr('CHATROOM.CREATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHATROOM.UPDATE, async (
    _evt,
    id: string,
    partial: Partial<ChatRoom>,
  ): Promise<ApiResponse<ChatRoom | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      const existing = repo.findById(id);
      if (!existing) return ok(null);
      const sanitized = sanitizeChatRoomUpdate(partial);
      const nextType = sanitized.type ?? existing.type;
      const nextAgentIds = sanitized.agentIds ?? existing.agentIds;
      const validationError = validateChatRoomAgents(nextType, nextAgentIds, deps);
      if (validationError) return fail(validationError);
      const updated = repo.update(id, sanitized);
      return ok(updated);
    } catch (err) {
      return failErr('CHATROOM.UPDATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHATROOM.DELETE, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.delete(id));
    } catch (err) {
      return failErr('CHATROOM.DELETE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHATROOM.ADD_AGENT, async (
    _evt,
    args: { chatRoomId: string; agentId: string },
  ): Promise<ApiResponse<boolean>> => {
    try {
      if (!args?.chatRoomId || !args?.agentId) return fail('chatRoomId and agentId are required');
      const room = repo.findById(args.chatRoomId);
      if (!room) return fail(`Chatgrub not found: ${args.chatRoomId}`);
      if (room.type === 'global') return fail('Global chatgrub membership is dynamic');
      if (deps.agents && !deps.agents.findById(args.agentId)) return fail(`Agent not found: ${args.agentId}`);
      if (room.type === 'direct' && !room.agentIds.includes(args.agentId) && room.agentIds.length >= 1) {
        return fail('Direct chatgrub requires exactly one agent');
      }
      return ok(repo.addAgent(args.chatRoomId, args.agentId));
    } catch (err) {
      return failErr('CHATROOM.ADD_AGENT', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHATROOM.REMOVE_AGENT, async (
    _evt,
    args: { chatRoomId: string; agentId: string },
  ): Promise<ApiResponse<boolean>> => {
    try {
      if (!args?.chatRoomId || !args?.agentId) return fail('chatRoomId and agentId are required');
      const room = repo.findById(args.chatRoomId);
      if (!room) return fail(`Chatgrub not found: ${args.chatRoomId}`);
      if (room.type === 'global') return fail('Global chatgrub membership is dynamic');
      if (room.type === 'direct' && room.agentIds.includes(args.agentId)) {
        return fail('Direct chatgrub requires exactly one agent');
      }
      return ok(repo.removeAgent(args.chatRoomId, args.agentId));
    } catch (err) {
      return failErr('CHATROOM.REMOVE_AGENT', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHATROOM.SET_AGENTS, async (
    _evt,
    args: { chatRoomId: string; agentIds: string[] },
  ): Promise<ApiResponse<boolean>> => {
    try {
      if (!args?.chatRoomId || !Array.isArray(args.agentIds)) {
        return fail('chatRoomId and agentIds[] are required');
      }
      const room = repo.findById(args.chatRoomId);
      if (!room) return fail(`Chatgrub not found: ${args.chatRoomId}`);
      if (room.type === 'global') return fail('Global chatgrub membership is dynamic');
      const agentIds = uniqueIds(args.agentIds);
      const validationError = validateChatRoomAgents(room.type, agentIds, deps);
      if (validationError) return fail(validationError);
      return ok(repo.setAgents(args.chatRoomId, agentIds));
    } catch (err) {
      return failErr('CHATROOM.SET_AGENTS', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHATROOM.GET_OR_CREATE_DIRECT, async (
    _evt,
    args: { agentId: string },
  ): Promise<ApiResponse<ChatRoom>> => {
    try {
      if (!args?.agentId || typeof args.agentId !== 'string') {
        return fail('agentId is required');
      }
      const agentId = String(args.agentId);

      if (!deps.agents) {
        return fail('AgentRepository is not available to resolve agent for direct chatgrub');
      }
      const agent = deps.agents.findById(agentId);
      if (!agent) return fail(`Agent not found: ${agentId}`);

      const existing = repo
        .findAll()
        .find((c) => c.type === 'direct' && c.agentIds.length === 1 && c.agentIds[0] === agentId);
      if (existing) return ok(existing);

      const created = repo.create({
        name: agent.name,
        description: `Direct chat with ${agent.name}`,
        type: 'direct',
        agentIds: [agentId],
      });
      return ok(created);
    } catch (err) {
      return failErr('CHATROOM.GET_OR_CREATE_DIRECT', err);
    }
  });
}

function sanitizeChatRoomInput(input: Partial<ChatRoom> | undefined): import('../db/repositories/chatrooms').ChatRoomCreateInput {
  if (!input) return { name: 'Untitled', type: 'team' };
  const allowed: ChatRoomType[] = ['team', 'direct', 'global'];
  const type: ChatRoomType = allowed.includes(input.type as ChatRoomType)
    ? (input.type as ChatRoomType)
    : 'team';
  const agentIds = uniqueIds(input.agentIds);
  return {
    name: String(input.name ?? 'Untitled'),
    description: input.description ?? undefined,
    teamId: input.teamId ?? undefined,
    type,
    agentIds: type === 'global' ? undefined : agentIds,
  };
}

function sanitizeChatRoomUpdate(input: Partial<ChatRoom> | undefined): import('../db/repositories/chatrooms').ChatRoomUpdateInput {
  if (!input) return {};
  const out: import('../db/repositories/chatrooms').ChatRoomUpdateInput = {};
  if (input.name !== undefined) out.name = String(input.name);
  if (input.description !== undefined) out.description = input.description ?? undefined;
  if (input.teamId !== undefined) out.teamId = input.teamId ?? undefined;
  if (input.type !== undefined) {
    const allowed: ChatRoomType[] = ['team', 'direct', 'global'];
    out.type = allowed.includes(input.type as ChatRoomType) ? (input.type as ChatRoomType) : 'team';
  }
  if (Array.isArray(input.agentIds)) {
    out.agentIds = out.type === 'global' ? [] : uniqueIds(input.agentIds);
  }
  return out;
}

function uniqueIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id)).filter(Boolean))];
}

function validateChatRoomAgents(
  type: ChatRoomType,
  agentIds: string[],
  deps: ChatRoomHandlerDeps,
): string | null {
  if (type === 'global') return null;
  if (type === 'direct' && agentIds.length !== 1) {
    return 'Direct chatgrub requires exactly one agent';
  }
  if (deps.agents) {
    const missing = agentIds.find((id) => !deps.agents?.findById(id));
    if (missing) return `Agent not found: ${missing}`;
  }
  return null;
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
