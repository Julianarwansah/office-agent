import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Pencil,
  Sparkles,
  Wrench,
  Loader2,
} from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import { useChatRoomsStore } from '../stores/chatrooms';
import { cn, getInitial } from '../lib/utils';
import type { Agent, Team } from '../../shared/types';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type AgentStatus = 'pending' | 'streaming' | 'tool_call' | null;

interface OrgNode {
  id: string;
  type: 'lead' | 'team' | 'agent' | 'group';
  label: string;
  subtitle?: string;
  color?: string;
  avatar?: string;
  isLead?: boolean;
  role?: string;
  agent?: Agent;
  team?: Team;
  children: OrgNode[];
}

/* ------------------------------------------------------------------ */
/* Build tree                                                          */
/* ------------------------------------------------------------------ */

function agentToNode(a: Agent): OrgNode {
  return {
    id: a.id, type: 'agent',
    label: a.name, subtitle: a.description,
    color: a.color ?? '#64748b', avatar: a.avatar,
    isLead: a.isLead || a.role === 'lead', role: a.role,
    agent: a, children: [],
  };
}

function buildTree(agents: Agent[], teams: Team[]): OrgNode[] {
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const leadAgents = agents.filter((a) => a.isLead || a.role === 'lead');
  const nonLeadAgents = agents.filter((a) => !a.isLead && a.role !== 'lead');

  const agentsByTeam = new Map<string, Agent[]>();
  const standaloneAgents: Agent[] = [];

  for (const agent of nonLeadAgents) {
    if (agent.teamId && teamsById.has(agent.teamId)) {
      const list = agentsByTeam.get(agent.teamId) ?? [];
      list.push(agent);
      agentsByTeam.set(agent.teamId, list);
    } else {
      standaloneAgents.push(agent);
    }
  }

  const teamNodes: OrgNode[] = teams
    .filter((t) => agentsByTeam.has(t.id))
    .map((team) => ({
      id: `team-${team.id}`, type: 'team' as const,
      label: team.name, subtitle: team.description,
      color: team.color ?? '#64748b', team,
      children: (agentsByTeam.get(team.id) ?? []).map(agentToNode),
    }));

  const standaloneNode: OrgNode | null = standaloneAgents.length > 0
    ? { id: 'standalone', type: 'group', label: 'Independent', subtitle: `${standaloneAgents.length} unassigned`, color: '#94a3b8', children: standaloneAgents.map(agentToNode) }
    : null;

  const secondLevel = [...teamNodes, ...(standaloneNode ? [standaloneNode] : [])];
  if (leadAgents.length === 0) return secondLevel;
  return leadAgents.map((lead, i) => ({ ...agentToNode(lead), isLead: true, children: i === 0 ? secondLevel : [] }));
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CONNECTOR_H = 36;
const LINE_COLOR = '#e2e8f0';
const LINE_COLOR_ACTIVE = '#64748b';

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

const OrgChartPage: React.FC = () => {
  const navigate = useNavigate();
  const agents = useAgentsStore((s) => s.agents);
  const teams = useAgentsStore((s) => s.teams);
  const loadingAgents = useAgentsStore((s) => s.loadingAgents);
  const loadAgents = useAgentsStore((s) => s.loadAgents);
  const loadTeams = useAgentsStore((s) => s.loadTeams);
  const streamingMessages = useChatRoomsStore((s) => s.streamingMessages);

  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  useEffect(() => { void loadAgents(); void loadTeams(); }, [loadAgents, loadTeams]);

  const tree = useMemo(() => buildTree(agents, teams), [agents, teams]);

  // Derive active agent statuses from all streaming messages
  const activeAgents = useMemo(() => {
    const map = new Map<string, AgentStatus>();
    for (const msgs of Object.values(streamingMessages)) {
      for (const msg of msgs) {
        const existing = map.get(msg.agentId);
        // Priority: tool_call > streaming > pending
        if (!existing || (msg.status === 'tool_call') || (msg.status === 'streaming' && existing === 'pending')) {
          map.set(msg.agentId, msg.status as AgentStatus);
        }
      }
    }
    return map;
  }, [streamingMessages]);

  const hasAnyActive = activeAgents.size > 0;

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const handleZoom = (delta: number) =>
    setZoom((z) => Math.max(0.3, Math.min(2, +(z + delta).toFixed(1))));

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button,input,a')) return;
    setIsPanning(true);
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning || !panStart.current) return;
    setPan({ x: panStart.current.px + (e.clientX - panStart.current.mx), y: panStart.current.py + (e.clientY - panStart.current.my) });
  }, [isPanning]);

  const onMouseUp = useCallback(() => { setIsPanning(false); panStart.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  if (loadingAgents && agents.length === 0) {
    return <div className="flex h-full items-center justify-center"><span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" /></div>;
  }

  if (agents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-400"><Users size={28} strokeWidth={1.8} /></div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No agents yet</h2>
        <p className="max-w-sm text-sm text-slate-500">Create agents and assign them to teams.</p>
        <button type="button" onClick={() => navigate('/agents')} className="btn-primary"><Bot size={16} /> Create agents</button>
      </div>
    );
  }

  return (
    <div className="flex h-full -m-6 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Organization Chart</h1>
            <p className="text-xs text-slate-500">
              {agents.length} agent{agents.length !== 1 ? 's' : ''} · {teams.length} team{teams.length !== 1 ? 's' : ''} · Drag to pan · Scroll to zoom
            </p>
          </div>
          {hasAnyActive && (
            <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-slate-300 dark:ring-zinc-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-500" />
              </span>
              {activeAgents.size} agent{activeAgents.size !== 1 ? 's' : ''} active
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/teams')} className="btn-secondary !py-1.5 !text-xs"><Users size={13} /> Teams</button>
          <button type="button" onClick={() => navigate('/agents')} className="btn-secondary !py-1.5 !text-xs"><Bot size={13} /> Agents</button>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
            <button type="button" onClick={() => handleZoom(-0.1)} disabled={zoom <= 0.3} className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700" title="Zoom out"><ZoomOut size={14} /></button>
            <span className="min-w-[38px] text-center text-xs font-medium text-slate-600 dark:text-slate-300">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => handleZoom(0.1)} disabled={zoom >= 2} className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700" title="Zoom in"><ZoomIn size={14} /></button>
            <button type="button" onClick={resetView} className="rounded p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" title="Reset view"><Maximize2 size={14} /></button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        className={cn(
          'relative flex-1 overflow-hidden',
          'bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px]',
          'dark:bg-[radial-gradient(circle,#334155_1px,transparent_1px)]',
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onMouseDown={onMouseDown}
        onWheel={(e) => { e.preventDefault(); handleZoom(e.deltaY < 0 ? 0.1 : -0.1); }}
      >
        <div
          className="absolute inset-0 flex items-start justify-center pt-8"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top center', transition: isPanning ? 'none' : 'transform 0.15s ease' }}
        >
          <div className="flex flex-col items-center">
            {tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                collapsed={collapsed}
                activeAgents={activeAgents}
                onToggle={toggleCollapse}
                onChat={(id) => navigate(`/agent-chat/${id}`)}
                onEdit={() => navigate('/agents')}
                onEditTeam={() => navigate('/teams')}
              />
            ))}
          </div>
        </div>

        {/* Pan hint */}
        {pan.x === 0 && pan.y === 0 && zoom === 1 && (
          <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs text-slate-500 shadow-sm backdrop-blur dark:bg-zinc-800/80">
            <Move size={12} /> Drag to pan · Scroll to zoom
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-5 border-t border-slate-200 bg-white px-6 py-2.5 dark:border-zinc-700 dark:bg-zinc-800">
        <span className="text-xs font-medium text-slate-400">Legend</span>
        {[
          { dot: 'bg-slate-700', label: 'Lead' },
          { dot: 'bg-slate-500', label: 'Team' },
          { dot: 'bg-slate-400', label: 'Agent' },
          { dot: 'bg-slate-300', label: 'Independent' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-full', item.dot)} />
            <span className="text-xs text-slate-500">{item.label}</span>
          </div>
        ))}
        <div className="mx-1 h-3 w-px bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs font-medium text-slate-400">Activity</span>
        {[
          { cls: 'bg-slate-400 agent-thinking', label: 'Thinking' },
          { cls: 'bg-slate-600 agent-streaming', label: 'Responding' },
          { cls: 'bg-slate-500 agent-tool', label: 'Using tool' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-full', item.cls)} />
            <span className="text-xs text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* TreeNode                                                            */
/* ------------------------------------------------------------------ */

interface TreeNodeProps {
  node: OrgNode;
  collapsed: Set<string>;
  activeAgents: Map<string, AgentStatus>;
  onToggle: (id: string) => void;
  onChat: (id: string) => void;
  onEdit: (agent: Agent) => void;
  onEditTeam: (team: Team) => void;
}

const TreeNode: React.FC<TreeNodeProps> = (props) => {
  const { node, collapsed, activeAgents } = props;
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;

  // Is any descendant active?
  const hasActiveDescendant = useMemo(() => {
    const check = (n: OrgNode): boolean => {
      if (n.agent && activeAgents.has(n.agent.id)) return true;
      return n.children.some(check);
    };
    return check(node);
  }, [node, activeAgents]);

  const lineColor = hasActiveDescendant ? LINE_COLOR_ACTIVE : LINE_COLOR;

  return (
    <div className="flex flex-col items-center">
      <NodeCard
        node={node}
        hasChildren={hasChildren}
        isCollapsed={isCollapsed}
        agentStatus={node.agent ? (activeAgents.get(node.agent.id) ?? null) : null}
        hasActiveDescendant={hasActiveDescendant}
        onToggle={() => props.onToggle(node.id)}
        onChat={props.onChat}
        onEdit={props.onEdit}
        onEditTeam={props.onEditTeam}
      />
      {hasChildren && !isCollapsed && (
        <ChildrenBranch lineColor={lineColor}>
          {node.children.map((child) => {
            const childHasActive = child.agent
              ? activeAgents.has(child.agent.id)
              : child.children.some((c) => c.agent && activeAgents.has(c.agent!.id));
            return (
              <ChildColumn key={child.id} single={node.children.length === 1} lineColor={childHasActive ? LINE_COLOR_ACTIVE : lineColor}>
                <TreeNode {...props} node={child} />
              </ChildColumn>
            );
          })}
        </ChildrenBranch>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Connector lines                                                     */
/* ------------------------------------------------------------------ */

const ChildrenBranch: React.FC<{ children: React.ReactNode; lineColor: string }> = ({ children, lineColor }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const cols = el.querySelectorAll<HTMLElement>(':scope > .org-child-col');
      if (cols.length < 2) { setLine(null); return; }
      const parent = el.getBoundingClientRect();
      const first = cols[0].getBoundingClientRect();
      const last = cols[cols.length - 1].getBoundingClientRect();
      setLine({ left: first.left + first.width / 2 - parent.left, width: last.left + last.width / 2 - (first.left + first.width / 2) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: 2, height: CONNECTOR_H, background: lineColor, flexShrink: 0, transition: 'background 0.4s' }} />
      <div ref={containerRef} className="relative flex items-start">
        {line && line.width > 0 && (
          <div className="pointer-events-none absolute" style={{ top: 0, left: line.left, width: line.width, height: 2, background: lineColor, transition: 'background 0.4s' }} />
        )}
        {children}
      </div>
    </div>
  );
};

const ChildColumn: React.FC<{ children: React.ReactNode; single: boolean; lineColor: string }> = ({ children, single, lineColor }) => (
  <div className="org-child-col flex flex-col items-center px-4">
    <div style={{ width: 2, height: single ? 0 : CONNECTOR_H, background: lineColor, flexShrink: 0, transition: 'background 0.4s' }} />
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/* NodeCard                                                            */
/* ------------------------------------------------------------------ */

interface NodeCardProps {
  node: OrgNode;
  hasChildren: boolean;
  isCollapsed: boolean;
  agentStatus: AgentStatus;
  hasActiveDescendant: boolean;
  onToggle: () => void;
  onChat: (id: string) => void;
  onEdit: (agent: Agent) => void;
  onEditTeam: (team: Team) => void;
}

function statusClass(status: AgentStatus): string {
  if (status === 'pending') return 'agent-thinking';
  if (status === 'streaming') return 'agent-streaming';
  if (status === 'tool_call') return 'agent-tool';
  return '';
}

function statusBorderColor(status: AgentStatus): string {
  if (status === 'pending') return '#94a3b8';
  if (status === 'streaming') return '#475569';
  if (status === 'tool_call') return '#64748b';
  return '';
}

const NodeCard: React.FC<NodeCardProps> = ({
  node, hasChildren, isCollapsed, agentStatus, hasActiveDescendant,
  onToggle, onChat, onEdit, onEditTeam,
}) => {
  const [avatarBroken, setAvatarBroken] = useState(false);
  const isActive = agentStatus !== null;

  /* --- Group --- */
  if (node.type === 'group') {
    return (
      <div className={cn(
        'relative flex w-44 select-none flex-col items-center gap-2 rounded-2xl border-2 border-dashed bg-white px-4 py-3.5 shadow-sm transition-all dark:bg-zinc-900',
        hasActiveDescendant ? 'border-slate-500 dark:border-slate-400' : 'border-slate-300 dark:border-slate-600',
      )}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800">
          <UserX size={16} className="text-slate-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{node.label}</p>
          {node.subtitle && <p className="text-xs text-slate-400">{node.subtitle}</p>}
        </div>
        {hasChildren && <CollapseBtn isCollapsed={isCollapsed} onClick={onToggle} active={hasActiveDescendant} />}
      </div>
    );
  }

  /* --- Team --- */
  if (node.type === 'team') {
    return (
      <div
        className="relative flex w-52 select-none flex-col gap-2 rounded-2xl border-2 bg-white px-4 py-3.5 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900"
        style={{ borderColor: hasActiveDescendant ? LINE_COLOR_ACTIVE : (node.color ?? '#6366f1') }}
      >
        {hasActiveDescendant && (
          <div className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 shadow-sm">
            <span className="h-2 w-2 animate-ping rounded-full bg-white opacity-90" />
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm" style={{ backgroundColor: node.color }}>
            <Users size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{node.label}</p>
            {node.subtitle && <p className="truncate text-xs text-slate-500">{node.subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">{node.children.length} member{node.children.length !== 1 ? 's' : ''}</span>
          {node.team && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onEditTeam(node.team!); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" title="Edit team">
              <Pencil size={11} />
            </button>
          )}
        </div>
        {hasChildren && <CollapseBtn isCollapsed={isCollapsed} onClick={onToggle} active={hasActiveDescendant} />}
      </div>
    );
  }

  /* --- Agent --- */
  const showAvatar = !!node.avatar && !avatarBroken;

  return (
    <div
      className={cn(
        'relative flex w-44 select-none flex-col gap-2.5 overflow-hidden rounded-2xl border-2 bg-white px-4 py-3.5 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900',
        node.isLead ? 'border-slate-600 dark:border-slate-400' : 'border-slate-200 dark:border-zinc-700',
        isActive && statusClass(agentStatus),
      )}
      style={isActive ? { borderColor: statusBorderColor(agentStatus) } : undefined}
    >
      {/* Color glow */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-slate-200/40 blur-xl dark:bg-slate-700/30" />

      {/* Lead crown */}
      {node.isLead && !isActive && (
        <div className="absolute right-3 top-3"><Crown size={13} className="text-slate-500" /></div>
      )}

      {/* Activity badge */}
      {isActive && (
        <div className={cn(
          'absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm',
          agentStatus === 'pending' && 'bg-slate-600',
          agentStatus === 'streaming' && 'bg-slate-600',
          agentStatus === 'tool_call' && 'bg-slate-500',
        )}>
          {agentStatus === 'pending' && (
            <><span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-white" /> Thinking</>
          )}
          {agentStatus === 'streaming' && (
            <><Sparkles size={9} className="animate-pulse" /> Live</>
          )}
          {agentStatus === 'tool_call' && (
            <><Wrench size={9} className="animate-spin" /> Tool</>
          )}
        </div>
      )}

      {/* Avatar + name */}
      <div className="relative flex items-center gap-2.5">
        <div className="relative">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white shadow-md"
            style={{ backgroundColor: node.color }}
          >
            {showAvatar ? (
              <img src={node.avatar} alt={node.label} className="h-full w-full object-cover" onError={() => setAvatarBroken(true)} />
            ) : getInitial(node.label)}
          </div>
          {/* Live pulse ring on avatar */}
          {isActive && (
            <span
              className="absolute -inset-1 rounded-xl opacity-60"
              style={{
                boxShadow: `0 0 0 2px ${statusBorderColor(agentStatus)}`,
                animation: agentStatus === 'streaming' ? 'agent-streaming 1.2s ease-out infinite' : undefined,
              }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{node.label}</p>
          {node.role && node.role !== 'member' && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              <Wand2 size={9} /> {node.role}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {node.subtitle && (
        <p className="relative line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {node.subtitle}
        </p>
      )}

      {/* Active status text */}
      {isActive && (
        <div className={cn(
          'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium',
          agentStatus === 'pending' && 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
          agentStatus === 'streaming' && 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
          agentStatus === 'tool_call' && 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400',
        )}>
          {agentStatus === 'pending' && <><Loader2 size={10} className="animate-spin" /> Processing…</>}
          {agentStatus === 'streaming' && <><Sparkles size={10} className="animate-pulse" /> Responding…</>}
          {agentStatus === 'tool_call' && <><Wrench size={10} className="animate-spin" /> Using tool…</>}
        </div>
      )}

      {/* Actions */}
      {node.agent && (
        <div className="relative flex gap-1.5">
          <button
            type="button"
            onClick={() => onChat(node.agent!.id)}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:bg-zinc-800 dark:text-slate-300 dark:hover:bg-zinc-700"
          >
            <MessageCircle size={11} /> Chat
          </button>
          <button
            type="button"
            onClick={() => onEdit(node.agent!)}
            className="flex items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:bg-zinc-800 dark:hover:bg-slate-700"
            title="Edit agent"
          >
            <Pencil size={11} />
          </button>
        </div>
      )}

      {hasChildren && <CollapseBtn isCollapsed={isCollapsed} onClick={onToggle} active={hasActiveDescendant} />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* CollapseBtn                                                         */
/* ------------------------------------------------------------------ */

const CollapseBtn: React.FC<{ isCollapsed: boolean; onClick: (e: React.MouseEvent) => void; active?: boolean }> = ({
  isCollapsed, onClick, active,
}) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(e); }}
    className={cn(
      'absolute -bottom-3.5 left-1/2 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-all dark:bg-zinc-900',
      active
        ? 'border-slate-500 text-slate-700 dark:border-slate-400 dark:text-slate-200'
        : 'border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-700 dark:border-zinc-700',
    )}
    title={isCollapsed ? 'Expand' : 'Collapse'}
  >
    {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
  </button>
);

export default OrgChartPage;
