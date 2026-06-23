import React, { useEffect, useMemo, useState } from 'react';
import { Save, Play, Loader2, Plus, Trash2, Wand2, Code2, AlertTriangle, Terminal } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input, { Textarea, Select } from './ui/Input';
import type { SkillParameter, ParameterType } from '../../shared/skills-schema';
import { cn } from '../lib/utils';
import type { SkillTestResult, UserSkillDraft, UserSkillRecord } from '../stores/skills';

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'productivity', label: 'Productivity' },
  { value: 'data', label: 'Data' },
  { value: 'file', label: 'File' },
  { value: 'memory', label: 'Memory' },
  { value: 'network', label: 'Network' },
  { value: 'system', label: 'System' },
  { value: 'web', label: 'Web' },
];

const TYPE_OPTIONS: { value: ParameterType; label: string }[] = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'boolean' },
  { value: 'array', label: 'array' },
  { value: 'object', label: 'object' },
];

const STARTER_TEMPLATE = `// Available inside this sandbox:
//   args    — validated object matching the parameters declared above
//   ctx     — { agent, chatRoomId, messageId, workingDirectory }
//   console — log/info/warn/error/debug
//   fetch(url, init?) — respects ctx.signal
//   sleep(ms), AbortSignal, JSON, Math, Date, Map, Set, etc.
// Return a SkillResult: { success, output, error?, data?, metadata? }
//
// Example: a simple "echo" skill
const out = JSON.stringify(args, null, 2);
return { success: true, output: out };
`;

const EMPTY: UserSkillDraft = {
  name: '',
  displayName: '',
  description: '',
  category: 'productivity',
  version: '1.0.0',
  author: '',
  parameters: [],
  requiresApproval: false,
  dangerous: false,
  implementation: STARTER_TEMPLATE,
  enabled: true,
};

export interface SkillEditorProps {
  open: boolean;
  skill: UserSkillRecord | null;
  onClose: () => void;
  onSave: (draft: UserSkillDraft) => Promise<void>;
  onTest: (
    args: { name?: string; manifest?: Partial<UserSkillDraft>; implementation?: string; testArgs: Record<string, unknown> },
  ) => Promise<SkillTestResult>;
  isSaving: boolean;
}

