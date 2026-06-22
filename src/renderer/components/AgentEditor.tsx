import React, { useEffect, useMemo, useState } from 'react';
import { Save, Loader2, Wand2 } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input, { Textarea, Select } from './ui/Input';
import { useAgentsStore } from '../stores/agents';
import { useLLMStore } from '../stores/llm';
import { useSkillsStore } from '../stores/skills';
import type { Agent, AgentRole, AgentSkill, Skill } from '../../shared/types';
import type { AgentFormData } from '../lib/types';

export interface AgentEditorProps {
  agent?: Agent | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: AgentFormData) => Promise<void> | void;
}

const ROLE_OPTIONS: Array<{ value: AgentRole; label: string }> = [
  { value: 'lead', label: 'Lead — coordinates the team' },
  { value: 'member', label: 'Member — contributes as requested' },
  { value: 'observer', label: 'Observer — read-only awareness' },
];

const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#a855f7',
];

const EMPTY: AgentFormData = {
  name: '',
  description: '',
  avatar: '',
  systemPrompt: '',
  providerId: '',
  teamId: '',
  role: 'member',
  color: '#6366f1',
  isLead: false,
  enabledSkills: [],
  temperature: 0.7,
  maxTokens: 4096,
};

const AgentEditor: React.FC<AgentEditorProps> = ({ agent, open, onClose, onSave }) => {
  const providers = useLLMStore((s) => s.providers);
  const loadProviders = useLLMStore((s) => s.loadProviders);
  const teams = useAgentsStore((s) => s.teams);
  const skills = useSkillsStore((s) => s.skills);

  const initial = useMemo<AgentFormData>(() => {
    if (!agent) return EMPTY;
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description ?? '',
      avatar: agent.avatar ?? '',
      systemPrompt: agent.systemPrompt,
      providerId: agent.providerId,
      teamId: agent.teamId ?? '',
      role: agent.role,
      color: agent.color ?? '#6366f1',
      isLead: agent.isLead ?? false,
      enabledSkills: agent.enabledSkills ?? [],
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.maxTokens ?? 4096,
    };
  }, [agent]);

  const [form, setForm] = useState<AgentFormData>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial);
    setError(null);
  }, [initial, open]);

  useEffect(() => {
    if (open && providers.length === 0) void loadProviders();
  }, [open, providers.length, loadProviders]);

  const update = <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  function toggleSkill(skill: Skill) {
    setForm((f) => {
      const exists = f.enabledSkills.find((s) => s.name === skill.name);
      const enabled: AgentSkill[] = exists
        ? f.enabledSkills.filter((s) => s.name !== skill.name)
        : [...f.enabledSkills, { name: skill.name, enabled: true }];
      return { ...f, enabledSkills: enabled };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!form.providerId) {
      setError('Please select an LLM provider.');
      return;
    }
    setSubmitting(true);
    try {
      const cleaned: AgentFormData = {
        ...form,
        name: form.name.trim(),
        description: form.description?.trim(),
        teamId: form.teamId || undefined,
        avatar: form.avatar?.trim() || undefined,
      };
      await onSave(cleaned);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={agent ? 'Edit Agent' : 'New Agent'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="agent-editor-form"
            loading={submitting}
            leftIcon={<Save size={14} />}
          >
            Save
          </Button>
        </>
      }
    >
      <form id="agent-editor-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Name *"
            value={form.name}
            onChange={(v) => update('name', v)}
            placeholder="Researcher Bot"
            required
          />
          <Input
            label="Description"
            value={form.description ?? ''}
            onChange={(v) => update('description', v)}
            placeholder="What does this agent do?"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            label="Avatar URL"
            value={form.avatar ?? ''}
            onChange={(v) => update('avatar', v)}
            placeholder="https://… or leave empty"
          />
          <Select
            label="LLM Provider *"
            value={form.providerId}
            onChange={(v) => update('providerId', v)}
            placeholder="Select a provider"
            options={providers.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            label="Team"
            value={form.teamId ?? ''}
            onChange={(v) => update('teamId', v)}
            placeholder="(no team)"
            options={[
              { value: '', label: '— No team —' },
              ...teams.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            label="Role"
            value={form.role}
            onChange={(v) => update('role', v as AgentRole)}
            options={ROLE_OPTIONS}
          />
          <Select
            label="Team Membership (alias)"
            value={form.isLead ? 'lead' : form.role}
            onChange={(v) => {
              if (v === 'lead') {
                update('isLead', true);
                update('role', 'lead');
              } else {
                update('isLead', false);
                update('role', v as AgentRole);
              }
            }}
            options={[
              { value: 'lead', label: 'Lead' },
              { value: 'member', label: 'Member' },
              { value: 'observer', label: 'Observer' },
            ]}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => update('color', c)}
                className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  form.color === c ? 'border-slate-900 dark:border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
            <input
              type="color"
              value={form.color ?? '#6366f1'}
              onChange={(e) => update('color', e.target.value)}
              className="h-7 w-12 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Temperature: {Number(form.temperature ?? 0).toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={form.temperature ?? 0.7}
              onChange={(e) => update('temperature', Number(e.target.value))}
              className="w-full"
            />
          </div>
          <Input
            label="Max tokens"
            type="number"
            value={form.maxTokens ?? 4096}
            onChange={(v) => update('maxTokens', Number(v) || 4096)}
          />
        </div>

        <Textarea
          label="System Prompt *"
          value={form.systemPrompt}
          onChange={(v) => update('systemPrompt', v)}
          placeholder="You are a helpful agent that…"
          rows={5}
          required
        />

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Wand2 size={14} /> Enabled Skills ({form.enabledSkills.length})
          </label>
          {skills.length === 0 ? (
            <p className="text-xs text-slate-500">No skills available.</p>
          ) : (
            <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto rounded border border-slate-200 p-2 dark:border-slate-700">
              {skills.map((s) => {
                const enabled = !!form.enabledSkills.find((es) => es.name === s.name);
                return (
                  <label
                    key={s.name}
                    className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleSkill(s)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {s.displayName}
                        </span>
                        {s.dangerous && (
                          <span className="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            dangerous
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {s.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default AgentEditor;