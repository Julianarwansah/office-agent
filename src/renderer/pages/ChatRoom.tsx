import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { useChatRoomsStore } from '../stores/chatrooms';
import { useAgentsStore } from '../stores/agents';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input, { Textarea, Select } from '../components/ui/Input';
import MessageBubble from '../components/MessageBubble';
import InputArea from '../components/InputArea';
import type { ChatRoomType } from '../../shared/types';
import type { ChatRoomFormData } from '../lib/types';
import { cn, formatRelative, getInitial } from '../lib/utils';

const TYPE_OPTIONS: Array<{ value: ChatRoomType; label: string }> = [
  { value: 'direct', label: 'Direct — 1:1 with an agent' },
  { value: 'team', label: 'Team — multiple agents collaborating' },
  { value: 'global', label: 'Global — all available agents' },
];

const ChatRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const { chatRoomId } = useParams<{ chatRoomId?: string }>();

  const chatrooms = useChatRoomsStore((s) => s.chatrooms);
  const currentChatRoomId = useChatRoomsStore((s) => s.currentChatRoomId);
  const setCurrentChatRoom = useChatRoomsStore((s) => s.setCurrentChatRoom);
  const messagesByRoom = useChatRoomsStore((s) => s.messagesByRoom);
  const streamingMessages = useChatRoomsStore((s) => s.streamingMessages);
  const loadingMessages = useChatRoomsStore((s) => s.loadingMessages);
  const sendError = useChatRoomsStore((s) => s.sendError);
  const sendMessage = useChatRoomsStore((s) => s.sendMessage);
  const cancelStream = useChatRoomsStore((s) => s.cancelStream);
  const createChatRoom = useChatRoomsStore((s) => s.createChatRoom);
  const deleteChatRoom = useChatRoomsStore((s) => s.deleteChatRoom);

  const agents = useAgentsStore((s) => s.agents);

  const [createOpen, setCreateOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);

  const effectiveId = chatRoomId ?? currentChatRoomId ?? null;

  useEffect(() => {
    if (chatRoomId) setCurrentChatRoom(chatRoomId);
  }, [chatRoomId, setCurrentChatRoom]);

  useEffect(() => {
    if (effectiveId && !messagesByRoom[effectiveId]) {
      void useChatRoomsStore.getState().loadMessages(effectiveId);
    }
  }, [effectiveId, messagesByRoom]);

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
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeMessages.length, activeStreaming.length, activeStreaming.map((s) => s.content).join('|')]);

  async function handleSend(text: string, mentionedAgentIds: string[]) {
    if (!effectiveId) return;
    try {
      await sendMessage({
        chatRoomId: effectiveId,
        userMessage: text,
        mentionedAgentIds,
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to send');
    }
  }

  async function handleCreate(data: ChatRoomFormData) {
    const created = await createChatRoom(data);
    setCreateOpen(false);
    navigate(`/chat/${created.id}`);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this chatroom? This will remove all messages.')) return;
    await deleteChatRoom(id);
    navigate('/chat');
  }

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Chatrooms</h2>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-primary-50 p-1.5 text-primary-600 transition-colors hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400 dark:hover:bg-primary-900/50"
            title="New chatroom"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {chatrooms.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-900/30 dark:to-purple-900/30">
                <MessageSquare className="text-primary-500" size={20} />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">No chatrooms yet</p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
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
                      effectiveId === c.id && 'bg-primary-50 dark:bg-primary-900/30',
                    )}
                  >
                    <MessageSquare
                      size={14}
                      className={cn(
                        'mt-1 flex-shrink-0',
                        effectiveId === c.id
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-slate-400',
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
            <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
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
                  onClick={() => handleDelete(activeChatroom.id)}
                  className="rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                  title="Delete chatroom"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 scrollbar-thin dark:bg-slate-900">
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                {loadingMessages && activeMessages.length === 0 && (
                  <p className="text-center text-xs text-slate-500">Loading messages…</p>
                )}
                {!loadingMessages && activeMessages.length === 0 && activeStreaming.length === 0 && (
                  <div className="my-16 flex flex-col items-center text-center">
                    <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-100 via-purple-100 to-pink-100 shadow-lg dark:from-primary-900/30 dark:via-purple-900/30 dark:to-pink-900/30">
                      <Bot className="text-primary-500" size={36} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Start the conversation
                    </h3>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      Send a message below to begin. Use <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px] dark:border-slate-700 dark:bg-slate-800">@</kbd> to mention a specific agent.
                    </p>
                  </div>
                )}

                {activeMessages.map((m) => {
                  const agent = agentsById.get(m.senderId);
                  return (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      agentName={agent?.name}
                      agentColor={agent?.color}
                      agentAvatar={agent?.avatar}
                    />
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
              placeholder="Send a message…"
            />
          </>
        )}
      </main>

      {rightOpen && activeChatroom && (
        <aside className="hidden w-72 flex-shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 lg:flex">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
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
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: a.color ?? '#6366f1' }}
                    >
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
          <div className="border-t border-slate-200 p-3 dark:border-slate-700">
            <button
              type="button"
              onClick={() => navigate(`/memories?agentId=${activeChatroom.agentIds[0] ?? ''}`)}
              disabled={activeChatroom.agentIds.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              <Brain size={14} />
              View memories
            </button>
          </div>
        </aside>
      )}

      <CreateChatRoomModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
      />
    </div>
  );
};

const EmptyChat: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
    <div className="relative mb-6">
      <div className="absolute inset-0 -m-4 rounded-full bg-gradient-to-br from-primary-400/20 to-purple-400/20 blur-2xl" />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 text-white shadow-xl shadow-primary-500/30 animate-float">
        <MessageSquare size={40} strokeWidth={1.8} />
      </div>
    </div>
    <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
      Select a chatroom
    </h2>
    <p className="mt-2 max-w-sm text-sm text-slate-500">
      Pick a chatroom from the left sidebar or create a new one to start chatting with your agents.
    </p>
    <div className="mt-6 flex gap-2">
      <Button variant="primary" onClick={onCreate} leftIcon={<Plus size={16} />}>
        New chatroom
      </Button>
    </div>
    <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-center">
      {[
        { emoji: '💬', label: 'Multi-agent chat' },
        { emoji: '🧠', label: 'Long memory' },
        { emoji: '⚡', label: 'Custom LLM' },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200/60 bg-white/50 p-3 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/50">
          <div className="text-2xl">{item.emoji}</div>
          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
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

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
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
    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        agentIds: selected,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chatroom');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Chatroom"
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
          onChange={(v) => setType(v as ChatRoomType)}
          options={TYPE_OPTIONS}
        />
        {type !== 'global' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Agents ({selected.length})
            </label>
            {agents.length === 0 ? (
              <p className="text-xs text-slate-500">No agents available. Create one first.</p>
            ) : (
              <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded border border-slate-200 p-2 dark:border-slate-700 sm:grid-cols-2">
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
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: a.color ?? '#6366f1' }}
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