import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bot, Users, MessageSquare, Plus, ArrowRight,
  AlertTriangle, Sparkles, KeyRound, Settings as SettingsIcon,
  Activity, Zap, Brain, ArrowUpRight, Clock, TrendingUp,
} from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import { useChatRoomsStore } from '../stores/chatrooms';
import { useLLMStore } from '../stores/llm';
import { useAppStore } from '../stores/app';
import { formatRelative } from '../lib/utils';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const agents = useAgentsStore((s) => s.agents);
  const teams = useAgentsStore((s) => s.teams);
  const allChatrooms = useChatRoomsStore((s) => s.chatrooms);
  const chatrooms = allChatrooms.filter((c) => c.type !== 'direct');
  const messagesByRoom = useChatRoomsStore((s) => s.messagesByRoom);
  const providers = useLLMStore((s) => s.providers);
  const defaultProvider = useLLMStore((s) => s.defaultProvider);
  const localhostUrl = useAppStore((s) => s.localhostUrl);
  const appSettings = useAppStore((s) => s.appSettings);

  const [totals, setTotals] = useState({ messages: 0 });

  useEffect(() => {
    let msgCount = 0;
    for (const list of Object.values(messagesByRoom)) msgCount += list.length;
    setTotals({ messages: msgCount });
  }, [messagesByRoom]);

  const recentChatrooms = useMemo(
    () => [...chatrooms].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [chatrooms],
  );

  const needsSetup = providers.length === 0 || !defaultProvider;

  const stats = [
    { label: 'Agents', value: agents.length, icon: Bot, link: '/agents' },
    { label: 'Teams', value: teams.length, icon: Users, link: '/teams' },
    { label: 'Chatgrub', value: chatrooms.length, icon: MessageSquare, link: '/chat' },
    { label: 'Messages', value: totals.messages, icon: Activity, link: '/chat' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <Sparkles size={22} strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Welcome to Office AI Agent
                </h1>
                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-400">
                  v0.1.0
                </span>
              </div>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Build a team of AI agents, give them skills, and let them work for you.
                Everything is local — your data never leaves your machine.
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <button onClick={() => navigate('/chat')} className="btn-primary">
              <MessageSquare size={15} />
              Open Chat
            </button>
            <button onClick={() => navigate('/agents')} className="btn-secondary">
              <Plus size={15} />
              New Agent
            </button>
          </div>
        </div>
      </div>

      {/* Setup alert */}
      {needsSetup && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-400">
            <AlertTriangle size={16} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Setup required — add an LLM provider
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Works with OpenAI, Ollama, LM Studio, OpenRouter, or any OpenAI-compatible API.
            </p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <button onClick={() => navigate('/settings')} className="btn-primary !px-3 !py-1.5 !text-xs">
              <KeyRound size={13} />
              Add Provider
            </button>
            <button onClick={() => navigate('/settings')} className="btn-secondary !px-3 !py-1.5 !text-xs">
              <SettingsIcon size={13} />
              Settings
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              to={stat.link}
              className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-300">
                <Icon size={17} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{stat.label}</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-50">{stat.value}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick actions + status */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick actions</h2>
            <Zap size={14} className="text-slate-400" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { icon: Bot, title: 'Create Agent', desc: 'Define a new AI persona with skills.', to: '/agents' },
              { icon: KeyRound, title: 'Add LLM', desc: 'Configure OpenAI, Ollama, or any provider.', to: '/settings' },
              { icon: MessageSquare, title: 'Open Chat', desc: 'Start a conversation with your agents.', to: '/chat' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.title}
                  onClick={() => navigate(action.to)}
                  className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-zinc-700 dark:bg-zinc-700 dark:text-slate-300">
                    <Icon size={15} />
                  </div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{action.title}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{action.desc}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-zinc-800">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Brain size={12} />
              Why local AI
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Custom LLM', desc: 'Any OpenAI-compatible endpoint.' },
                { label: 'Persistent memory', desc: 'Agents remember across sessions.' },
                { label: '100% local', desc: 'Data never leaves your machine.' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">System status</h2>
            <Activity size={14} className="text-slate-400" />
          </div>
          <dl className="space-y-3 text-xs">
            <StatusRow label="Default provider" value={defaultProvider?.name} ok={!!defaultProvider} />
            <StatusRow label="Local server" value={localhostUrl?.replace(/^https?:\/\//, '')} ok={!!localhostUrl} mono />
            <StatusRow label="Working dir" value={appSettings?.workingDirectory} ok={!!appSettings?.workingDirectory} mono truncate />
            <StatusRow label="Memory limit" value={String(appSettings?.maxMemoryItems ?? '—')} ok />
            <StatusRow label="Streaming" value={appSettings?.streamResponses ? 'enabled' : 'disabled'} ok />
          </dl>
        </div>
      </div>

      {/* Recent chatgrub */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Clock size={14} className="text-slate-400" />
            Recent chatgrub
          </div>
          <Link to="/chat" className="group flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            View all
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        {recentChatrooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-8 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-500">
              <MessageSquare size={22} />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No chatgrub yet</p>
            <p className="mt-1 text-xs text-slate-500">Create your first chatgrub and start talking to your agents.</p>
            <button onClick={() => navigate('/chat')} className="btn-primary mt-4">
              <Plus size={13} />
              Start your first chat
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
            {recentChatrooms.map((room) => (
              <li key={room.id}>
                <Link
                  to={`/chat/${room.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-400">
                      <MessageSquare size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{room.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {room.description ?? `${room.agentIds.length} agent${room.agentIds.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="text-xs text-slate-400">{formatRelative(room.createdAt)}</span>
                    <ArrowUpRight size={13} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-zinc-600" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <TrendingUp size={11} />
        <span>{totals.messages} messages across {chatrooms.length} chatgrub</span>
      </div>
    </div>
  );
};

const StatusRow: React.FC<{ label: string; value?: string; ok: boolean; mono?: boolean; truncate?: boolean }> = ({
  label, value, ok, mono, truncate,
}) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
    <dd
      className={`flex items-center gap-1.5 ${truncate ? 'max-w-[140px] truncate' : ''} ${mono ? 'font-mono text-[11px]' : ''} font-medium ${
        ok ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
      }`}
      title={value}
    >
      {!ok && <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
      {value ?? <span className="italic text-slate-400">not set</span>}
    </dd>
  </div>
);

export default Dashboard;
