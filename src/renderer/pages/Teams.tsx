import React, { useMemo, useState } from 'react';
import { Plus, Users, Trash2, Edit, ChevronDown, ChevronRight } from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import TeamEditor from '../components/TeamEditor';
import type { Team } from '../../shared/types';
import { cn, getInitial } from '../lib/utils';
import type { TeamFormData } from '../lib/types';

const TeamsPage: React.FC = () => {
  const teams = useAgentsStore((s) => s.teams);
  const agents = useAgentsStore((s) => s.agents);
  const loadingTeams = useAgentsStore((s) => s.loadingTeams);
  const createTeam = useAgentsStore((s) => s.createTeam);
  const updateTeam = useAgentsStore((s) => s.updateTeam);
  const deleteTeam = useAgentsStore((s) => s.deleteTeam);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);

  const agentsByTeam = useMemo(() => {
    const map = new Map<string, typeof agents>();
    for (const a of agents) {
      if (!a.teamId) continue;
      const list = map.get(a.teamId) ?? [];
      list.push(a);
      map.set(a.teamId, list);
    }
    return map;
  }, [agents]);

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(team: Team) {
    setEditing(team);
    setEditorOpen(true);
  }

  async function handleSave(data: TeamFormData) {
    if (data.id) {
      await updateTeam(data.id, data);
    } else {
      await createTeam(data);
    }
  }

  async function handleDelete(team: Team) {
    if (!window.confirm(`Delete team "${team.name}"? Agents will be unassigned.`)) return;
    await deleteTeam(team.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Teams</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Group agents together with shared instructions.
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} />
          New Team
        </button>
      </div>

      {loadingTeams ? (
        <p className="text-sm text-slate-500">Loading teams…</p>
      ) : teams.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Users className="text-slate-400" size={40} />
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">No teams yet</h2>
          <p className="max-w-sm text-sm text-slate-500">
            Teams let you bundle agents with shared context and instructions.
          </p>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Create your first team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              members={agentsByTeam.get(team.id) ?? []}
              onEdit={() => openEdit(team)}
              onDelete={() => handleDelete(team)}
            />
          ))}
        </div>
      )}

      <TeamEditor
        team={editing}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};

interface TeamCardProps {
  team: Team;
  members: Array<{ id: string; name: string; color?: string }>;
  onEdit: () => void;
  onDelete: () => void;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, members, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div
        className="h-2 w-full"
        style={{ backgroundColor: team.color ?? '#64748b' }}
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">{team.name}</h3>
            {team.description && (
              <p className="line-clamp-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                {team.description}
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              title="Edit"
            >
              <Edit size={14} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {team.instructions && (
          <p className="line-clamp-2 rounded bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
            {team.instructions}
          </p>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-auto flex items-center gap-1 self-start text-xs font-medium text-slate-600 hover:underline dark:text-slate-400"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {members.length} agent{members.length !== 1 ? 's' : ''}
        </button>

        {expanded && (
          <ul className="space-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-700">
            {members.length === 0 && (
              <li className="text-xs text-slate-500">No agents assigned yet.</li>
            )}
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-xs">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: m.color ?? '#64748b' }}
                >
                  {getInitial(m.name)}
                </span>
                <span className="truncate text-slate-700 dark:text-slate-200">{m.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TeamsPage;