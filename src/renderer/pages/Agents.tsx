import React, { useMemo, useState } from 'react';
import { Plus, Bot, Trash2, Edit, Wand2, Users } from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import AgentEditor from '../components/AgentEditor';
import type { Agent } from '../../shared/types';
import { cn, getInitial } from '../lib/utils';
import type { AgentFormData } from '../lib/types';

const AgentsPage: React.FC = () => {
  const agents = useAgentsStore((s) => s.agents);
  const teams = useAgentsStore((s) => s.teams);
  const loadingAgents = useAgentsStore((s) => s.loadingAgents);
  const createAgent = useAgentsStore((s) => s.createAgent);
  const updateAgent = useAgentsStore((s) => s.updateAgent);
  const deleteAgent = useAgentsStore((s) => s.deleteAgent);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);

  const teamsById = useMemo(() => {
    const m = new Map<string, (typeof teams)[number]>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(agent: Agent) {
    setEditing(agent);
    setEditorOpen(true);
  }

  async function handleSave(data: AgentFormData) {
    if (data.id) {
      await updateAgent(data.id, data);
    } else {
      await createAgent(data);
    }
  }

  async function handleDelete(agent: Agent) {
    if (!window.confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    await deleteAgent(agent.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Agents</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Define AI personas with skills and roles.
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} />
          New Agent
        </button>
      </div>

      {loadingAgents ? (
        <p className="text-sm text-slate-500">Loading agents…</p>
      ) : agents.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Bot className="text-slate-400" size={40} />
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">No agents yet</h2>
          <p className="max-w-sm text-sm text-slate-500">
            Agents are AI personas that respond to chats. Add an LLM provider in Settings first.
          </p>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Create your first agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              teamName={agent.teamId ? teamsById.get(agent.teamId)?.name : undefined}
              onEdit={() => openEdit(agent)}
              onDelete={() => handleDelete(agent)}
            />
          ))}
        </div>
      )}

      <AgentEditor
        agent={editing}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};

interface AgentCardProps {
  agent: Agent;
  teamName?: string;
  onEdit: () => void;
  onDelete: () => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, teamName, onEdit, onDelete }) => {
  return (
    <div className="card group flex flex-col gap-3 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow"
          style={{ backgroundColor: agent.color ?? '#6366f1' }}
        >
          {agent.avatar ? (
            <img
              src={agent.avatar}
              alt={agent.name}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            getInitial(agent.name)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">{agent.name}</h3>
          <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {agent.description || 'No description'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span
          className={cn(
            'badge',
            agent.role === 'lead'
              ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300'
              : agent.role === 'observer'
                ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
          )}
        >
          {agent.role}
        </span>
        {teamName && (
          <span className="badge bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <Users size={10} className="mr-1" />
            {teamName}
          </span>
        )}
        <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <Wand2 size={10} className="mr-1" />
          {agent.enabledSkills?.length ?? 0} skills
        </span>
      </div>

      <div className="mt-auto flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title="Edit"
        >
          <Edit size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default AgentsPage;