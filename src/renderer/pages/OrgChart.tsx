import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Users,
  Crown,
  Wand2,
  MessageCircle,
  UserX,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import { cn, getInitial } from '../lib/utils';
import type { Agent, Team } from '../../shared/types';

const OrgChartPage: React.FC = () => {
  const navigate = useNavigate();
  const agents = useAgentsStore((s) => s.agents);
  const teams = useAgentsStore((s) => s.teams);
  const loadingAgents = useAgentsStore((s) => s.loadingAgents);
  const loadAgents = useAgentsStore((s) => s.loadAgents);
  const loadTeams = useAgentsStore((s) => s.loadTeams);

  useEffect(() => {
    void loadAgents();
    void loadTeams();
  }, [loadAgents, loadTeams]);

  const leadAgents = useMemo(
    () => agents.filter((a) => a.isLead || a.role === 'lead'),
    [agents],
  );

  const teamsWithAgents = useMemo(() => {
    return teams
      .map((team) => ({
        ...team,
        members: agents.filter((a) => a.teamId === team.id),
      }))
      .filter((t) => t.members.length > 0 || true)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, agents]);

  const teamAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of agents) {
      if (a.teamId) ids.add(a.id);
    }
    return ids;
  }, [agents]);

  const independentAgents = useMemo(
    () => agents.filter((a) => !a.teamId),
    [agents],
  );

  if (loadingAgents && agents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          <p className="text-sm">Loading org chart…</p>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-900/30 dark:to-purple-900/30">
          <Users className="text-primary-500" size={36} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No agents yet</h2>
        <p className="max-w-sm text-sm text-slate-500">
          Create agents and assign them to teams to see your org chart here.
        </p>
        <button
          type="button"
          onClick={() => navigate('/agents')}
          className="btn-primary"
        >
          <Bot size={16} />
          Create agents
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Organization Chart</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} · {teams.length} team{teams.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/agents')}
          className="btn-secondary"
        >
          <Bot size={14} />
          Manage agents
        </button>
      </div>

      {/* Leadership */}
      {leadAgents.length > 0 && (
        <section>
          <SectionHeader icon={<Crown size={14} />} label="Leadership" color="amber" />
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            {leadAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} isLead onChat={() => navigate(`/agent-chat/${agent.id}`)} />
            ))}
          </div>
          {/* Connector to teams */}
          {(teamsWithAgents.length > 0 || independentAgents.length > 0) && (
            <div className="mt-6 flex justify-center">
              <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-600" />
            </div>
          )}
        </section>
      )}

      {/* Teams */}
      {teamsWithAgents.length > 0 && (
        <section>
          <SectionHeader icon={<Users size={14} />} label="Teams" color="primary" />
          <div className="mt-4 space-y-6">
            {teamsWithAgents.map((team) => (
              <TeamBlock
                key={team.id}
                team={team}
                onChatAgent={(id) => navigate(`/agent-chat/${id}`)}
                onEditTeam={() => navigate('/teams')}
              />
            ))}
          </div>
          {independentAgents.length > 0 && (
            <div className="mt-8 flex justify-center">
              <div className="h-0.5 w-full max-w-md bg-slate-200 dark:bg-slate-700" />
            </div>
          )}
        </section>
      )}

      {/* Independent agents */}
      {independentAgents.length > 0 && (
        <section>
          <SectionHeader icon={<UserX size={14} />} label="Unassigned Agents" color="slate" />
          <div className="mt-4 flex flex-wrap gap-4">
            {independentAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onChat={() => navigate(`/agent-chat/${agent.id}`)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Section header                                                       */
/* ------------------------------------------------------------------ */

const COLOR_MAP: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const SectionHeader: React.FC<{ icon: React.ReactNode; label: string; color: string }> = ({ icon, label, color }) => (
  <div className="flex items-center gap-2">
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', COLOR_MAP[color] ?? COLOR_MAP.slate)}>
      {icon}
      {label}
    </span>
    <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
  </div>
);

/* ------------------------------------------------------------------ */
/* Team block                                                           */
/* ------------------------------------------------------------------ */

interface TeamBlockProps {
  team: Team & { members: Agent[] };
  onChatAgent: (id: string) => void;
  onEditTeam: () => void;
}

const TeamBlock: React.FC<TeamBlockProps> = ({ team, onChatAgent }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
      {/* Team header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
          style={{ backgroundColor: team.color ?? '#6366f1' }}
        >
          {getInitial(team.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{team.name}</p>
          {team.description && (
            <p className="truncate text-xs text-slate-500">{team.description}</p>
          )}
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {team.members.length} member{team.members.length !== 1 ? 's' : ''}
        </span>
        {collapsed ? <ChevronDown size={16} className="flex-shrink-0 text-slate-400" /> : <ChevronUp size={16} className="flex-shrink-0 text-slate-400" />}
      </button>

      {/* Agents */}
      {!collapsed && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          {team.members.length === 0 ? (
            <p className="text-xs text-slate-400">No agents in this team yet.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {team.members.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isLead={agent.isLead || agent.role === 'lead'}
                  onChat={() => onChatAgent(agent.id)}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Agent card                                                           */
/* ------------------------------------------------------------------ */

interface AgentCardProps {
  agent: Agent;
  isLead?: boolean;
  onChat: () => void;
  compact?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, isLead, onChat, compact }) => {
  const [avatarBroken, setAvatarBroken] = useState(false);
  const showAvatar = !!agent.avatar && !avatarBroken;

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 shadow-sm dark:bg-slate-800',
          isLead
            ? 'border-amber-200 dark:border-amber-800/60'
            : 'border-slate-200/80 dark:border-slate-700/60',
        )}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: agent.color ?? '#6366f1' }}
        >
          {showAvatar ? (
            <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" onError={() => setAvatarBroken(true)} />
          ) : getInitial(agent.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="max-w-[120px] truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
              {agent.name}
            </p>
            {isLead && <Crown size={10} className="flex-shrink-0 text-amber-500" />}
          </div>
          <p className="max-w-[120px] truncate text-[10px] text-slate-500">{agent.role}</p>
        </div>
        <button
          type="button"
          onClick={onChat}
          className="ml-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-700 dark:hover:text-primary-400"
          title={`Chat with ${agent.name}`}
        >
          <MessageCircle size={13} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex w-48 flex-col gap-3 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900',
        isLead
          ? 'border-amber-300 shadow-amber-100 dark:border-amber-700/60 dark:shadow-amber-900/20'
          : 'border-slate-200/80 dark:border-slate-700/60',
      )}
    >
      {/* Color blob */}
      <div
        className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-15 blur-2xl"
        style={{ backgroundColor: agent.color ?? '#6366f1' }}
      />
      {isLead && (
        <div className="absolute right-3 top-3">
          <Crown size={14} className="text-amber-500" />
        </div>
      )}
      <div className="relative flex items-center gap-2.5">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white shadow-md"
          style={{ backgroundColor: agent.color ?? '#6366f1' }}
        >
          {showAvatar ? (
            <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" onError={() => setAvatarBroken(true)} />
          ) : getInitial(agent.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{agent.name}</p>
          <div className="flex items-center gap-1">
            {agent.role !== 'member' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary-600 dark:text-primary-400">
                <Wand2 size={9} />
                {agent.role}
              </span>
            )}
          </div>
        </div>
      </div>
      {agent.description && (
        <p className="relative line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
          {agent.description}
        </p>
      )}
      <button
        type="button"
        onClick={onChat}
        className="relative mt-auto flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-primary-100 hover:text-primary-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-primary-900/30 dark:hover:text-primary-300"
      >
        <MessageCircle size={12} />
        Chat
      </button>
    </div>
  );
};

export default OrgChartPage;