const SkillEditor: React.FC<SkillEditorProps> = ({
  open,
  skill,
  onClose,
  onSave,
  onTest,
  isSaving,
}) => {
  const [form, setForm] = useState<UserSkillDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [testArgsRaw, setTestArgsRaw] = useState<string>('{\n  \n}');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<SkillTestResult | null>(null);

  useEffect(() => {
    if (!open) return;
    if (skill) {
      setForm({
        name: skill.name,
        displayName: skill.displayName,
        description: skill.description ?? '',
        category: skill.category,
        version: skill.version ?? '1.0.0',
        author: skill.author ?? '',
        parameters: skill.parameters ?? [],
        requiresApproval: skill.requiresApproval === true,
        dangerous: skill.dangerous === true,
        implementation: skill.implementation || STARTER_TEMPLATE,
        enabled: skill.enabled !== false,
      });
    } else {
      setForm(EMPTY);
    }
    setError(null);
    setTestResult(null);
    setTestArgsRaw('{\n  \n}');
  }, [open, skill]);

  const update = <K extends keyof UserSkillDraft>(key: K, value: UserSkillDraft[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const updateParam = (idx: number, patch: Partial<SkillParameter>) => {
    setForm((f) => {
      const next = [...f.parameters];
      next[idx] = { ...next[idx], ...patch };
      return { ...f, parameters: next };
    });
  };

  const addParam = () => {
    setForm((f) => ({
      ...f,
      parameters: [
        ...f.parameters,
        { name: '', type: 'string', description: '', required: false },
      ],
    }));
  };

  const removeParam = (idx: number) => {
    setForm((f) => ({
      ...f,
      parameters: f.parameters.filter((_, i) => i !== idx),
    }));
  };

  const paramNames = useMemo(() => form.parameters.map((p) => p.name).filter(Boolean), [form.parameters]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^[a-z][a-z0-9_]{0,63}$/.test(form.name)) {
      setError('Name must be lowercase, start with a letter, and use only letters, digits, and underscores (max 64).');
      return;
    }
    if (!form.displayName.trim()) {
      setError('Display name is required.');
      return;
    }
    const seen = new Set<string>();
    for (const p of form.parameters) {
      if (!p.name.trim()) {
        setError('Each parameter needs a name.');
        return;
      }
      if (seen.has(p.name)) {
        setError(`Duplicate parameter name: "${p.name}".`);
        return;
      }
      seen.add(p.name);
    }
    if (!form.implementation.trim()) {
      setError('Implementation is required.');
      return;
    }
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save skill.');
    }
  }

  async function handleTest() {
    setTestRunning(true);
    setTestResult(null);
    setError(null);
    let parsedArgs: Record<string, unknown> = {};
    if (testArgsRaw.trim()) {
      try {
        parsedArgs = JSON.parse(testArgsRaw);
      } catch (e) {
        setError(`Test args are not valid JSON: ${(e as Error).message}`);
        setTestRunning(false);
        return;
      }
    }
    try {
      const res = await onTest({
        name: skill?.name,
        manifest: {
          name: form.name,
          displayName: form.displayName,
          description: form.description,
          category: form.category,
          version: form.version,
          author: form.author || undefined,
          parameters: form.parameters,
          requiresApproval: form.requiresApproval,
          dangerous: form.dangerous,
        },
        implementation: form.implementation,
        testArgs: parsedArgs,
      });
      setTestResult(res);
    } finally {
      setTestRunning(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={skill ? 'Edit Skill' : 'New Skill'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving || testRunning}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            loading={testRunning}
            disabled={isSaving}
            leftIcon={<Play size={14} />}
          >
            Test
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="skill-editor-form"
            loading={isSaving}
            disabled={testRunning}
            leftIcon={<Save size={14} />}
          >
            Save
          </Button>
        </>
      }
    >
      <form id="skill-editor-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Name *"
            value={form.name}
            onChange={(v) => update('name', v.toLowerCase())}
            placeholder="my_custom_skill"
            disabled={!!skill}
            hint="Lowercase letters, digits, and underscores. Must be unique."
            required
          />
          <Input
            label="Display name *"
            value={form.displayName}
            onChange={(v) => update('displayName', v)}
            placeholder="My Custom Skill"
            required
          />
        </div>

        <Textarea
          label="Description"
          value={form.description}
          onChange={(v) => update('description', v)}
          rows={3}
          placeholder="What does this skill do? When should the agent use it?"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select
            label="Category"
            value={form.category}
            onChange={(v) => update('category', v)}
            options={CATEGORY_OPTIONS}
          />
          <Input
            label="Version"
            value={form.version}
            onChange={(v) => update('version', v)}
            placeholder="1.0.0"
          />
          <Input
            label="Author"
            value={form.author}
            onChange={(v) => update('author', v)}
            placeholder="you@example.com"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <input
              type="checkbox"
              checked={form.requiresApproval}
              onChange={(e) => update('requiresApproval', e.target.checked)}
            />
            Requires approval
          </label>
          <label className={cn(
            'flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700',
            form.dangerous && 'border-red-300 dark:border-red-700',
          )}>
            <input
              type="checkbox"
              checked={form.dangerous}
              onChange={(e) => update('dangerous', e.target.checked)}
            />
            <span className="flex items-center gap-1">
              <AlertTriangle size={12} className={form.dangerous ? 'text-red-500' : 'text-slate-400'} />
              Dangerous
            </span>
          </label>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
            />
            Enabled
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Wand2 size={14} /> Parameters ({form.parameters.length})
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Plus size={12} />}
              onClick={addParam}
            >
              Add parameter
            </Button>
          </div>
          {form.parameters.length === 0 ? (
            <p className="rounded border border-dashed border-slate-200 px-3 py-2 text-center text-xs text-slate-500 dark:border-slate-700">
              No parameters. The skill will be called with an empty args object.
            </p>
          ) : (
            <div className="space-y-2">
              {form.parameters.map((p, idx) => (
                <div
                  key={`${p.name}-${idx}`}
                  className="grid grid-cols-12 items-center gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-700"
                >
                  <div className="col-span-3">
                    <Input
                      value={p.name}
                      onChange={(v) => updateParam(idx, { name: v.replace(/[^a-zA-Z0-9_]/g, '') })}
                      placeholder="param_name"
                    />
                  </div>
                  <div className="col-span-2">
                    <Select
                      value={p.type}
                      onChange={(v) => updateParam(idx, { type: v as ParameterType })}
                      options={TYPE_OPTIONS}
                    />
                  </div>
                  <div className="col-span-5">
                    <Input
                      value={p.description}
                      onChange={(v) => updateParam(idx, { description: v })}
                      placeholder="What does this parameter do?"
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={p.required}
                        onChange={(e) => updateParam(idx, { required: e.target.checked })}
                      />
                      req
                    </label>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeParam(idx)}
                      className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Remove parameter"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {paramNames.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Parameters will be passed as <code>args</code> in your script.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Code2 size={14} /> Implementation (JavaScript) *
          </label>
          <textarea
            value={form.implementation}
            onChange={(e) => update('implementation', e.target.value)}
            spellCheck={false}
            rows={12}
            className="w-full rounded-md border border-slate-200 bg-zinc-950 px-3 py-2 font-mono text-xs leading-relaxed text-slate-100 shadow-inner focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-zinc-700"
            placeholder="// return { success: true, output: '…' }"
          />
          <p className="mt-1 text-xs text-slate-500">
            Runs in a sandboxed Node <code>vm</code> context. Available:{' '}
            <code>args</code>, <code>ctx</code>, <code>fetch</code>, <code>sleep</code>, <code>JSON</code>,{' '}
            <code>Math</code>, <code>Date</code>, <code>AbortSignal</code>, <code>console</code>. <code>require</code>,{' '}
            <code>process</code>, and <code>fs</code> are not available.
          </p>
        </div>

        <details className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
            <span className="inline-flex items-center gap-1">
              <Terminal size={12} /> Test arguments (JSON)
            </span>
          </summary>
          <div className="mt-2">
            <textarea
              value={testArgsRaw}
              onChange={(e) => setTestArgsRaw(e.target.value)}
              spellCheck={false}
              rows={4}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              placeholder='{ "expression": "2 + 2" }'
            />
            <p className="mt-1 text-xs text-slate-500">
              These are passed to the script as <code>args</code> when you click <em>Test</em>.
            </p>
          </div>
        </details>

        {testResult && (
          <div
            className={cn(
              'rounded-md border p-3 text-sm',
              testResult.success
                ? 'border-slate-300 bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800/50'
                : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20',
            )}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">
                {testResult.success ? 'Test succeeded' : 'Test failed'} ({testResult.durationMs}ms)
              </span>
            </div>
            {testResult.error && (
              <p className="mb-2 text-xs">{testResult.error}</p>
            )}
            {testResult.output && (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-950/80 p-2 font-mono text-xs text-slate-100">
                {testResult.output}
              </pre>
            )}
          </div>
        )}

        {testRunning && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Running test…
          </div>
        )}
      </form>
    </Modal>
  );
};

export default SkillEditor;
