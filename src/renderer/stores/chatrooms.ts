import { create } from 'zustand';
import type { ChatRoom, Message, OrchestratorEventMap } from '../../shared/types';
import { api, unwrap } from '../lib/api';
import type { ChatRoomFormData, ChatSendParams, StreamingMessageState } from '../lib/types';

interface ChatRoomsState {
  chatrooms: ChatRoom[];
  currentChatRoomId: string | null;
  messagesByRoom: Record<string, Message[]>;
  streamingMessages: Record<string, StreamingMessageState[]>;
  loading: boolean;
  loadingMessages: boolean;
  error: string | null;
  loadMessagesError: string | null;
  sendError: string | null;
  unsubscribers: Array<() => void>;

  loadChatrooms: () => Promise<void>;
  setCurrentChatRoom: (id: string | null) => void;
  createChatRoom: (data: ChatRoomFormData) => Promise<ChatRoom>;
  updateChatRoom: (id: string, data: Partial<ChatRoomFormData>) => Promise<ChatRoom | null>;
  deleteChatRoom: (id: string) => Promise<void>;
  addAgentToChatRoom: (chatRoomId: string, agentId: string) => Promise<void>;
  removeAgentFromChatRoom: (chatRoomId: string, agentId: string) => Promise<void>;
  getOrCreateDirect: (agentId: string) => Promise<ChatRoom>;

  loadMessages: (chatRoomId: string) => Promise<void>;
  appendMessage: (chatRoomId: string, msg: Message | null) => void;

  sendMessage: (params: ChatSendParams) => Promise<void>;
  clearMessages: (chatRoomId: string) => Promise<void>;
  cancelStream: (chatRoomId?: string) => Promise<void>;

  clearError: () => void;
}

function cleanupSubscriptions(
  get: () => ChatRoomsState,
  set: (partial: Partial<ChatRoomsState> | ((s: ChatRoomsState) => Partial<ChatRoomsState>)) => void,
): void {
  const { unsubscribers } = get();
  for (const off of unsubscribers) {
    try {
      off();
    } catch {
      /* ignore */
    }
  }
  set({ unsubscribers: [] });
}

