import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, MessageSquare, Search, Sparkles, Wand2, Users } from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import { useChatRoomsStore } from '../stores/chatrooms';
import { cn, getInitial } from '../lib/utils';

const AgentChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const agents = useAgentsStore((s) => s.agents);
  const teams = useAgentsStore((s) => s.teams);
  const loadingAgents = useAgentsStore((s) => s.loadingAgents);
  const chatrooms = useChatRoomsStore((s) => s.chatrooms);
  const getOrCreateDirect = useChatRoomsStore((s) => s.getOrCreateDirect);

  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function openDirectChat(agentId: string) {
    if (busyId) return;
    setBusyId(agentId);
    try {
      const chatroom = await getOrCreateDirect(agentId);
      navigate(`/chat/${chatroom.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to start chat.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 text-white shadow-sm">
                <MessageSquare size={18} strokeWidth={2} />
              </div>
              <h1 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
                Agent Chats
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Pick an agent to start a private 1:1 conversation. Memory and history are kept per agent.
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 scrollbar-thin dark:bg-slate-900">
          <div className="mx-auto max-w-5xl">
            {loadingAgents ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="card h-44 shimmer" />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div className="card relative overflow-hidden p-12 text-center">
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-primary-400/20 to-purple-400/20 blur-3xl" />
                <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-gradient-to-br from-pink-400/20 to-amber-400/20 blur-3xl" />
                <div className="relative">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-primary-500/30 animate-float">
                    <Bot size={36} strokeWidth={2} />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No agents yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                    Create an agent first, then come back here to start a 1:1 chat.
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/agents')}
                      className="btn-primary"
                    >
                      <Sparkles size={16} />
                      Create agent
                    </button>
                  </div>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="card p-10 text-center">
                <Search size={28} className="mx-auto mb-3 text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No agents match "{query}"</p>
                <p className="mt-1 text-xs text-slate-500">Try a different name or keyword.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((agent) => {
                  const existingChatId = directByAgent.get(agent.id);
                  const isBusy = busyId === agent.id;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => void openDirectChat(agent.id)}
                      disabled={!!busyId}
                      className={cn(
                        'card group relative flex flex-col gap-3 overflow-hidden p-4 text-left transition-all duration-200',
                        'hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                        busyId && !isBusy && 'opacity-60',
                      )}
                    >
                      <div
                        className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-25"
                        style={{ backgroundColor: agent.color ?? '#6366f1' }}
                      />
                      <div className="relative flex items-start gap-3">
                        <div
                          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-md ring-2 ring-white/20"
                          style={{ backgroundColor: agent.color ?? '#6366f1' }}
                        >
                          {agent.avatar ? (
                            <img src={agent.avatar} alt={agent.name} className="h-full w-full rounded-xl object-cover" />
                          ) : (
                            getInitial(agent.name)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">{agent.name}</h3>
                            {agent.isLead && (
                              <span className="badge-warning !text-[10px] !py-0">
                                <Wand2 size={9} /> Lead
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                            {agent.description || 'No description'}
                          </p>
                        </div>
                      </div>

                      <div className="relative flex flex-wrap gap-1.5">
                        {agent.role !== 'member' && (
                          <span
                            className={cn(
                              'badge',
                              agent.role === 'lead'
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                            )}
                          >
                            {agent.role}
                          </span>
                        )}
                        {agent.teamId && teamsById.get(agent.teamId) && (
                          <span className="badge-neutral">
                            <Users size={10} />
                            {teamsById.get(agent.teamId)?.name}
                          </span>
                        )}
                      </div>

                      <div className="relative mt-auto flex items-center justify-between pt-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 dark:text-primary-300">
                          {isBusy ? (
                            <>
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" />
                              Opening…
                            </>
                          ) : existingChatId ? (
                            <>
                              <MessageSquare size={12} />
                              Resume chat
                            </>
                          ) : (
                            <>
                              <MessageSquare size={12} />
                              Start chat
                            </>
                          )}
                        </span>
                        <span className="rounded-md bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors group-hover:bg-primary-700">
                          Open
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AgentChatsPage;
