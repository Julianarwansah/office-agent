/**
 * IPC handlers for chat send/stream/cancel.
 *
 * The renderer's stores expect:
 *   - chat.send   → fire-and-forget; orchestrator runs in the background
 *   - chat.stream → fire-and-forget; orchestrator runs in the background, streaming
 *                    events are pushed to the renderer via the `orchestrator:event` IPC
 *                    channel (auto-wired in `main/index.ts`)
 *   - chat.cancel → cancel the currently-active run via AbortController
 *
 * We persist the incoming user message synchronously so it shows up in the
 * chat history immediately; the agent response is handled by the orchestrator
 * through the normal `agent:start` → `agent:content*` → `agent:done` event
 * sequence.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse, ChatRoom, Message } from '../../shared/types';
import type { Orchestrator, StreamChunkPayload } from '../orchestrator/orchestrator';
import type { MessageRepository, ChatRoomRepository, AgentRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';
import type { WindowManager } from '../window/window';

const log = createLogger('ipc:chat');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export interface ChatHandlerDeps {
  orchestrator: Orchestrator;
  messages: MessageRepository;
  chatrooms: ChatRoomRepository;
  agents: AgentRepository;
  window: WindowManager;
}

interface ActiveRun {
  controller: AbortController;
  chatRoomId: string;
  startedAt: number;
}

let activeRun: ActiveRun | null = null;

function clearActiveRun(chatRoomId: string, controller: AbortController): void {
  if (activeRun && activeRun.chatRoomId === chatRoomId && activeRun.controller === controller) {
    activeRun = null;
  }
}

export function registerChatHandlers(deps: ChatHandlerDeps): void {
  const { orchestrator, messages, chatrooms, agents, window: windowManager } = deps;

  ipcMain.handle(IPC_CHANNELS.CHAT.SEND, async (
    _evt,
    args: { chatRoomId: string; userMessage: string; mentionedAgentIds?: string[]; agentId?: string; parentMessageId?: string },
  ): Promise<ApiResponse<Message>> => {
    try {
      if (!args?.chatRoomId || typeof args.userMessage !== 'string') {
        return fail('chatRoomId and userMessage are required');
      }
      const chatRoomId = String(args.chatRoomId);
      const userMessage = String(args.userMessage);

      const room = chatrooms.findById(chatRoomId);
      if (!room) return fail(`Chatgrub not found: ${chatRoomId}`);

      const userMsg = insertUserMessage(messages, chatRoomId, userMessage, args.parentMessageId);
      const controller = new AbortController();
      const previous = activeRun;
      activeRun = { controller, chatRoomId, startedAt: Date.now() };
      if (previous) {
        try {
          previous.controller.abort();
        } catch (err) {
          log.warn('failed to abort previous run before starting new one', err);
        }
      }

      // Fire-and-forget: do not block the IPC return on the orchestrator
      // completion. Errors are surfaced via the `agent:error` event.
      void runTeamChatAsync(orchestrator, messages, windowManager, {
        chatRoomId,
        userMessage,
        userMessageId: userMsg.id,
        agentId: args.agentId,
        mentionedAgentIds: args.mentionedAgentIds,
        parentMessageId: args.parentMessageId,
        signal: controller.signal,
        onComplete: () => clearActiveRun(chatRoomId, controller),
      });

      return ok(userMsg);
    } catch (err) {
      return failErr('CHAT.SEND', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHAT.STREAM, async (
    _evt,
    args: { chatRoomId: string; userMessage: string; mentionedAgentIds?: string[]; agentId?: string; parentMessageId?: string },
  ): Promise<ApiResponse<Message>> => {
    try {
      if (!args?.chatRoomId || typeof args.userMessage !== 'string') {
        return fail('chatRoomId and userMessage are required');
      }
      const chatRoomId = String(args.chatRoomId);
      const userMessage = String(args.userMessage);

      const room: ChatRoom | null = chatrooms.findById(chatRoomId);
      if (!room) return fail(`Chatgrub not found: ${chatRoomId}`);

      const userMsg = insertUserMessage(messages, chatRoomId, userMessage, args.parentMessageId);

      // Decide which agent runs in streaming mode. The orchestrator's
      // `streamChat` requires a single agent id, so we either:
      //   - run the explicitly-mentioned agent, or
      //   - pick the lead agent for the room, or
      //   - pick the first agent in the room.
      const mentionedAgentId = args.mentionedAgentIds
        ?.map((id) => String(id))
        .find((id) => room.agentIds.includes(id));
      const requestedAgentId = args.agentId ? String(args.agentId) : undefined;
      const agentId = requestedAgentId && room.agentIds.includes(requestedAgentId)
        ? requestedAgentId
        : mentionedAgentId || room.agentIds[0] || null;
      if (!agentId) {
        return fail('No agents in chatgrub to stream from');
      }
      if (!agents.findById(agentId)) {
        return fail(`Agent not found: ${agentId}`);
      }

      const controller = new AbortController();
      const previous = activeRun;
      activeRun = { controller, chatRoomId, startedAt: Date.now() };
      if (previous) {
        try {
          previous.controller.abort();
        } catch (err) {
          log.warn('failed to abort previous run before starting new one', err);
        }
      }

      const onChunk = (chunk: StreamChunkPayload): void => {
        // The orchestrator already emits `agent:content` events that are
        // forwarded to the renderer; this callback is only a hook for
        // any future per-chunk needs (e.g. metrics).
        void chunk;
      };

      void orchestrator
        .streamChat(chatRoomId, agentId, userMessage, onChunk, {
          parentMessageId: args.parentMessageId ?? userMsg.id,
          signal: controller.signal,
        })
        .catch((err) => {
          log.error('streamChat failed', err);
        })
        .finally(() => {
          clearActiveRun(chatRoomId, controller);
        });

      return ok(userMsg);
    } catch (err) {
      return failErr('CHAT.STREAM', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHAT.CANCEL, async (): Promise<ApiResponse<void>> => {
    try {
      if (!activeRun) {
        return ok(undefined);
      }
      try {
        activeRun.controller.abort();
      } catch (err) {
        log.warn('failed to abort active run', err);
      }
      activeRun = null;
      return ok(undefined);
    } catch (err) {
      return failErr('CHAT.CANCEL', err);
    }
  });
}

function insertUserMessage(
  messages: MessageRepository,
  chatRoomId: string,
  content: string,
  parentMessageId?: string,
): Message {
  return messages.create({
    chatRoomId,
    senderType: 'user',
    senderId: 'user',
    content,
    role: 'user',
    parentId: parentMessageId ? String(parentMessageId) : undefined,
  });
}

interface TeamChatOptions {
  chatRoomId: string;
  userMessage: string;
  userMessageId: string;
  agentId?: string;
  mentionedAgentIds?: string[];
  parentMessageId?: string;
  signal: AbortSignal;
  onComplete: () => void;
}

async function runTeamChatAsync(
  orchestrator: Orchestrator,
  _messages: MessageRepository,
  _windowManager: WindowManager,
  opts: TeamChatOptions,
): Promise<void> {
  try {
    await orchestrator.runTeamChat(opts.chatRoomId, opts.userMessage, {
      agentId: opts.agentId,
      parentMessageId: opts.parentMessageId ?? opts.userMessageId,
      signal: opts.signal,
      letOthersRespond: true,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      log.info(`team chat run aborted for room ${opts.chatRoomId}`);
    } else {
      log.error('runTeamChat failed', err);
    }
  } finally {
    opts.onComplete();
  }
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