export const useChatRoomsStore = create<ChatRoomsState>((set, get) => ({
  chatrooms: [],
  currentChatRoomId: null,
  messagesByRoom: {},
  streamingMessages: {},
  loading: false,
  loadingMessages: false,
  error: null,
  loadMessagesError: null,
  sendError: null,
  unsubscribers: [],

  loadChatrooms: async () => {
    set({ loading: true, error: null });
    try {
      const chatrooms = unwrap(await api.chatrooms.list());
      chatrooms.sort((a, b) => b.createdAt - a.createdAt);
      set({ chatrooms, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load chatgrub',
      });
    }
  },

  setCurrentChatRoom: (id) => set({ currentChatRoomId: id }),

  createChatRoom: async (data) => {
    const created = unwrap(await api.chatrooms.create(data as unknown as Partial<ChatRoom>));
    await get().loadChatrooms();
    return created;
  },

  updateChatRoom: async (id, data) => {
    const updated = unwrap(await api.chatrooms.update(id, data as unknown as Partial<ChatRoom>));
    await get().loadChatrooms();
    return updated;
  },

  deleteChatRoom: async (id) => {
    unwrap(await api.chatrooms.delete(id));
    set((s) => {
      const { [id]: _removedMessages, ...messagesByRoom } = s.messagesByRoom;
      const { [id]: _removedStreams, ...streamingMessages } = s.streamingMessages;
      void _removedMessages;
      void _removedStreams;
      return {
        currentChatRoomId: s.currentChatRoomId === id ? null : s.currentChatRoomId,
        messagesByRoom,
        streamingMessages,
      };
    });
    await get().loadChatrooms();
  },

  addAgentToChatRoom: async (chatRoomId, agentId) => {
    unwrap(await api.chatrooms.addAgent(chatRoomId, agentId));
    await get().loadChatrooms();
  },

  removeAgentFromChatRoom: async (chatRoomId, agentId) => {
    unwrap(await api.chatrooms.removeAgent(chatRoomId, agentId));
    await get().loadChatrooms();
  },

  getOrCreateDirect: async (agentId) => {
    const chatroom = unwrap(await api.chatrooms.getOrCreateDirect({ agentId }));
    await get().loadChatrooms();
    return chatroom;
  },

  loadMessages: async (chatRoomId) => {
    set({ loadingMessages: true, loadMessagesError: null });
    try {
      const messages = unwrap(await api.messages.list({ chatRoomId }));
      messages.sort((a, b) => a.createdAt - b.createdAt);
      set((s) => ({
        messagesByRoom: { ...s.messagesByRoom, [chatRoomId]: messages },
        loadingMessages: false,
        loadMessagesError: null,
      }));
    } catch (err) {
      set({
        loadingMessages: false,
        loadMessagesError: err instanceof Error ? err.message : 'Failed to load messages',
      });
    }
  },

  appendMessage: (chatRoomId, msg) => {
    if (!msg) return;
    set((s) => {
      const existing = s.messagesByRoom[chatRoomId] ?? [];
      return {
        messagesByRoom: {
          ...s.messagesByRoom,
          [chatRoomId]: [...existing, msg],
        },
      };
    });
  },

  sendMessage: async (params) => {
    const { chatRoomId, userMessage, mentionedAgentIds, agentId } = params;
    set({ sendError: null });
    try {
      const userMsg = unwrap(
        await api.chat.stream({
          chatRoomId,
          userMessage,
          mentionedAgentIds,
          agentId,
        } as unknown as Parameters<typeof api.chat.stream>[0]),
      );

      get().appendMessage(chatRoomId, userMsg);

      cleanupSubscriptions(get, set);
      subscribeToEvents(get, set);
    } catch (err) {
      set({
        sendError: err instanceof Error ? err.message : 'Failed to send message',
      });
      throw err;
    }
  },

  clearMessages: async (chatRoomId) => {
    unwrap(await api.messages.clear({ chatRoomId }));
    cleanupSubscriptions(get, set);
    set((s) => ({
      messagesByRoom: { ...s.messagesByRoom, [chatRoomId]: [] },
      streamingMessages: { ...s.streamingMessages, [chatRoomId]: [] },
    }));
  },

  cancelStream: async (chatRoomId?: string) => {
    const roomId = chatRoomId ?? get().currentChatRoomId;
    try {
      unwrap(await api.chat.cancel(roomId ?? undefined));
    } catch (err) {
      console.error('Failed to cancel stream:', err);
    } finally {
      cleanupSubscriptions(get, set);
      if (roomId) {
        set((s) => {
          const { [roomId]: _removed, ...rest } = s.streamingMessages;
          void _removed;
          return { streamingMessages: rest };
        });
      } else {
        set({ streamingMessages: {} });
      }
    }
  },

  clearError: () => set({ error: null, sendError: null, loadMessagesError: null }),
}));

