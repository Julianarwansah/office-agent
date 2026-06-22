import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bot,
  Users,
  MessageSquare,
  Brain,
  Plus,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  KeyRound,
  Settings as SettingsIcon,
  Activity,
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
    let memCount = 0;
    for (const list of Object.values(messagesByRoom)) msgCount += list.length;
    setTotals({ messages: msgCount, memories: memCount });
  }, [messagesByRoom]);

  const recentChatrooms = useMemo(() => {
    return [...chatrooms].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  }, [chatrooms]);

  const needsSetup = providers.length === 0 || !defaultProvider;

  const stats = [
    { label: 'Agents', value: agents.length, icon: Bot, color: 'text-primary-600', link: '/agents' },
    { label: 'Teams', value: teams.length, icon: Users, color: 'text-emerald-600', link: '/teams' },
    { label: 'Chatrooms', value: chatrooms.length, icon: MessageSquare, color: 'text-blue-600', link: '/chat' },
    { label: 'Messages', value: totals.messages, icon: Activity, color: 'text-amber-600', link: '/chat' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome back</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Here's a quick overview of your Office AI Agent workspace.
        </p>
      </div>

      {needsSetup && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" size={20} />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Finish setup to start chatting
              </h3>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                You haven't configured an LLM provider yet. Add one to enable your agents to respond.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => navigate('/settings')}
                  className="btn-primary"
                >
                  <KeyRound size={16} />
                  Add LLM Provider
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="btn-secondary"
                >
                  <SettingsIcon size={16} />
                  Open Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              to={stat.link}
              className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-md"
            >
              <div className={`rounded-lg bg-slate-100 p-3 dark:bg-slate-700 ${stat.color}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Quick actions</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={() => navigate('/agents')}
              className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/40 dark:border-slate-700 dark:hover:border-primary-500 dark:hover:bg-primary-900/20"
            >
              <Bot className="text-primary-600" size={20} />
              <span className="font-medium text-slate-900 dark:text-slate-100">Create Agent</span>
              <span className="text-xs text-slate-500">Define a new AI persona with skills.</span>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/40 dark:border-slate-700 dark:hover:border-primary-500 dark:hover:bg-primary-900/20"
            >
              <KeyRound className="text-emerald-600" size={20} />
              <span className="font-medium text-slate-900 dark:text-slate-100">Add LLM</span>
              <span className="text-xs text-slate-500">Configure a new model provider.</span>
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/40 dark:border-slate-700 dark:hover:border-primary-500 dark:hover:bg-primary-900/20"
            >
              <MessageSquare className="text-blue-600" size={20} />
              <span className="font-medium text-slate-900 dark:text-slate-100">Open Chat</span>
              <span className="text-xs text-slate-500">Start a conversation with your agents.</span>
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Status</h2>
            <Sparkles size={16} className="text-primary-500" />
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Default provider</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {defaultProvider ? defaultProvider.name : <span className="text-amber-600">Not set</span>}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Local server</dt>
              <dd className="font-mono text-xs text-slate-900 dark:text-slate-100">
                {localhostUrl ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Working dir</dt>
              <dd className="truncate font-mono text-xs text-slate-900 dark:text-slate-100">
                {appSettings?.workingDirectory ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Memories limit</dt>
              <dd className="font-mono text-xs text-slate-900 dark:text-slate-100">
                {appSettings?.maxMemoryItems ?? '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recent chatrooms</h2>
          <Link
            to="/chat"
            className="flex items-center gap-1 text-sm text-primary-600 hover:underline dark:text-primary-400"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {recentChatrooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
            <MessageSquare className="mb-2 text-slate-400" size={32} />
            <p className="text-sm text-slate-500">No chatrooms yet</p>
            <button
              onClick={() => navigate('/chat')}
              className="btn-primary mt-3"
            >
              <Plus size={14} />
              Start your first chat
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {recentChatrooms.map((room) => (
              <li key={room.id}>
                <Link
                  to={`/chat/${room.id}`}
                  className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700">
                      <MessageSquare size={16} className="text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {room.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {room.description ?? `${room.agentIds.length} agent(s)`}
                      </p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs text-slate-500">
                    {formatRelative(room.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-center text-xs text-slate-400">
        <Brain size={12} className="inline" /> Memory system tracks {totals.memories} messages across chatrooms
      </div>
    </div>
  );
};

export default Dashboard;