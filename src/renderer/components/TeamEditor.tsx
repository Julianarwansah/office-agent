import React, { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input, { Textarea } from './ui/Input';
import type { Team } from '../../shared/types';
import type { TeamFormData } from '../lib/types';

export interface TeamEditorProps {
  team?: Team | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: TeamFormData) => Promise<void> | void;
}

const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#a855f7',
];

const EMPTY: TeamFormData = {
  name: '',
  description: '',
  instructions: '',
  color: '#6366f1',
  avatar: '',
};

const TeamEditor: React.FC<TeamEditorProps> = ({ team, open, onClose, onSave }) => {
  const initial = useMemo<TeamFormData>(() => {
    if (!team) return EMPTY;
    return {
      id: team.id,
      name: team.name,
      description: team.description ?? '',
      instructions: team.instructions ?? '',
      color: team.color ?? '#6366f1',
      avatar: team.avatar ?? '',
    };
  }, [team]);

  const [form, setForm] = useState<TeamFormData>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial);
    setError(null);
  }, [initial, open]);

  const update = <K extends keyof TeamFormData>(key: K, value: TeamFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        description: form.description?.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={team ? 'Edit Team' : 'New Team'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="team-editor-form"
            loading={submitting}
            leftIcon={<Save size={14} />}
          >
            Save
          </Button>
        </>
      }
    >
      <form id="team-editor-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
        <Input
          label="Name *"
          value={form.name}
          onChange={(v) => update('name', v)}
          placeholder="Engineering Team"
          required
        />
        <Input
          label="Description"
          value={form.description ?? ''}
          onChange={(v) => update('description', v)}
          placeholder="A short summary of the team"
        />
        <Textarea
          label="Instructions"
          value={form.instructions ?? ''}
          onChange={(v) => update('instructions', v)}
          placeholder="Shared guidance applied to every chat in this team…"
          rows={4}
        />
        <Input
          label="Avatar URL"
          value={form.avatar ?? ''}
          onChange={(v) => update('avatar', v)}
          placeholder="https://… or leave empty"
        />
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
      </form>
    </Modal>
  );
};

export default TeamEditor;