function subscribeToEvents(
  get: () => ChatRoomsState,
  set: (partial: Partial<ChatRoomsState> | ((s: ChatRoomsState) => Partial<ChatRoomsState>)) => void,
): void {
  const subs: Array<() => void> = [];

  const offContent = api.events.onOrchestrator('agent:content', (payload: OrchestratorEventMap['agent:content']) => {
    const { chatRoomId, messageId, content } = payload;
    set((s) => {
      const list = s.streamingMessages[chatRoomId] ?? [];
      const idx = list.findIndex((m) => m.messageId === messageId);
      let updated: StreamingMessageState[];
      if (idx >= 0) {
        updated = list.slice();
        updated[idx] = {
          ...updated[idx],
          content,
          status: 'streaming',
        };
      } else {
        updated = [
          ...list,
          {
            agentId: payload.agentId,
            messageId,
            content,
            toolCalls: [],
            toolResults: [],
            status: 'streaming',
            startedAt: Date.now(),
          },
        ];
      }
      return {
        streamingMessages: { ...s.streamingMessages, [chatRoomId]: updated },
      };
    });
  });

  const offToolCall = api.events.onOrchestrator('agent:tool_call', (payload: OrchestratorEventMap['agent:tool_call']) => {
    const { chatRoomId, messageId, toolCall } = payload;
    set((s) => {
      const list = s.streamingMessages[chatRoomId] ?? [];
      const idx = list.findIndex((m) => m.messageId === messageId);
      if (idx < 0) return s;
      const updated = list.slice();
      const existing = updated[idx];
      const toolCalls = [...existing.toolCalls, toolCall];
      updated[idx] = { ...existing, toolCalls, status: 'tool_call' };
      return {
        streamingMessages: { ...s.streamingMessages, [chatRoomId]: updated },
      };
    });
  });

  const offToolResult = api.events.onOrchestrator('agent:tool_result', (payload: OrchestratorEventMap['agent:tool_result']) => {
    const { chatRoomId, messageId, toolCallId, toolName, result, ok } = payload;
    set((s) => {
      const list = s.streamingMessages[chatRoomId] ?? [];
      const idx = list.findIndex((m) => m.messageId === messageId);
      if (idx < 0) return s;
      const updated = list.slice();
      const existing = updated[idx];
      const toolResults = [
        ...existing.toolResults,
        { toolCallId, toolName, result, ok },
      ];
      updated[idx] = { ...existing, toolResults, status: 'streaming' };
      return {
        streamingMessages: { ...s.streamingMessages, [chatRoomId]: updated },
      };
    });
  });

  const offDone = api.events.onOrchestrator('agent:done', async (payload: OrchestratorEventMap['agent:done']) => {
    const { chatRoomId, messageId } = payload;
    set((s) => {
      const list = s.streamingMessages[chatRoomId] ?? [];
      const updated = list.filter((m) => m.messageId !== messageId);
      return {
        streamingMessages: { ...s.streamingMessages, [chatRoomId]: updated },
      };
    });
    try {
      const fetched = unwrap(await api.messages.get(messageId));
      if (!fetched) return;
      set((s) => {
        const existing = s.messagesByRoom[chatRoomId] ?? [];
        const idx = existing.findIndex((m) => m.id === messageId);
        let nextList: Message[];
        if (idx >= 0) {
          nextList = existing.slice();
          nextList[idx] = fetched;
        } else {
          nextList = [...existing, fetched];
        }
        nextList.sort((a, b) => a.createdAt - b.createdAt);
        return {
          messagesByRoom: { ...s.messagesByRoom, [chatRoomId]: nextList },
        };
      });
    } catch (err) {
      console.error('Failed to fetch final message:', err);
    }
  });

  const offError = api.events.onOrchestrator('agent:error', async (payload: OrchestratorEventMap['agent:error']) => {
    const { chatRoomId, messageId, error } = payload;
    if (!messageId) {
      set({ sendError: error });
      return;
    }
    set((s) => {
      const list = s.streamingMessages[chatRoomId] ?? [];
      const updated = list.filter((m) => m.messageId !== messageId);
      return { streamingMessages: { ...s.streamingMessages, [chatRoomId]: updated } };
    });
    try {
      const fetched = unwrap(await api.messages.get(messageId));
      if (!fetched) return;
      set((s) => {
        const existing = s.messagesByRoom[chatRoomId] ?? [];
        const idx = existing.findIndex((m) => m.id === messageId);
        let nextList: Message[];
        if (idx >= 0) {
          nextList = existing.slice();
          nextList[idx] = fetched;
        } else {
          nextList = [...existing, fetched];
        }
        nextList.sort((a, b) => a.createdAt - b.createdAt);
        return { messagesByRoom: { ...s.messagesByRoom, [chatRoomId]: nextList } };
      });
    } catch (err) {
      console.error('Failed to fetch error message:', err);
    }
  });

  const offStart = api.events.onOrchestrator('agent:start', (payload: OrchestratorEventMap['agent:start']) => {
    const { chatRoomId, messageId } = payload;
    set((s) => {
      const list = s.streamingMessages[chatRoomId] ?? [];
      const exists = list.some((m) => m.messageId === messageId);
      if (exists) return s;
      const updated: StreamingMessageState[] = [
        ...list,
        {
          agentId: payload.agentId,
          messageId,
          content: '',
          toolCalls: [],
          toolResults: [],
          status: 'pending',
          startedAt: Date.now(),
        },
      ];
      return {
        streamingMessages: { ...s.streamingMessages, [chatRoomId]: updated },
      };
    });
  });

  subs.push(offContent, offToolCall, offToolResult, offDone, offError, offStart);
  set({ unsubscribers: subs });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const state = useChatRoomsStore.getState();
    for (const off of state.unsubscribers) {
      try {
        off();
      } catch {
        /* ignore */
      }
    }
  });
}
