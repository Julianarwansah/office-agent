import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  ChevronDown,
  MessageSquare,
  Wand2,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  User,
  ArrowLeft,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api, unwrap } from '../lib/api';
import { cn } from '../lib/utils';
import { useAgentsStore } from '../stores/agents';
import type { Agent } from '../../shared/types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

interface AgentAnalytics {
  agentId: string;
  messageCount: number;
  toolExecutionCount: number;
  successRate: number;
  mostUsedSkills: Array<{ skillName: string; count: number }>;
  messageCountsByDay: Array<{ date: string; count: number }>;
}

interface AnalyticsOverview {
  totalMessages: number;
  totalToolExecutions: number;
  agentStats: AgentAnalytics[];
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time',
};

const SKILL_COLORS = [
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f43f5e', // rose-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
];

const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const agents = useAgentsStore((s) => s.agents);
  const loadAgents = useAgentsStore((s) => s.loadAgents);

  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    async function loadAnalytics() {
      if (agents.length === 0) return;
      setLoading(true);
      setError(null);
      try {
        const data = unwrap(
          await api.analytics.overview({
            agentIds: agents.map((a) => a.id),
            timeRange,
          }),
        );
        setOverview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }
    void loadAnalytics();
  }, [agents, timeRange]);

  const agentsById = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents) map.set(a.id, a);
    return map;
  }, [agents]);

  const selectedAnalytics = useMemo(() => {
    if (!selectedAgent || !overview) return null;
    return overview.agentStats.find((s) => s.agentId === selectedAgent) ?? null;
  }, [selectedAgent, overview]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/')}>
            Dashboard
          </Button>
          <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700" />
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            <BarChart3 className="text-indigo-500" size={24} />
            Agent Analytics
          </h1>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Agent Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Agent:</span>
            <div className="relative">
              <select
                value={selectedAgent ?? 'all'}
                onChange={(e) => setSelectedAgent(e.target.value === 'all' ? null : e.target.value)}
                className="appearance-none rounded-md border border-slate-200 bg-white px-3 py-1.5 pr-8 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-100"
              >
                <option value="all">All Agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Time range:</span>
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="appearance-none rounded-md border border-slate-200 bg-white px-3 py-1.5 pr-8 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-100"
              >
                {Object.entries(TIME_RANGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !overview && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
        </div>
      )}

      {/* Empty State */}
      {!loading && agents.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
            <User size={32} className="text-slate-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-slate-900 dark:text-slate-100">No agents yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Create an agent to see analytics</p>
          </div>
          <Button variant="primary" onClick={() => navigate('/agents')}>
            Create Agent
          </Button>
        </div>
      )}

      {/* Analytics Content */}
      {overview && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={MessageSquare}
              label="Total Messages"
              value={overview.totalMessages.toLocaleString()}
              color="indigo"
            />
            <StatCard
              icon={Wand2}
              label="Tool Executions"
              value={overview.totalToolExecutions.toLocaleString()}
              color="amber"
            />
            <StatCard
              icon={Activity}
              label="Active Agents"
              value={agents.length.toString()}
              color="emerald"
            />
            <StatCard
              icon={TrendingUp}
              label="Avg Success Rate"
              value={`${Math.round(
                overview.agentStats.reduce((sum, s) => sum + s.successRate, 0) /
                  (overview.agentStats.length || 1),
              )}%`}
              color="blue"
            />
          </div>

          {/* Agent Stats Table */}
          <div className="card flex-1 overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Agent Performance</h2>
            </div>
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Agent</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Messages</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Tool Calls</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Success Rate</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Top Skills</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-700">
                  {overview.agentStats
                    .sort((a, b) => b.messageCount - a.messageCount)
                    .map((stat) => {
                      const agent = agentsById.get(stat.agentId);
                      if (!agent) return null;
                      return (
                        <tr key={stat.agentId} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ backgroundColor: agent.color ?? '#64748b' }}
                              >
                                {agent.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="font-medium text-slate-900 dark:text-slate-100">{agent.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            {stat.messageCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            {stat.toolExecutionCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                stat.successRate >= 80
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : stat.successRate >= 50
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                              )}
                            >
                              <CheckCircle size={10} />
                              {stat.successRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {stat.mostUsedSkills.slice(0, 3).map((skill) => (
                                <span
                                  key={skill.skillName}
                                  className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-zinc-800 dark:text-slate-400"
                                >
                                  {skill.skillName} ({skill.count})
                                </span>
                              ))}
                              {stat.mostUsedSkills.length === 0 && (
                                <span className="text-xs text-slate-400">No tools used</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedAgent(stat.agentId)}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && selectedAnalytics && (
        <AgentDetailModal
          open={true}
          onClose={() => setSelectedAgent(null)}
          agent={agentsById.get(selectedAgent)!}
          analytics={selectedAnalytics}
          timeRange={timeRange}
        />
      )}
    </div>
  );
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  color: 'indigo' | 'amber' | 'emerald' | 'blue' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, color }) => {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  };

  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', colorClasses[color])}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
};

interface AgentDetailModalProps {
  open: boolean;
  onClose: () => void;
  agent: Agent;
  analytics: AgentAnalytics;
  timeRange: TimeRange;
}

const AgentDetailModal: React.FC<AgentDetailModalProps> = ({ open, onClose, agent, analytics, timeRange }) => {
  return (
    <Modal open={open} onClose={onClose} title={`${agent.name} - Analytics`} size="lg">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-zinc-800/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">Messages Sent</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analytics.messageCount}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-zinc-800/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">Tool Executions</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analytics.toolExecutionCount}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-zinc-800/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">Success Rate</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analytics.successRate}%</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-zinc-800/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">Time Range</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{TIME_RANGE_LABELS[timeRange]}</p>
          </div>
        </div>

        {/* Message Activity Chart */}
        {analytics.messageCountsByDay.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-4 dark:border-zinc-700">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Message Activity</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.messageCountsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-zinc-700" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 10 }}
                    stroke="#64748b"
                  />
                  <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ borderRadius: 6, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Most Used Skills */}
        {analytics.mostUsedSkills.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-4 dark:border-zinc-700">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Most Used Skills</h3>
            <div className="flex flex-col gap-4 lg:flex-row">
              {/* Pie Chart */}
              <div className="h-48 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.mostUsedSkills}
                      dataKey="count"
                      nameKey="skillName"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {analytics.mostUsedSkills.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={SKILL_COLORS[index % SKILL_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap">
                {analytics.mostUsedSkills.map((skill, index) => (
                  <div key={skill.skillName} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: SKILL_COLORS[index % SKILL_COLORS.length] }}
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{skill.skillName}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">({skill.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AnalyticsPage;
