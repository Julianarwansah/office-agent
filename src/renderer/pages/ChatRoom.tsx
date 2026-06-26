import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  MessageSquare,
  Trash2,
  Bot,
  Brain,
  Send,
  AlertTriangle,
  ChevronRight,
  Pencil,
  Search,
  X,
  Loader2,
  Download,
  FileText,
} from 'lucide-react';
import { api, unwrap } from '../lib/api';
import type { ChatRoomType, Message, Agent } from '../../shared/types';
import { useChatRoomsStore } from '../stores/chatrooms';
import { useAgentsStore } from '../stores/agents';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input, { Textarea, Select } from '../components/ui/Input';
import MessageBubble from '../components/MessageBubble';
import InputArea from '../components/InputArea';
import type { ChatRoomFormData } from '../lib/types';
import { cn, formatRelative, getInitial, formatDateTime } from '../lib/utils';

const TYPE_OPTIONS: Array<{ value: ChatRoomType; label: string }> = [
  { value: 'direct', label: 'Direct - 1:1 with an agent' },
  { value: 'team', label: 'Team - multiple agents collaborating' },
  { value: 'global', label: 'Global - all available agents' },
];

const ChatRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const { chatRoomId } = useParams<{ chatRoomId?: string }>();

  const allChatrooms = useChatRoomsStore((s) => s.chatrooms);
  const chatrooms = allChatrooms.filter((c) => c.type !== 'direct');
  const currentChatRoomId = useChatRoomsStore((s) => s.currentChatRoomId);
  const setCurrentChatRoom = useChatRoomsStore((s) => s.setCurrentChatRoom);
  const messagesByRoom = useChatRoomsStore((s) => s.messagesByRoom);
  const streamingMessages = useChatRoomsStore((s) => s.streamingMessages);
  const loadingMessages = useChatRoomsStore((s) => s.loadingMessages);
  const sendError = useChatRoomsStore((s) => s.sendError);
  const sendMessage = useChatRoomsStore((s) => s.sendMessage);
  const cancelStream = useChatRoomsStore((s) => s.cancelStream);
  const removeMessage = useChatRoomsStore((s) => s.removeMessage);
  const createChatRoom = useChatRoomsStore((s) => s.createChatRoom);
  const updateChatRoom = useChatRoomsStore((s) => s.updateChatRoom);
  const deleteChatRoom = useChatRoomsStore((s) => s.deleteChatRoom);
  const loadChatrooms = useChatRoomsStore((s) => s.loadChatrooms);
  const chatroomsLoading = useChatRoomsStore((s) => s.loading);
  const chatroomsError = useChatRoomsStore((s) => s.error);
  const loadMessagesError = useChatRoomsStore((s) => s.loadMessagesError);

  const agents = useAgentsStore((s) => s.agents);
  const loadAgents = useAgentsStore((s) => s.loadAgents);
  const agentsError = useAgentsStore((s) => s.error);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Thread state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [threadReplies, setThreadReplies] = useState<Record<string, Message[]>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});

  // Export state
  const [exportOpen, setExportOpen] = useState(false);

  const effectiveId = chatRoomId ?? currentChatRoomId ?? null;

  useEffect(() => {
    void loadChatrooms();
    void loadAgents();
  }, [loadChatrooms, loadAgents]);

  useEffect(() => {
    if (chatRoomId) {
      setCurrentChatRoom(chatRoomId);
      useChatRoomsStore.setState({ sendError: null, loadMessagesError: null });
    }
  }, [chatRoomId, setCurrentChatRoom]);

  const loadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!effectiveId) return;
    if (loadedRef.current.has(effectiveId)) return;
    loadedRef.current.add(effectiveId);
    void useChatRoomsStore.getState().loadMessages(effectiveId);
  }, [effectiveId]);

  const activeChatroom = useMemo(
    () => chatrooms.find((c) => c.id === effectiveId) ?? null,
    [chatrooms, effectiveId],
  );

  const activeMessages = effectiveId ? messagesByRoom[effectiveId] ?? [] : [];
  const activeStreaming = effectiveId ? streamingMessages[effectiveId] ?? [] : [];

  const isStreaming = activeStreaming.length > 0;
  const agentsById = useMemo(() => {
    const map = new Map<string, (typeof agents)[number]>();
    for (const a of agents) map.set(a.id, a);
    return map;
  }, [agents]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastContentSig = useRef<string>('');
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sig = `${activeMessages.length}|${activeStreaming.length}|${activeStreaming.map((s) => s.content).join('|')}`;
    if (sig === lastContentSig.current) return;
    lastContentSig.current = sig;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, [activeMessages.length, activeStreaming.length, activeStreaming.map((s) => s.content).join('|')]);

  const handleSend = useCallback(async (text: string, mentionedAgentIds: string[], parentMessageId?: string) => {
    if (!effectiveId) return;
    try {
      if (parentMessageId) {
        // Sending a reply
        const reply = unwrap(await api.messages.sendReply({
          parentMessageId,
          content: text,
          senderType: 'user',
          senderId: 'user',
        }));
        // Add reply to store
        useChatRoomsStore.setState((s) => {
          const existing = s.messagesByRoom[effectiveId] ?? [];
          return {
            messagesByRoom: {
              ...s.messagesByRoom,
              [effectiveId]: [...existing, reply],
            },
          };
        });
      } else {
        await sendMessage({
          chatRoomId: effectiveId,
          userMessage: text,
          mentionedAgentIds,
        });
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to send');
    }
  }, [effectiveId, sendMessage]);

  async function handleCreate(data: ChatRoomFormData) {
    const created = await createChatRoom(data);
    setCreateOpen(false);
    navigate(`/chat/${created.id}`);
  }

  async function handleEdit(data: ChatRoomFormData) {
    if (!activeChatroom) return;
    await updateChatRoom(activeChatroom.id, data);
    setEditOpen(false);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this chatgrub? This will remove all messages.')) return;
    await deleteChatRoom(id);
    navigate('/chat');
  }

  async function handleReplyClick(message: Message) {
    setReplyingTo(message);
  }

  async function handleToggleThread(messageId: string) {
    const isExpanded = expandedThreads.has(messageId);
    if (isExpanded) {
      // Collapse
      setExpandedThreads((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    } else {
      // Expand and load replies
      setExpandedThreads((prev) => new Set(prev).add(messageId));
      try {
        const replies = unwrap(await api.messages.getThread(messageId));
        setThreadReplies((prev) => ({ ...prev, [messageId]: replies }));
      } catch (err) {
        console.error('Failed to load thread:', err);
      }
    }
  }

  function handleCancelReply() {
    setReplyingTo(null);
  }

  // Load reply counts for visible messages
  useEffect(() => {
    async function loadReplyCounts() {
      if (!effectiveId) return;
      const messages = activeMessages.filter((m) => !m.parentId);
      const counts: Record<string, number> = {};
      for (const m of messages) {
        try {
          // Use the repository method via IPC
          const res = await api.messages.getThread(m.id);
          if (res.success && res.data) {
            counts[m.id] = res.data.length;
          }
        } catch {
          // Ignore errors
        }
      }
      setReplyCounts(counts);
    }
    loadReplyCounts();
  }, [effectiveId, activeMessages]);

  const handleSearch = useCallback(async (query: string) => {
    if (!effectiveId || !query.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await api.messages.search({ chatRoomId: effectiveId, query: query.trim() });
      if (res.success && res.data) setSearchResults(res.data);
    } finally {
      setSearchLoading(false);
    }
  }, [effectiveId]);

  useEffect(() => {
    const t = setTimeout(() => { void handleSearch(searchQuery); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, handleSearch]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
    else { setSearchQuery(''); setSearchResults([]); setHighlightedMsgId(null); }
  }, [searchOpen]);

  function scrollToMessage(msgId: string) {
    setHighlightedMsgId(msgId);
    document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightedMsgId(null), 2000);
  }

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Chatgrub</h2>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-zinc-800"
            title="New chatgrub"
          >
            <Plus size={14} />
          </button>
        </div>
        {(chatroomsError || agentsError) && (
          <div className="flex items-start gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-slate-300">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>
              {chatroomsError ? `Chatgrub: ${chatroomsError}` : ''}
              {chatroomsError && agentsError ? ' · ' : ''}
              {agentsError ? `Agents: ${agentsError}` : ''}
            </span>
          </div>
        )}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {chatroomsLoading && chatrooms.length === 0 ? (
            <div className="space-y-2 px-3 py-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 rounded bg-slate-100 dark:bg-slate-700/40 shimmer" />
              ))}
            </div>
          ) : chatrooms.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-500">
                <MessageSquare size={20} />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">No chatgrub yet</p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-1 text-xs font-medium text-slate-600 hover:underline dark:text-slate-400"
              >
                Create your first one →
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {chatrooms.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/chat/${c.id}`)}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40',
                      effectiveId === c.id && 'bg-slate-100 dark:bg-zinc-800',
                    )}
                  >
                    <MessageSquare
                      size={14}
                      className={cn(
                        'mt-1 flex-shrink-0',
                        effectiveId === c.id ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">{c.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {c.agentIds.length} agent(s) · {formatRelative(c.createdAt)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        {!activeChatroom ? (
          <EmptyChat onCreate={() => setCreateOpen(true)} />
        ) : (
          <>
            <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                  {activeChatroom.name}
                </h2>
                {activeChatroom.description && (
                  <p className="truncate text-xs text-slate-500">{activeChatroom.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchOpen((v) => !v)}
                  className={cn(
                    'rounded p-1.5 transition-colors',
                    searchOpen
                      ? 'bg-slate-100 text-slate-900 dark:bg-zinc-700 dark:text-slate-100'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-zinc-700 dark:hover:text-slate-100',
                  )}
                  title="Search messages"
                >
                  <Search size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  disabled={activeMessages.length === 0}
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-zinc-700 dark:hover:text-slate-100"
                  title="Export chat"
                >
                  <Download size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  title="Edit chatgrub"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setRightOpen((v) => !v)}
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  title="Toggle info panel"
                >
                  <ChevronRight
                    size={16}
                    className={cn('transition-transform', !rightOpen && 'rotate-180')}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(activeChatroom.id)}
                  className="rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                  title="Delete chatgrub"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 scrollbar-thin dark:bg-zinc-950">
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                {loadingMessages && activeMessages.length === 0 && (
                  <p className="text-center text-xs text-slate-500">Loading messages…</p>
                )}
                {loadMessagesError && activeMessages.length === 0 && !loadingMessages && (
                  <div className="flex items-center gap-2 self-center rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                    <AlertTriangle size={14} />
                    Failed to load messages: {loadMessagesError}
                  </div>
                )}
                {!loadingMessages && activeMessages.length === 0 && activeStreaming.length === 0 && (
                  <div className="my-16 flex flex-col items-center text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-500">
                      <Bot size={28} strokeWidth={1.8} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Start the conversation
                    </h3>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      Send a message below to begin. Use <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px] dark:border-zinc-800 dark:bg-zinc-900">@</kbd> to mention a specific agent.
                    </p>
                  </div>
                )}

                {activeMessages
                  .filter((m) => !m.parentId) // Only show top-level messages
                  .filter((m) => m.senderType === 'user' || !!(m.content?.trim()) || !!(m.toolCalls?.length))
                  .map((m) => {
                    const agent = agentsById.get(m.senderId);
                    const isExpanded = expandedThreads.has(m.id);
                    const replies = threadReplies[m.id] ?? [];
                    const replyCount = replyCounts[m.id] ?? 0;

                    return (
                      <div
                        key={m.id}
                        id={`msg-${m.id}`}
                        className={cn(
                          'rounded-xl transition-all duration-500',
                          highlightedMsgId === m.id && 'ring-2 ring-slate-400 ring-offset-2 ring-offset-slate-50 dark:ring-offset-zinc-900',
                        )}
                      >
                        <MessageBubble
                          message={m}
                          agentName={agent?.name}
                          agentColor={agent?.color}
                          agentAvatar={agent?.avatar}
                          replyCount={replyCount}
                          threadReplies={replies}
                          isThreadExpanded={isExpanded}
                          onReplyClick={() => handleReplyClick(m)}
                          onToggleThread={() => handleToggleThread(m.id)}
                          onRegenerate={() => effectiveId && removeMessage(effectiveId, m.id)}
                          onDelete={() => effectiveId && removeMessage(effectiveId, m.id)}
                        />

                        {/* Thread replies */}
                        {isExpanded && replies.length > 0 && (
                          <div className="mt-2 space-y-2 border-l-2 border-slate-200 pl-4 dark:border-zinc-700">
                            {replies.map((reply) => {
                              const replyAgent = agentsById.get(reply.senderId);
                              return (
                                <MessageBubble
                                  key={reply.id}
                                  message={reply}
                                  agentName={replyAgent?.name}
                                  agentColor={replyAgent?.color}
                                  agentAvatar={replyAgent?.avatar}
                                  isInThread
                                  onDelete={() => effectiveId && removeMessage(effectiveId, reply.id)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {activeStreaming.map((s) => {
                  const agent = agentsById.get(s.agentId);
                  return (
                    <MessageBubble
                      key={`stream-${s.messageId}`}
                      message={{
                        id: s.messageId,
                        chatRoomId: effectiveId ?? '',
                        senderType: 'agent',
                        senderId: s.agentId,
                        content: s.content,
                        role: 'assistant',
                        toolCalls: s.toolCalls,
                        createdAt: s.startedAt,
                      }}
                      agentName={agent?.name ?? 'Agent'}
                      agentColor={agent?.color}
                      agentAvatar={agent?.avatar}
                      isStreaming
                    />
                  );
                })}

                {sendError && (
                  <div className="flex items-center gap-2 self-center rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                    <AlertTriangle size={14} />
                    {sendError}
                  </div>
                )}
              </div>
            </div>

            <InputArea
              onSend={handleSend}
              onCancel={() => void cancelStream()}
              isStreaming={isStreaming}
              agents={agents}
              placeholder={replyingTo ? 'Write a reply…' : 'Send a message…'}
              replyingTo={replyingTo}
              replyingToAgentName={replyingTo ? agentsById.get(replyingTo.senderId)?.name : undefined}
              onCancelReply={handleCancelReply}
            />
          </>
        )}
      </main>

      {(rightOpen || searchOpen) && activeChatroom && (
        <aside className="hidden w-72 flex-shrink-0 flex-col border-l border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:flex">
          {searchOpen ? (
            <>
              <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-zinc-800">
                <Search size={14} className="flex-shrink-0 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages…"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder-slate-400 dark:text-slate-100"
                />
                {searchLoading && <Loader2 size={13} className="animate-spin text-slate-400" />}
                <button type="button" onClick={() => setSearchOpen(false)} className="rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {!searchQuery.trim() ? (
                  <p className="px-4 py-6 text-center text-xs text-slate-400">Type to search messages</p>
                ) : searchResults.length === 0 && !searchLoading ? (
                  <p className="px-4 py-6 text-center text-xs text-slate-400">No messages found</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {searchResults.map((msg) => {
                      const a = agentsById.get(msg.senderId);
                      return (
                        <li key={msg.id}>
                          <button
                            type="button"
                            onClick={() => scrollToMessage(msg.id)}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40"
                          >
                            <p className="mb-0.5 text-[11px] font-medium text-slate-500">
                              {msg.senderType === 'user' ? 'You' : (a?.name ?? 'Agent')} · {formatRelative(msg.createdAt)}
                            </p>
                            <p className="line-clamp-2 text-xs text-slate-700 dark:text-slate-200">
                              {msg.content || '(tool call)'}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Room info</h3>
                {activeChatroom.description && (
                  <p className="mt-1 text-xs text-slate-500">{activeChatroom.description}</p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Agents ({activeChatroom.agentIds.length})
                </h4>
                <ul className="space-y-2">
                  {activeChatroom.agentIds.map((id) => {
                    const a = agentsById.get(id);
                    if (!a) return null;
                    return (
                      <li
                        key={id}
                        className="flex items-center gap-2 rounded p-2 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-300">
                          {getInitial(a.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                            {a.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">{a.role}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="border-t border-slate-200 p-3 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => navigate(`/memories?agentId=${activeChatroom.agentIds[0] ?? ''}`)}
                  disabled={activeChatroom.agentIds.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-700"
                >
                  <Brain size={14} />
                  View memories
                </button>
              </div>
            </>
          )}
        </aside>
      )}

      <CreateChatRoomModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
      />

      {activeChatroom && (
        <EditChatRoomModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={handleEdit}
          chatroom={activeChatroom}
        />
      )}

      {activeChatroom && (
        <ExportChatModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          chatroomName={activeChatroom.name}
          messages={activeMessages}
          agentsById={agentsById}
        />
      )}
    </div>
  );
};

const EmptyChat: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 animate-float dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-500">
      <MessageSquare size={26} strokeWidth={1.8} />
    </div>
    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Select a chatgrub</h2>
    <p className="mt-2 max-w-sm text-sm text-slate-500">
      Pick a chatgrub from the left sidebar or create a new one to start chatting with your agents.
    </p>
    <div className="mt-5">
      <Button variant="primary" onClick={onCreate} leftIcon={<Plus size={14} />}>
        New chatgrub
      </Button>
    </div>
    <div className="mt-8 grid max-w-sm grid-cols-3 gap-2 text-center">
      {[
        { emoji: '💬', label: 'Multi-agent' },
        { emoji: '🧠', label: 'Long memory' },
        { emoji: '⚡', label: 'Custom LLM' },
      ].map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-xl">{item.emoji}</div>
          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">{item.label}</p>
        </div>
      ))}
    </div>
  </div>
);

interface CreateChatRoomModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ChatRoomFormData) => Promise<void>;
}

const CreateChatRoomModal: React.FC<CreateChatRoomModalProps> = ({ open, onClose, onSave }) => {
  const agents = useAgentsStore((s) => s.agents);
  const agentsLoading = useAgentsStore((s) => s.loadingAgents);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ChatRoomType>('team');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setType('team');
      setSelected([]);
      setError(null);
    }
  }, [open]);

  function handleTypeChange(value: string) {
    const nextType = value as ChatRoomType;
    setType(nextType);
    if (nextType === 'direct') {
      setSelected((s) => s.slice(0, 1));
    }
  }

  function toggle(id: string) {
    setSelected((s) => {
      if (type === 'direct') {
        return s.includes(id) ? [] : [id];
      }
      return s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (selected.length === 0 && type !== 'global') {
      setError('Please select at least one agent.');
      return;
    }
    if (type === 'direct' && selected.length !== 1) {
      setError('Direct chatgrub requires exactly one agent.');
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        agentIds: selected,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chatgrub');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Chatgrub"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="new-chatroom-form"
            loading={submitting}
            leftIcon={<Send size={14} />}
          >
            Create
          </Button>
        </>
      }
    >
      <form id="new-chatroom-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
        <Input
          label="Name *"
          value={name}
          onChange={setName}
          placeholder="Product brainstorm"
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="What is this chat about?"
          rows={2}
        />
        <Select
          label="Type"
          value={type}
          onChange={handleTypeChange}
          options={TYPE_OPTIONS}
        />
        {type !== 'global' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Agents ({selected.length})
            </label>
            {agentsLoading && agents.length === 0 ? (
              <p className="text-xs text-slate-500">Loading agents…</p>
            ) : agents.length === 0 ? (
              <p className="text-xs text-slate-500">No agents available. Create one first.</p>
            ) : (
              <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded border border-slate-200 p-2 dark:border-zinc-800 sm:grid-cols-2">
                {agents.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      onChange={() => toggle(a.id)}
                    />
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 dark:border-zinc-700 dark:bg-zinc-700 dark:text-slate-300"
                    >
                      {getInitial(a.name)}
                    </span>
                    <span className="truncate text-sm">{a.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};

interface EditChatRoomModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ChatRoomFormData) => Promise<void>;
  chatroom: import('../../shared/types').ChatRoom;
}

const EditChatRoomModal: React.FC<EditChatRoomModalProps> = ({ open, onClose, onSave, chatroom }) => {
  const agents = useAgentsStore((s) => s.agents);
  const agentsLoading = useAgentsStore((s) => s.loadingAgents);
  const [name, setName] = useState(chatroom.name);
  const [description, setDescription] = useState(chatroom.description ?? '');
  const [type, setType] = useState<ChatRoomType>(chatroom.type);
  const [selected, setSelected] = useState<string[]>(chatroom.agentIds);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(chatroom.name);
      setDescription(chatroom.description ?? '');
      setType(chatroom.type);
      setSelected(chatroom.agentIds);
      setError(null);
    }
  }, [open, chatroom]);

  function handleTypeChange(value: string) {
    const nextType = value as ChatRoomType;
    setType(nextType);
    if (nextType === 'direct') setSelected((s) => s.slice(0, 1));
  }

  function toggle(id: string) {
    setSelected((s) => {
      if (type === 'direct') return s.includes(id) ? [] : [id];
      return s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Name is required.'); return; }
    if (selected.length === 0 && type !== 'global') { setError('Please select at least one agent.'); return; }
    if (type === 'direct' && selected.length !== 1) { setError('Direct chatgrub requires exactly one agent.'); return; }
    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        agentIds: selected,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update chatgrub');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Chatgrub"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" form="edit-chatroom-form" loading={submitting} leftIcon={<Send size={14} />}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-chatroom-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
        <Input label="Name *" value={name} onChange={setName} placeholder="Product brainstorm" required />
        <Textarea label="Description" value={description} onChange={setDescription} placeholder="What is this chat about?" rows={2} />
        <Select label="Type" value={type} onChange={handleTypeChange} options={TYPE_OPTIONS} />
        {type !== 'global' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Agents ({selected.length})
            </label>
            {agentsLoading && agents.length === 0 ? (
              <p className="text-xs text-slate-500">Loading agents…</p>
            ) : agents.length === 0 ? (
              <p className="text-xs text-slate-500">No agents available.</p>
            ) : (
              <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded border border-slate-200 p-2 dark:border-zinc-800 sm:grid-cols-2">
                {agents.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 dark:border-zinc-700 dark:bg-zinc-700 dark:text-slate-300"
                    >
                      {getInitial(a.name)}
                    </span>
                    <span className="truncate text-sm">{a.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};

export default ChatRoomPage;

/* ====================================================================== */
/* Export Chat Modal                                                      */
/* ====================================================================== */

interface ExportChatModalProps {
  open: boolean;
  onClose: () => void;
  chatroomName: string;
  messages: Message[];
  agentsById: Map<string, Agent>;
}

const ExportChatModal: React.FC<ExportChatModalProps> = ({ open, onClose, chatroomName, messages, agentsById }) => {
  const [format, setFormat] = useState<'markdown' | 'text'>('markdown');
  const [exporting, setExporting] = useState(false);

  function generateMarkdown(): string {
    const now = new Date().toISOString();
    const lines: string[] = [
      '---',
      `chatroom: "${chatroomName}"`,
      `exported_at: "${now}"`,
      `message_count: ${messages.length}`,
      '---',
      '',
      `# Chat History: ${chatroomName}`,
      '',
      `Exported on ${formatDateTime(Date.now())}`,
      '',
      '---',
      '',
    ];

    for (const msg of messages) {
      const timestamp = formatDateTime(msg.createdAt);
      const senderName = msg.senderType === 'user' ? 'You' : agentsById.get(msg.senderId)?.name ?? 'Agent';
      const senderType = msg.senderType === 'user' ? 'User' : 'Agent';

      lines.push(`## ${timestamp} — ${senderName} (${senderType})`);
      lines.push('');

      if (msg.content) {
        lines.push(msg.content);
        lines.push('');
      }

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          lines.push(`**Tool Call:** \`${tc.function.name}\``);
          lines.push('```json');
          lines.push(tc.function.arguments);
          lines.push('```');
          lines.push('');
        }
      }

      if (msg.parentId) {
        lines.push(`_Reply to message ${msg.parentId}_`);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  function generateText(): string {
    const lines: string[] = [
      `Chat History: ${chatroomName}`,
      `Exported: ${formatDateTime(Date.now())}`,
      `Messages: ${messages.length}`,
      '',
      '========================================',
      '',
    ];

    for (const msg of messages) {
      const timestamp = formatDateTime(msg.createdAt);
      const senderName = msg.senderType === 'user' ? 'You' : agentsById.get(msg.senderId)?.name ?? 'Agent';

      lines.push(`[${timestamp}] ${senderName}:`);
      lines.push('');

      if (msg.content) {
        lines.push(msg.content);
        lines.push('');
      }

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          lines.push(`Tool: ${tc.function.name}`);
          lines.push(`Args: ${tc.function.arguments}`);
          lines.push('');
        }
      }

      lines.push('----------------------------------------');
      lines.push('');
    }

    return lines.join('\n');
  }

  function sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async function handleExport() {
    setExporting(true);
    try {
      const content = format === 'markdown' ? generateMarkdown() : generateText();
      const ext = format === 'markdown' ? 'md' : 'txt';
      const filename = `${sanitizeFilename(chatroomName)}_${new Date().toISOString().split('T')[0]}.${ext}`;
      const mimeType = format === 'markdown' ? 'text/markdown' : 'text/plain';

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export Chat History"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            loading={exporting}
            leftIcon={<Download size={14} />}
          >
            Export
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Export {messages.length} messages from "{chatroomName}"
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Format</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormat('markdown')}
              className={cn(
                'flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm',
                format === 'markdown'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-300',
              )}
            >
              <FileText size={16} />
              Markdown
            </button>
            <button
              type="button"
              onClick={() => setFormat('text')}
              className={cn(
                'flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm',
                format === 'text'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-300',
              )}
            >
              <FileText size={16} />
              Plain Text
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-500">
          {format === 'markdown' ? (
            <>
              <p>Markdown format includes:</p>
              <ul className="mt-1 list-inside list-disc">
                <li>Message timestamps and sender info</li>
                <li>Formatted content with markdown preserved</li>
                <li>Tool calls displayed as code blocks</li>
              </ul>
            </>
          ) : (
            <>
              <p>Plain text format includes:</p>
              <ul className="mt-1 list-inside list-disc">
                <li>Message timestamps and sender info</li>
                <li>Simple plain text content</li>
              </ul>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
