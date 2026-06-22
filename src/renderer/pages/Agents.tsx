import React, { useMemo, useState } from 'react';
import { Plus, Bot, Trash2, Edit, Wand2, Users, Sparkles, AlertCircle } from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import AgentEditor from '../components/AgentEditor';
import AgentTemplatePicker from '../components/AgentTemplatePicker';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import type { Agent } from '../../shared/types';
import type { AgentTemplate } from '../../shared/agent-templates';
import { cn, getInitial } from '../lib/utils';
import type { AgentFormData } from '../lib/types';
import { incrementTemplateUsage } from '../lib/template-usage';

const AgentsPage: React.FC = () => {
  const agents = useAgentsStore((s) => s.agents);
  const teams = useAgentsStore((s) => s.teams);
  const loadingAgents = useAgentsStore((s) => s.loadingAgents);
  const createAgent = useAgentsStore((s) => s.createAgent);
  const updateAgent = useAgentsStore((s) => s.updateAgent);
  const deleteAgent = useAgentsStore((s) => s.deleteAgent);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<AgentTemplate | null>(null);
  const [pendingCreate, setPendingCreate] = useState<
    { data: AgentFormData; templateId: string | null } | null
  >(null);
  const [confirming, setConfirming] = useState(false);

  const teamsById = useMemo(() => {
    const m = new Map<string, (typeof teams)[number]>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  function openNew() {
    setPickerOpen(true);
  }

  function openNewBlank() {
    setEditing(null);
    setPendingTemplate(null);
    setEditorOpen(true);
  }

  function handleTemplatePicked(template: AgentTemplate | null) {
    setPickerOpen(false);
    setEditing(null);
    setPendingTemplate(template);
    setEditorOpen(true);
  }

  function openEdit(agent: Agent) {
    setEditing(agent);
    setPendingTemplate(null);
    setEditorOpen(true);
  }

  async function handleSave(data: AgentFormData) {
    if (data.id) {
      await updateAgent(data.id, data);
      return;
    }
    setPendingCreate({ data, templateId: pendingTemplate?.id ?? null });
    setConfirming(true);
  }

  async function confirmCreate() {
    if (!pendingCreate) return;
    const { data, templateId } = pendingCreate;
    setConfirming(false);
    setPendingCreate(null);
    try {
      await createAgent(data);
      if (templateId) {
        incrementTemplateUsage(templateId);
      }
      setEditorOpen(false);
      setPendingTemplate(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to create agent.');
    }
  }

  function cancelCreate() {
    setConfirming(false);
    setPendingCreate(null);
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
        <div className="flex items-center gap-2">
          <button onClick={openNew} className="btn-primary">
            <Sparkles size={16} />
            New Agent
          </button>
        </div>
      </div>

      {loadingAgents ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-40 shimmer" />
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
              Agents are AI personas with skills and roles. Pick a template to get started quickly,
              or build one from scratch.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button onClick={openNew} className="btn-primary">
                <Sparkles size={16} />
                Choose a template
              </button>
              <button onClick={openNewBlank} className="btn-secondary">
                <Plus size={16} />
                Start from blank
              </button>
            </div>
          </div>
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

      <AgentTemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleTemplatePicked}
      />

      <AgentEditor
        agent={editing}
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setPendingTemplate(null);
        }}
        onSave={handleSave}
        initialTemplate={pendingTemplate}
        onChangeTemplate={() => {
          setEditorOpen(false);
          setPendingTemplate(null);
          setPickerOpen(true);
        }}
      />

      <Modal
        open={confirming}
        onClose={cancelCreate}
        title={
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500" />
            <span>Add this agent?</span>
          </div>
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={cancelCreate} size="md">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void confirmCreate()}
              leftIcon={<Sparkles size={14} />}
            >
              Yes, add agent
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>
            You are about to add a new agent
            {pendingTemplate ? (
              <>
                {' '}based on the template{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {pendingTemplate.emoji} {pendingTemplate.name}
                </span>
              </>
            ) : (
              ' built from scratch'
            )}
            .
          </p>
          {pendingCreate && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/50">
              <div className="mb-1">
                <span className="text-slate-500">Name:</span>{' '}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {pendingCreate.data.name || '(unnamed)'}
                </span>
              </div>
              <div className="mb-1">
                <span className="text-slate-500">Role:</span>{' '}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {pendingCreate.data.isLead ? 'Lead' : pendingCreate.data.role}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Skills:</span>{' '}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {pendingCreate.data.enabledSkills?.length ?? 0} enabled
                </span>
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500">
            The agent will be saved to your local database. You can edit or delete it later.
          </p>
        </div>
      </Modal>
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
    <div className="card group relative flex flex-col gap-3 overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
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
        {teamName && (
          <span className="badge-neutral">
            <Users size={10} />
            {teamName}
          </span>
        )}
        <span className="badge-neutral">
          <Wand2 size={10} />
          {agent.enabledSkills?.length ?? 0} skills
        </span>
      </div>

      <div className="relative mt-auto flex items-center justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title="Edit"
        >
          <Edit size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default AgentsPage;