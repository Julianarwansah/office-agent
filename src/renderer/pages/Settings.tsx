import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Star, TestTube2, Loader2, Check, X, RotateCw, Zap, Activity, Network } from 'lucide-react';
import { useLLMStore, type TestResult } from '../stores/llm';
import { useAppStore } from '../stores/app';
import { useAgentsStore } from '../stores/agents';
import { useWorkspaceStore } from '../stores/workspace';
import TestConnectionButton, { TestResultDisplay, TestConnectionStatus } from '../components/TestConnectionButton';
import LLMProviderEditor from '../components/LLMProviderEditor';
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
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [batchTesting, setBatchTesting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (presets.length === 0) void loadPresets();
  }, [presets.length, loadPresets]);

  const handleTest = async (id: string) => {
    setTestingId(id);
    const result = await testProvider(id);
    setTestResults((prev) => ({ ...prev, [id]: result }));
    setTestingId(null);
    return result;
  };

  const handleTestAll = async () => {
    if (providers.length === 0) return;
    setBatchTesting(true);
    setBatchProgress({ done: 0, total: providers.length });
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i];
      setBatchProgress({ done: i, total: providers.length });
      setTestingId(p.id);
      const result = await testProvider(p.id);
      setTestResults((prev) => ({ ...prev, [p.id]: result }));
    }
    setBatchProgress({ done: providers.length, total: providers.length });
    setTestingId(null);
    setBatchTesting(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this provider? Agents using it will need to be reconfigured.')) return;
    await deleteProvider(id);
  };

  const successCount = Object.values(testResults).filter((r) => r.ok).length;
  const failureCount = Object.values(testResults).filter((r) => !r.ok).length;
  const testedCount = successCount + failureCount;
  const allHealthy = providers.length > 0 && testedCount === providers.length && failureCount === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">LLM Providers</h2>
          {providers.length > 0 && (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
              {testedCount > 0 && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                    allHealthy
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : failureCount > 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {allHealthy ? <Check size={10} /> : <X size={10} />}
                  {successCount}/{providers.length} healthy
                </span>
              )}
              {batchTesting && (
                <span className="text-slate-500">
                  Testing {batchProgress.done + 1}/{batchProgress.total}...
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {providers.length > 0 && (
            <button
              onClick={handleTestAll}
              disabled={batchTesting}
              className="btn-secondary"
            >
              {batchTesting ? <Loader2 size={14} className="animate-spin" /> : <Network size={14} />}
              Test all
            </button>
          )}
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
            <Plus size={14} />
            Add Provider
          </button>
        </div>
      </div>

      {loading && (
        <div className="card p-8 text-center">
          <Loader2 className="mx-auto mb-2 animate-spin text-slate-400" size={20} />
          <p className="text-sm text-slate-500">Loading providers...</p>
        </div>
      )}

      {!loading && providers.length === 0 && (
        <div className="card relative overflow-hidden p-12 text-center">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-primary-400/20 to-purple-400/20 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-primary-500/30">
              <Network size={36} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No LLM providers yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Connect an OpenAI-compatible endpoint (OpenAI, Ollama, LM Studio, OpenRouter, Groq, Together...) to start chatting with your agents.
            </p>
            <button
              className="btn-primary mt-5"
              onClick={() =>
                setEditing({
                  name: '',
                  baseUrl: 'https://api.openai.com/v1',
                  model: 'gpt-4o-mini',
                })
              }
            >
              <Plus size={16} /> Add your first provider
            </button>
          </div>
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
            testResult={testResults[p.id]}
            onClearResult={() => setTestResults((prev) => { const n = { ...prev }; delete n[p.id]; return n; })}
          />
        ))}
      </div>

      {editing && (
        <LLMProviderEditor
          provider={providers.find((p) => p.id === editing.id) ?? null}
          open={!!editing}
          presets={presets}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            if (editing.id) {
              await updateProvider(editing.id, data);
            } else {
              await createProvider(data);
            }
            setEditing(null);
          }}
          onTest={async (id) => {
            const r = await testProvider(id);
            return { ok: r.ok, message: r.message, latencyMs: r.latencyMs };
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
  testResult?: TestResult;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onTest: () => Promise<{ ok: boolean; message: string; latencyMs?: number }>;
  onClearResult?: () => void;
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
  onClearResult,
}) => {
  const isHealthy = testResult?.ok === true;
  const isFailing = testResult?.ok === false;

  return (
    <div
      className={cn(
        'card relative overflow-hidden p-4 transition-all',
        isHealthy && 'ring-1 ring-emerald-200 dark:ring-emerald-800/60',
        isFailing && 'ring-1 ring-red-200 dark:ring-red-800/60',
      )}
    >
      {isHealthy && (
        <div className="absolute right-0 top-0 h-1 w-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
      )}
      {isFailing && (
        <div className="absolute right-0 top-0 h-1 w-full bg-gradient-to-r from-red-400 to-red-500" />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm',
                isHealthy
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                  : isFailing
                    ? 'bg-gradient-to-br from-red-500 to-red-600'
                    : 'bg-gradient-to-br from-primary-500 to-primary-600',
              )}
            >
              <Network size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate font-medium text-slate-900 dark:text-slate-100">{provider.name}</h3>
                {isDefault && (
                  <span className="badge-warning !text-[10px]">
                    <Star size={9} /> Default
                  </span>
                )}
                {isHealthy && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Check size={9} /> Online
                  </span>
                )}
                {isFailing && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    <X size={9} /> Error
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{provider.baseUrl}</p>
              <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-400">
                Model: <span className="font-mono">{provider.model}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {testResult && (
        <div className="mt-3">
          <TestResultDisplay
            result={testResult}
            compact
            onClear={onClearResult}
            onRetry={onTest}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button onClick={onEdit} className="btn-secondary !text-xs !py-1.5">
          Edit
        </button>
        <TestConnectionButton
          onTest={onTest}
          size="sm"
          variant="secondary"
          inline={false}
          showLastResult={false}
          disabled={testing}
          label="Test"
        />
        {!isDefault && (
          <button onClick={onSetDefault} className="btn-secondary !text-xs !py-1.5">
            <Star size={11} />
            Set default
          </button>
        )}
        <button onClick={onDelete} className="btn-ghost !text-xs !py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto">
          <Trash2 size={11} />
          Delete
        </button>
      </div>
    </div>
  );
};

const WorkspaceTab: React.FC = () => {
  const { workspaces, loadWorkspaces, setCurrentWorkspace, loading } = useWorkspaceStore();
  return (
    <div className="card p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Workspaces</h2>
      <p className="mb-4 text-sm text-slate-500">
        Manage your project workspaces. Files inside a workspace can be browsed and read by agents.
      </p>
      {loading && <p className="text-sm text-slate-500">Loading...</p>}
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
            <label className="mb-1 block text-sm font-medium">Importance threshold (0-1)</label>
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
