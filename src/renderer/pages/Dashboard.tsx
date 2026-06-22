import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bot,
  Users,
  MessageSquare,
  Plus,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  KeyRound,
  Settings as SettingsIcon,
  Activity,
  Zap,
  Brain,
  ArrowUpRight,
  Clock,
  TrendingUp,
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
  const chatrooms = useChatRoomsStore((s) => s.chatrooms);
  const messagesByRoom = useChatRoomsStore((s) => s.messagesByRoom);
  const providers = useLLMStore((s) => s.providers);
  const defaultProvider = useLLMStore((s) => s.defaultProvider);
  const localhostUrl = useAppStore((s) => s.localhostUrl);
  const appSettings = useAppStore((s) => s.appSettings);

  const [totals, setTotals] = useState<{ messages: number; memories: number }>({ messages: 0, memories: 0 });

  useEffect(() => {
    let msgCount = 0;
    for (const list of Object.values(messagesByRoom)) msgCount += list.length;
    setTotals((t) => ({ ...t, messages: msgCount }));
  }, [messagesByRoom]);

  const recentChatrooms = useMemo(() => {
    return [...chatrooms].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  }, [chatrooms]);

  const needsSetup = providers.length === 0 || !defaultProvider;

  const stats = [
    {
      label: 'Agents',
      value: agents.length,
      icon: Bot,
      gradient: 'from-primary-500 to-violet-500',
      shadow: 'shadow-primary-500/25',
      link: '/agents',
    },
    {
      label: 'Teams',
      value: teams.length,
      icon: Users,
      gradient: 'from-emerald-500 to-teal-500',
      shadow: 'shadow-emerald-500/25',
      link: '/teams',
    },
    {
      label: 'Chatrooms',
      value: chatrooms.length,
      icon: MessageSquare,
      gradient: 'from-blue-500 to-cyan-500',
      shadow: 'shadow-blue-500/25',
      link: '/chat',
    },
    {
      label: 'Messages',
      value: totals.messages,
      icon: Activity,
      gradient: 'from-amber-500 to-orange-500',
      shadow: 'shadow-amber-500/25',
      link: '/chat',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero / Welcome */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-primary-50/40 to-purple-50/30 p-6 shadow-sm dark:border-slate-800/60 dark:from-slate-900 dark:via-primary-950/30 dark:to-purple-950/20">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-primary-400/20 to-purple-400/20 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-gradient-to-br from-pink-400/20 to-amber-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-primary-500/30">
              <Sparkles size={26} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Welcome to your AI office
                </h1>
                <span className="badge-primary !text-[10px]">v0.1.0</span>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Build a team of AI agents, give them skills, and let them work for you.
                Everything is local — your data never leaves your machine.
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={() => navigate('/chat')}
              className="btn-primary"
            >
              <MessageSquare size={16} />
              Open Chat
              <ArrowUpRight size={14} />
            </button>
            <button
              onClick={() => navigate('/agents')}
              className="btn-secondary"
            >
              <Plus size={16} />
              New Agent
            </button>
          </div>
        </div>
      </div>

      {/* Setup alert */}
      {needsSetup && (
        <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/50 p-4 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-amber-900/20">
          <div className="absolute -right-4 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-amber-400/10 blur-2xl" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Finish setup to start chatting
                </h3>
                <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
                  Add an LLM provider — works with OpenAI, Ollama, LM Studio, OpenRouter, or any OpenAI-compatible API.
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <button onClick={() => navigate('/settings')} className="btn-primary !bg-gradient-to-br !from-amber-500 !to-amber-600 !shadow-amber-500/25 hover:!from-amber-600 hover:!to-amber-700">
                <KeyRound size={14} />
                Add Provider
              </button>
              <button onClick={() => navigate('/settings')} className="btn-secondary">
                <SettingsIcon size={14} />
                Settings
              </button>
            </div>
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
              className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg dark:border-slate-800/60 dark:bg-slate-900 dark:hover:border-primary-700/50"
            >
              <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br ${stat.gradient} opacity-10 blur-xl transition-opacity group-hover:opacity-20`} />
              <div className="relative">
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient} text-white shadow-md ${stat.shadow}`}>
                  <Icon size={18} />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {stat.value}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick actions + status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Quick actions</h2>
              <p className="mt-0.5 text-xs text-slate-500">Get started in seconds</p>
            </div>
            <Zap size={16} className="text-amber-500" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Bot, title: 'Create Agent', desc: 'Define a new AI persona with skills.', to: '/agents', color: 'from-primary-500 to-violet-500' },
              { icon: KeyRound, title: 'Add LLM', desc: 'Configure OpenAI, Ollama, or any provider.', to: '/settings', color: 'from-emerald-500 to-teal-500' },
              { icon: MessageSquare, title: 'Open Chat', desc: 'Start a conversation with your agents.', to: '/chat', color: 'from-blue-500 to-cyan-500' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.title}
                  onClick={() => navigate(action.to)}
                  className="group relative flex flex-col items-start gap-2 overflow-hidden rounded-xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md dark:border-slate-800/60 dark:from-slate-900 dark:to-slate-900/50 dark:hover:border-primary-700/50"
                >
                  <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${action.color} opacity-10 blur-xl transition-opacity group-hover:opacity-20`} />
                  <div className={`relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${action.color} text-white shadow-md`}>
                    <Icon size={16} />
                  </div>
                  <span className="relative font-semibold text-slate-900 dark:text-slate-100">{action.title}</span>
                  <span className="relative text-xs text-slate-500 dark:text-slate-400">{action.desc}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t border-slate-200/60 pt-4 dark:border-slate-800/60">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Brain size={14} className="text-primary-500" />
              Why teams use Office AI Agent
            </h3>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                <p className="font-medium text-slate-700 dark:text-slate-200">Custom LLM</p>
                <p className="mt-0.5 text-slate-500">Use any OpenAI-compatible endpoint.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                <p className="font-medium text-slate-700 dark:text-slate-200">Persistent memory</p>
                <p className="mt-0.5 text-slate-500">Agents remember across sessions.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                <p className="font-medium text-slate-700 dark:text-slate-200">100% local</p>
                <p className="mt-0.5 text-slate-500">Your data never leaves your machine.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">System status</h2>
              <p className="mt-0.5 text-xs text-slate-500">Live health checks</p>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
              <Activity size={14} />
            </div>
          </div>
          <dl className="space-y-2.5 text-sm">
            <StatusRow label="Default provider" value={defaultProvider?.name} ok={!!defaultProvider} />
            <StatusRow label="Local server" value={localhostUrl?.replace(/^https?:\/\//, '')} ok={!!localhostUrl} mono />
            <StatusRow label="Working dir" value={appSettings?.workingDirectory} ok={!!appSettings?.workingDirectory} mono truncate />
            <StatusRow label="Memory limit" value={String(appSettings?.maxMemoryItems ?? '—')} ok />
            <StatusRow label="Streaming" value={appSettings?.streamResponses ? 'enabled' : 'disabled'} ok />
          </dl>
        </div>
      </div>

      {/* Recent chatrooms */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-4 dark:border-slate-800/60">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recent chatrooms</h2>
          </div>
          <Link
            to="/chat"
            className="group flex items-center gap-1 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400"
          >
            View all
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        {recentChatrooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-900/30 dark:to-purple-900/30">
              <MessageSquare className="text-primary-500" size={28} />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No chatrooms yet</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Create your first chatroom and start talking to your agents.
            </p>
            <button onClick={() => navigate('/chat')} className="btn-primary mt-4">
              <Plus size={14} />
              Start your first chat
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {recentChatrooms.map((room) => (
              <li key={room.id}>
                <Link
                  to={`/chat/${room.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400">
                      <MessageSquare size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {room.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {room.description ?? `${room.agentIds.length} agent${room.agentIds.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="text-xs text-slate-500">{formatRelative(room.createdAt)}</span>
                    <ArrowUpRight size={14} className="text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary-500" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <TrendingUp size={12} />
        <span>Memory system tracks {totals.messages} messages across {chatrooms.length} chatrooms</span>
      </div>
    </div>
  );
};

const StatusRow: React.FC<{ label: string; value?: string; ok: boolean; mono?: boolean; truncate?: boolean }> = ({ label, value, ok, mono, truncate }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
    <dd
      className={`flex items-center gap-1.5 ${truncate ? 'max-w-[160px] truncate' : ''} ${mono ? 'font-mono text-xs' : ''} font-medium ${
        ok ? 'text-slate-900 dark:text-slate-100' : 'text-amber-600 dark:text-amber-400'
      }`}
      title={value}
    >
      {!ok && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
      {value ?? <span className="italic text-slate-400">not set</span>}
    </dd>
  </div>
);

export default Dashboard;
