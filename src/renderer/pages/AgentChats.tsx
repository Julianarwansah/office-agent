import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  Brain,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import { useChatRoomsStore } from '../stores/chatrooms';
import MessageBubble from '../components/MessageBubble';
import InputArea, { type InputAreaHandle } from '../components/InputArea';
import { cn, getInitial } from '../lib/utils';

const AgentChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId?: string }>();

  const agents = useAgentsStore((s) => s.agents);
  const teams = useAgentsStore((s) => s.teams);
  const loadingAgents = useAgentsStore((s) => s.loadingAgents);
  const loadAgents = useAgentsStore((s) => s.loadAgents);
  const loadTeams = useAgentsStore((s) => s.loadTeams);
  const agentsError = useAgentsStore((s) => s.error);

  const chatrooms = useChatRoomsStore((s) => s.chatrooms);
  const loadChatrooms = useChatRoomsStore((s) => s.loadChatrooms);
  const chatroomsError = useChatRoomsStore((s) => s.error);
  const getOrCreateDirect = useChatRoomsStore((s) => s.getOrCreateDirect);
  const messagesByRoom = useChatRoomsStore((s) => s.messagesByRoom);
  const streamingMessages = useChatRoomsStore((s) => s.streamingMessages);
  const loadingMessages = useChatRoomsStore((s) => s.loadingMessages);
  const loadMessagesError = useChatRoomsStore((s) => s.loadMessagesError);
  const loadMessages = useChatRoomsStore((s) => s.loadMessages);
  const sendError = useChatRoomsStore((s) => s.sendError);
  const sendMessage = useChatRoomsStore((s) => s.sendMessage);
  const clearMessages = useChatRoomsStore((s) => s.clearMessages);
  const cancelStream = useChatRoomsStore((s) => s.cancelStream);

  const inputAreaRef = useRef<InputAreaHandle>(null);

  const [query, setQuery] = useState('');
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    void loadAgents();
    void loadTeams();
    void loadChatrooms();
  }, [loadAgents, loadTeams, loadChatrooms]);

  useEffect(() => {
    if (!agentId) {
      setChatRoomId(null);
      setResolving(false);
      setResolveError(null);
      return;
    }
    let cancelled = false;
    setResolving(true);
    setResolveError(null);
    setChatRoomId(null);
    void (async () => {
      try {
        const room = await getOrCreateDirect(agentId);
        if (cancelled) return;
        setChatRoomId(room.id);
        setResolving(false);
      } catch (err) {
        if (cancelled) return;
        setResolveError(err instanceof Error ? err.message : 'Failed to open chat');
        setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, getOrCreateDirect]);

  const loadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!chatRoomId) return;
    if (loadedRef.current.has(chatRoomId)) return;
    loadedRef.current.add(chatRoomId);
    void loadMessages(chatRoomId);
  }, [chatRoomId, loadMessages]);

  useEffect(() => {
    if (agentId) {
      useChatRoomsStore.setState({ sendError: null, loadMessagesError: null });
    }
  }, [agentId]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [agentId]);

  const teamsById = useMemo(() => {
    const m = new Map<string, (typeof teams)[number]>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const directByAgent = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of chatrooms) {
      if (c.type === 'direct' && c.agentIds.length === 1) {
        m.set(c.agentIds[0], c.id);
      }
    }
    return m;
  }, [chatrooms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => {
      if (a.name.toLowerCase().includes(q)) return true;
      if (a.description && a.description.toLowerCase().includes(q)) return true;
      const teamName = a.teamId ? teamsById.get(a.teamId)?.name : undefined;
      if (teamName && teamName.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [agents, query, teamsById]);

  const activeAgent = useMemo(
    () => (agentId ? agents.find((a) => a.id === agentId) ?? null : null),
    [agents, agentId],
  );

  const activeMessages = chatRoomId ? messagesByRoom[chatRoomId] ?? [] : [];
  const activeStreaming = chatRoomId ? streamingMessages[chatRoomId] ?? [] : [];
  const isStreaming = activeStreaming.length > 0;
  const showAvatar = !!activeAgent?.avatar && !avatarBroken;

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

  async function handleSend(text: string, _mentionedAgentIds: string[]) {
    if (!chatRoomId || !agentId) return;
    try {
      await sendMessage({ chatRoomId, userMessage: text, agentId });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to send');
    }
  }

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      {/* Left: Agent List */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-shrink-0 items-center border-b border-slate-200 px-3 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Chat Agent</h2>
        </div>

        <div className="flex-shrink-0 border-b border-slate-100 px-3 py-2 dark:border-slate-700/50">
          <div className="relative">
            <Search
              size={12}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents…"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-xs text-slate-900 outline-none focus:border-primary-400 focus:ring-0 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100"
            />
          </div>
        </div>

        {(agentsError || chatroomsError) && (
          <div className="flex items-start gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
            <span>{agentsError ?? chatroomsError}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loadingAgents && agents.length === 0 ? (
            <div className="space-y-2 px-3 py-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded bg-slate-100 dark:bg-slate-700/40 shimmer" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <Bot size={24} className="mb-2 text-slate-400" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">No agents yet</p>
              <button
                type="button"
                onClick={() => navigate('/agents')}
                className="mt-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Create one →
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              No agents match &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map((agent) => {
                const hasChat = directByAgent.has(agent.id);
                const isActive = agent.id === agentId;
                return (
                  <li key={agent.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/agent-chat/${agent.id}`)}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40',
                        isActive && 'bg-primary-50 dark:bg-primary-900/30',
                      )}
                    >
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                        style={{ backgroundColor: agent.color ?? '#6366f1' }}
                      >
                        {getInitial(agent.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm font-medium',
                            isActive
                              ? 'text-primary-700 dark:text-primary-300'
                              : 'text-slate-800 dark:text-slate-100',
                          )}
                        >
                          {agent.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {agent.description || agent.role}
                        </p>
                      </div>
                      {hasChat && (
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Right: Chat Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {!agentId ? (
          <EmptyAgentChat onCreate={() => navigate('/agents')} />
        ) : resolving ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
              <p className="text-sm">Opening chat…</p>
            </div>
          </div>
        ) : resolveError || !chatRoomId || !activeAgent ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="card max-w-md p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle size={26} />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {resolveError ? 'Could not open chat' : 'Agent not found'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {resolveError ?? 'This agent may have been deleted.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white shadow-sm ring-2 ring-white/20"
                style={{ backgroundColor: activeAgent.color ?? '#6366f1' }}
              >
                {showAvatar ? (
                  <img
                    src={activeAgent.avatar}
                    alt={activeAgent.name}
                    className="h-full w-full object-cover"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  getInitial(activeAgent.name)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                    {activeAgent.name}
                  </h2>
                  {activeAgent.isLead && (
                    <span className="badge-warning !py-0 !text-[10px]">
                      <Wand2 size={9} /> Lead
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-500">
                  {activeAgent.role !== 'member' ? `${activeAgent.role} · ` : ''}
                  Private 1:1 chat
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/memories?agentId=${activeAgent.id}`)}
                className="hidden items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 sm:inline-flex dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                <Brain size={13} />
                Memories
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!chatRoomId) return;
                  if (!window.confirm(`Hapus semua history chat dengan ${activeAgent.name}?`)) return;
                  await cancelStream(chatRoomId);
                  await clearMessages(chatRoomId);
                  loadedRef.current.delete(chatRoomId);
                  inputAreaRef.current?.focus();
                }}
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                title="Hapus history chat"
              >
                <Trash2 size={15} />
              </button>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 scrollbar-thin dark:bg-slate-900"
            >
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
                {!loadingMessages &&
                  activeMessages.length === 0 &&
                  activeStreaming.length === 0 &&
                  !loadMessagesError && (
                    <div className="my-16 flex flex-col items-center text-center">
                      <div
                        className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-lg"
                        style={{ backgroundColor: activeAgent.color ?? '#6366f1' }}
                      >
                        <Bot className="text-white" size={36} />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        Start a conversation with {activeAgent.name}
                      </h3>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Send a message below. Memory and history are kept per agent.
                      </p>
                    </div>
                  )}

                {activeMessages
                  .filter((m) => m.senderType === 'user' || !!(m.content?.trim()) || !!(m.toolCalls?.length))
                  .map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      agentName={activeAgent.name}
                      agentColor={activeAgent.color}
                      agentAvatar={activeAgent.avatar}
                    />
                  ))}

                {activeStreaming.map((s) => (
                  <MessageBubble
                    key={`stream-${s.messageId}`}
                    message={{
                      id: s.messageId,
                      chatRoomId: chatRoomId ?? '',
                      senderType: 'agent',
                      senderId: s.agentId,
                      content: s.content,
                      role: 'assistant',
                      toolCalls: s.toolCalls,
                      createdAt: s.startedAt,
                    }}
                    agentName={activeAgent.name}
                    agentColor={activeAgent.color}
                    agentAvatar={activeAgent.avatar}
                    isStreaming
                  />
                ))}

                {sendError && (
                  <div className="flex items-center gap-2 self-center rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                    <AlertTriangle size={14} />
                    {sendError}
                  </div>
                )}
              </div>
            </div>

            <InputArea
              ref={inputAreaRef}
              onSend={handleSend}
              onCancel={() => void cancelStream(chatRoomId ?? undefined)}
              isStreaming={isStreaming}
              agents={[activeAgent]}
              placeholder={`Message ${activeAgent.name}…`}
            />
          </>
        )}
      </main>
    </div>
  );
};

const EmptyAgentChat: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
    <div className="relative mb-6">
      <div className="absolute inset-0 -m-4 rounded-full bg-gradient-to-br from-primary-400/20 to-purple-400/20 blur-2xl" />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 text-white shadow-xl shadow-primary-500/30 animate-float">
        <Bot size={40} strokeWidth={1.8} />
      </div>
    </div>
    <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
      Select an agent
    </h2>
    <p className="mt-2 max-w-sm text-sm text-slate-500">
      Pick an agent from the left to start a private 1:1 conversation. Memory and history are kept
      per agent.
    </p>
    <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-center">
      {[
        { icon: <Bot size={20} />, label: 'Private 1:1' },
        { icon: <Brain size={20} />, label: 'Long memory' },
        { icon: <Sparkles size={20} />, label: 'Custom LLM' },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-200/60 bg-white/50 p-3 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/50"
        >
          <div className="flex justify-center text-primary-500">{item.icon}</div>
          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
        </div>
      ))}
    </div>
    <button type="button" onClick={onCreate} className="btn-primary mt-6">
      <Sparkles size={16} />
      Manage agents
    </button>
  </div>
);

export default AgentChatsPage;
