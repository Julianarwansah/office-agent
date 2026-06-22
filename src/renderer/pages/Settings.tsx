import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Star, TestTube2, Loader2, Check, X } from 'lucide-react';
import { useLLMStore } from '../stores/llm';
import { useAppStore } from '../stores/app';
import { useAgentsStore } from '../stores/agents';
import { cn } from '../lib/utils';
import type { AppSettings, LLMProvider } from '../../shared/types';
import type { LLMSettingsData } from '../lib/types';

type Tab = 'general' | 'llm' | 'workspace' | 'advanced';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'llm', label: 'LLM Providers' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'advanced', label: 'Advanced' },
];

const SettingsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('general');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Configure your Office AI Agent.</p>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'border-primary-600 text-primary-700 dark:text-primary-300'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'general' && <GeneralTab />}
      {tab === 'llm' && <LLMTab />}
      {tab === 'workspace' && <WorkspaceTab />}
      {tab === 'advanced' && <AdvancedTab />}
    </div>
  );
};

const GeneralTab: React.FC = () => {
  const { appSettings, saveSettings, localhostUrl } = useAppStore();
  const [draft, setDraft] = useState<Partial<AppSettings>>(appSettings ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (appSettings) setDraft(appSettings);
  }, [appSettings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(appSettings ?? {});

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">General</h2>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Theme</label>
          <select
            className="input max-w-xs"
            value={draft.theme ?? 'system'}
            onChange={(e) => setDraft((d) => ({ ...d, theme: e.target.value as AppSettings['theme'] }))}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Localhost port
          </label>
          <input
            type="number"
            className="input max-w-xs"
            value={draft.localhostPort ?? 4317}
            onChange={(e) =>
              setDraft((d) => ({ ...d, localhostPort: Number(e.target.value) || 4317 }))
            }
          />
          {localhostUrl && (
            <p className="mt-1 text-xs text-slate-500">Currently: {localhostUrl}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Working directory
          </label>
          <input
            type="text"
            className="input"
            value={draft.workingDirectory ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, workingDirectory: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="btn-primary"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const LLMTab: React.FC = () => {
  const {
    providers,
    defaultProvider,
    presets,
    loading,
    testProvider,
    createProvider,
    updateProvider,
    deleteProvider,
    setDefault,
    loadPresets,
  } = useLLMStore();
  const [editing, setEditing] = useState<LLMSettingsData | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  useEffect(() => {
    if (presets.length === 0) void loadPresets();
  }, [presets.length, loadPresets]);

  const handleTest = async (id: string) => {
    setTestingId(id);
    const result = await testProvider(id);
    setTestResult((prev) => ({ ...prev, [id]: result }));
    setTestingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this provider? Agents using it will need to be reconfigured.')) return;
    await deleteProvider(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">LLM Providers</h2>
        <button
          className="btn-primary"
          onClick={() =>
            setEditing({
              name: '',
              baseUrl: 'https://api.openai.com/v1',
              model: 'gpt-4o-mini',
              temperature: 0.7,
              maxTokens: 4096,
              topP: 1,
            })
          }
        >
          <Plus size={16} />
          Add provider
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading providers…</p>}

      {!loading && providers.length === 0 && (
        <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
          <p className="text-sm text-slate-500">No providers configured yet.</p>
          <button
            className="btn-primary"
            onClick={() =>
              setEditing({
                name: '',
                baseUrl: 'https://api.openai.com/v1',
                model: 'gpt-4o-mini',
              })
            }
          >
            <Plus size={16} />
            Add your first provider
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            isDefault={defaultProvider?.id === p.id}
            onEdit={() => setEditing(providerToForm(p))}
            onDelete={() => handleDelete(p.id)}
            onSetDefault={() => setDefault(p.id)}
            onTest={() => handleTest(p.id)}
            testing={testingId === p.id}
            testResult={testResult[p.id]}
          />
        ))}
      </div>

      {editing && (
        <ProviderEditor
          draft={editing}
          presets={presets}
          isEdit={providers.some((p) => p.id === editing.id)}
          onCancel={() => setEditing(null)}
          onSubmit={async (data) => {
            if (data.id) {
              await updateProvider(data.id, data);
            } else {
              await createProvider(data);
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

function providerToForm(p: LLMProvider): LLMSettingsData {
  return {
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    model: p.model,
    temperature: p.temperature,
    maxTokens: p.maxTokens,
    topP: p.topP,
    systemPromptPrefix: p.systemPromptPrefix,
    isDefault: p.isDefault,
    headers: p.headers,
  };
}

interface ProviderCardProps {
  provider: LLMProvider;
  isDefault: boolean;
  testing: boolean;
  testResult?: { ok: boolean; message: string };
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onTest: () => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  isDefault,
  testing,
  testResult,
  onEdit,
  onDelete,
  onSetDefault,
  onTest,
}) => {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium text-slate-900 dark:text-slate-100">{provider.name}</h3>
            {isDefault && (
              <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Default
              </span>
            )}
          </div>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">{provider.baseUrl}</p>
          <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-400">
            Model: <span className="font-mono">{provider.model}</span>
          </p>
        </div>
      </div>

      {testResult && (
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded p-2 text-xs',
            testResult.ok
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
          )}
        >
          {testResult.ok ? <Check size={14} /> : <X size={14} />}
          <span className="truncate">{testResult.message}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onEdit} className="btn-secondary text-xs">
          Edit
        </button>
        <button
          onClick={onTest}
          disabled={testing}
          className="btn-secondary text-xs"
        >
          {testing ? <Loader2 size={12} className="animate-spin" /> : <TestTube2 size={12} />}
          Test
        </button>
        {!isDefault && (
          <button onClick={onSetDefault} className="btn-secondary text-xs">
            <Star size={12} />
            Set default
          </button>
        )}
        <button onClick={onDelete} className="btn-ghost text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  );
};

interface ProviderEditorProps {
  draft: LLMSettingsData;
  presets: Array<{ id: string; name: string; baseUrl: string; model: string }>;
  isEdit: boolean;
  onCancel: () => void;
  onSubmit: (data: LLMSettingsData) => Promise<void>;
}

const ProviderEditor: React.FC<ProviderEditorProps> = ({ draft, presets, isEdit, onCancel, onSubmit }) => {
  const [form, setForm] = useState<LLMSettingsData>(draft);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setForm(draft), [draft]);

  const handlePreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setForm((f) => ({
      ...f,
      baseUrl: preset.baseUrl,
      model: preset.model,
      name: f.name || preset.name,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="card w-full max-w-xl space-y-4 p-6"
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {isEdit ? 'Edit' : 'New'} LLM provider
        </h3>

        {presets.length > 0 && !isEdit && (
          <div>
            <label className="mb-1 block text-sm font-medium">Start from preset</label>
            <select className="input" defaultValue="" onChange={(e) => handlePreset(e.target.value)}>
              <option value="">— Select preset —</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              className="input"
              required
              value={form.name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Model</label>
            <input
              className="input"
              required
              value={form.model ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Base URL</label>
          <input
            className="input font-mono text-xs"
            required
            value={form.baseUrl ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">API key</label>
          <input
            type="password"
            className="input font-mono text-xs"
            placeholder={isEdit ? '•••••••• (leave empty to keep)' : ''}
            value={form.apiKey ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Temperature</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="2"
              className="input"
              value={form.temperature ?? 0.7}
              onChange={(e) => setForm((f) => ({ ...f, temperature: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Max tokens</label>
            <input
              type="number"
              className="input"
              value={form.maxTokens ?? 4096}
              onChange={(e) => setForm((f) => ({ ...f, maxTokens: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Top P</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              className="input"
              value={form.topP ?? 1}
              onChange={(e) => setForm((f) => ({ ...f, topP: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">System prompt prefix (optional)</label>
          <textarea
            className="input min-h-[60px] resize-y"
            value={form.systemPromptPrefix ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, systemPromptPrefix: e.target.value }))}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!form.isDefault}
            onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
          />
          Use as default provider
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

const WorkspaceTab: React.FC = () => {
  const { workspaces, loadWorkspaces, setCurrentWorkspace, loading } = useAgentsStore();
  // workspaces is also managed via workspace store; but we re-use useAgentsStore indirectly.
  // Use the workspace store instead for the actual list:
  void loadWorkspaces;
  void setCurrentWorkspace;
  return (
    <div className="card p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Workspaces</h2>
      <p className="mb-4 text-sm text-slate-500">
        Manage your project workspaces. Files inside a workspace can be browsed and read by agents.
      </p>
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && workspaces.length === 0 && (
        <p className="text-sm text-slate-500">No workspaces configured. Visit the Workspace page to add one.</p>
      )}
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {workspaces.map((w) => (
          <li key={w.id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{w.name}</p>
              <p className="font-mono text-xs text-slate-500">{w.path}</p>
            </div>
            {w.isDefault && (
              <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                Default
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const AdvancedTab: React.FC = () => {
  const { appSettings, saveSettings } = useAppStore();
  const [draft, setDraft] = useState<Partial<AppSettings>>(appSettings ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appSettings) setDraft(appSettings);
  }, [appSettings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(appSettings ?? {});

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Memory</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Max memory items</label>
            <input
              type="number"
              className="input"
              value={draft.maxMemoryItems ?? 200}
              onChange={(e) => setDraft((d) => ({ ...d, maxMemoryItems: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Importance threshold (0–1)</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              className="input"
              value={draft.memoryImportanceThreshold ?? 0.3}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  memoryImportanceThreshold: Number(e.target.value),
                }))
              }
            />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.autoCreateMemories ?? false}
            onChange={(e) => setDraft((d) => ({ ...d, autoCreateMemories: e.target.checked }))}
          />
          Auto-extract memories from conversations
        </label>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Terminal</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Default shell</label>
          <input
            type="text"
            className="input max-w-md font-mono text-xs"
            value={draft.terminalShell ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, terminalShell: e.target.value }))}
          />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Behavior</h2>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.streamResponses ?? true}
              onChange={(e) => setDraft((d) => ({ ...d, streamResponses: e.target.checked }))}
            />
            Stream assistant responses
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.saveHistory ?? true}
              onChange={(e) => setDraft((d) => ({ ...d, saveHistory: e.target.checked }))}
            />
            Persist conversation history
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={!dirty || saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save advanced settings
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;