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
      const created = repo.create(sanitizeChatRoomInput(input));
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
      const updated = repo.update(id, sanitizeChatRoomUpdate(partial));
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
      repo.addAgent(args.chatRoomId, args.agentId);
      return ok(true);
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
      repo.removeAgent(args.chatRoomId, args.agentId);
      return ok(true);
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
      repo.setAgents(args.chatRoomId, args.agentIds.map((id) => String(id)));
      return ok(true);
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
        return fail('AgentRepository is not available to resolve agent for direct chatroom');
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
  return {
    name: String(input.name ?? 'Untitled'),
    description: input.description ?? undefined,
    teamId: input.teamId ?? undefined,
    type,
    agentIds: Array.isArray(input.agentIds) ? input.agentIds.map((id) => String(id)) : undefined,
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
    out.agentIds = input.agentIds.map((id) => String(id));
  }
  return out;
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
