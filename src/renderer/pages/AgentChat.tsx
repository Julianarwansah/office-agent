import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Bot,
  Wand2,
  Brain,
} from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import { useChatRoomsStore } from '../stores/chatrooms';
import MessageBubble from '../components/MessageBubble';
import InputArea from '../components/InputArea';
import { getInitial } from '../lib/utils';

const AgentChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId?: string }>();

  const agents = useAgentsStore((s) => s.agents);
  const loadAgents = useAgentsStore((s) => s.loadAgents);
  const loadTeams = useAgentsStore((s) => s.loadTeams);
  const teams = useAgentsStore((s) => s.teams);
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
  const cancelStream = useChatRoomsStore((s) => s.cancelStream);

  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    void loadAgents();
    void loadTeams();
    void loadChatrooms();
  }, [loadAgents, loadTeams, loadChatrooms]);

  useEffect(() => {
    if (!agentId) return;
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

  const agent = useMemo(
    () => (agentId ? agents.find((a) => a.id === agentId) ?? null : null),
    [agents, agentId],
  );

  const activeMessages = chatRoomId ? messagesByRoom[chatRoomId] ?? [] : [];
  const activeStreaming = chatRoomId ? streamingMessages[chatRoomId] ?? [] : [];
  const isStreaming = activeStreaming.length > 0;

  const teamName = useMemo(() => {
    if (!agent?.teamId) return null;
    return teams.find((t) => t.id === agent.teamId)?.name ?? null;
  }, [agent, teams]);

  const showAvatar = !!agent?.avatar && !avatarBroken;

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
      await sendMessage({
        chatRoomId,
        userMessage: text,
        agentId,
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to send');
    }
  }

  if (resolving) {
    return (
      <div className="flex h-full -m-6 items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          <p className="text-sm">Opening chat…</p>
        </div>
      </div>
    );
  }

  if (resolveError || !chatRoomId || !agent) {
    return (
      <div className="flex h-full -m-6 items-center justify-center overflow-hidden p-8">
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
          <button
            type="button"
            onClick={() => navigate('/agent-chat')}
            className="btn-primary mt-5"
          >
            <ArrowLeft size={14} />
            Back to agents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full -m-6 flex-col overflow-hidden bg-white dark:bg-slate-900">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 sm:px-6">
        <button
          type="button"
          onClick={() => navigate('/agent-chat')}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title="Back to agents"
          aria-label="Back to agents"
        >
          <ArrowLeft size={18} />
        </button>

        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white shadow-md ring-2 ring-white/20"
          style={{ backgroundColor: agent.color ?? '#6366f1' }}
        >
          {showAvatar ? (
            <img
              src={agent.avatar}
              alt={agent.name}
              className="h-full w-full object-cover"
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            getInitial(agent.name)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
              {agent.name}
            </h1>
            {agent.isLead && (
              <span className="badge-warning !text-[10px] !py-0">
                <Wand2 size={9} /> Lead
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {teamName ? `${teamName} · ` : ''}
            {agent.role !== 'member' ? `${agent.role} · ` : ''}
            Private 1:1 chat
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/memories?agentId=${agent.id}`)}
          className="hidden items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 sm:inline-flex dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          title="View memories"
        >
          <Brain size={13} />
          Memories
        </button>
      </header>

      {(agentsError || chatroomsError) && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>
            {chatroomsError ? `Chatrooms: ${chatroomsError}` : ''}
            {chatroomsError && agentsError ? ' · ' : ''}
            {agentsError ? `Agents: ${agentsError}` : ''}
          </span>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 scrollbar-thin dark:bg-slate-900">
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
          {!loadingMessages && activeMessages.length === 0 && activeStreaming.length === 0 && !loadMessagesError && (
            <div className="my-16 flex flex-col items-center text-center">
              <div
                className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-lg"
                style={{ backgroundColor: agent.color ?? '#6366f1' }}
              >
                <Bot className="text-white" size={36} />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Start a conversation with {agent.name}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Send a message below. Memory and history are kept per agent.
              </p>
            </div>
          )}

          {activeMessages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              agentName={agent.name}
              agentColor={agent.color}
              agentAvatar={agent.avatar}
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
              agentName={agent.name}
              agentColor={agent.color}
              agentAvatar={agent.avatar}
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
        onSend={handleSend}
        onCancel={() => void cancelStream()}
        isStreaming={isStreaming}
        agents={[agent]}
        placeholder={`Message ${agent.name}…`}
      />
    </div>
  );
};

export default AgentChatPage;
