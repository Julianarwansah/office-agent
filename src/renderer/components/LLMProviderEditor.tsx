import React, { useEffect, useMemo, useState } from 'react';
import { Save, RefreshCw, AlertCircle } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input, { Textarea } from './ui/Input';
import TestConnectionButton from './TestConnectionButton';
import { api, unwrap } from '../lib/api';
import type { LLMProvider } from '../../shared/types';
import type { LLMSettingsData } from '../lib/types';

export interface LLMProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
}

export interface LLMProviderEditorProps {
  provider?: LLMProvider | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: LLMSettingsData) => Promise<void> | void;
  presets: LLMProviderPreset[];
  onTest: (id: string) => Promise<{ ok: boolean; message: string; latencyMs?: number }>;
}

const EMPTY: LLMSettingsData = {
  name: '',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  systemPromptPrefix: '',
  isDefault: false,
};

const LLMProviderEditor: React.FC<LLMProviderEditorProps> = ({
  provider,
  open,
  onClose,
  onSave,
  presets,
  onTest,
}) => {
  const isEdit = !!provider?.id;

  const initial = useMemo<LLMSettingsData>(() => {
    if (!provider) return EMPTY;
    return {
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: provider.model,
      temperature: provider.temperature,
      maxTokens: provider.maxTokens,
      topP: provider.topP,
      systemPromptPrefix: provider.systemPromptPrefix,
      isDefault: provider.isDefault,
      headers: provider.headers,
    };
  }, [provider]);

  const [form, setForm] = useState<LLMSettingsData>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial);
    setError(null);
    setModels([]);
  }, [initial, open]);

  const update = <K extends keyof LLMSettingsData>(key: K, value: LLMSettingsData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  function applyPreset(p: LLMProviderPreset) {
    setForm((f) => ({
      ...f,
      baseUrl: p.baseUrl,
      model: p.model,
      name: f.name || p.name,
    }));
  }

  async function loadModels() {
    setLoadingModels(true);
    setModelsError(null);
    try {
      const list = unwrap(await api.llm.listModels({ baseUrl: form.baseUrl, apiKey: form.apiKey }));
      setModels(Array.isArray(list) ? list : []);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleInlineTest(): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    if (!form.baseUrl?.trim() || !form.model?.trim()) {
      return { ok: false, message: 'Base URL and model are required' };
    }
    if (isEdit) {
      return onTest(provider!.id);
    }
    const result = unwrap(
      await api.llm.test({
        provider: {
          name: form.name || 'Test',
          baseUrl: form.baseUrl,
          apiKey: form.apiKey || '',
          model: form.model,
        },
      }),
    );
    return {
      ok: !!(result as { success?: boolean }).success,
      message: (result as { message?: string }).message ?? 'Connection successful',
      latencyMs: (result as { latencyMs?: number }).latencyMs,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name?.trim()) {
      setError('Name is required.');
      return;
    }
    if (!form.baseUrl?.trim()) {
      setError('Base URL is required.');
      return;
    }
    if (!form.model?.trim()) {
      setError('Model is required.');
      return;
    }
    setSubmitting(true);
    try {
      const cleaned: LLMSettingsData = {
        ...form,
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        apiKey: form.apiKey?.trim() ? form.apiKey.trim() : undefined,
      };
      await onSave(cleaned);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit LLM Provider' : 'New LLM Provider'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <TestConnectionButton
            onTest={handleInlineTest}
            label={isEdit ? 'Test saved' : 'Test connection'}
            size="md"
            variant="secondary"
            inline={false}
            showLastResult={false}
            disabled={!form.baseUrl?.trim() || !form.model?.trim()}
          />
          <Button
            variant="primary"
            type="submit"
            form="llm-provider-form"
            loading={submitting}
            leftIcon={<Save size={14} />}
          >
            Save
          </Button>
        </>
      }
    >
      <form id="llm-provider-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {!isEdit && presets.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Quick start from preset
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Name *"
            value={form.name ?? ''}
            onChange={(v) => update('name', v)}
            placeholder="OpenAI"
            required
          />
          <Input
            label="Base URL *"
            value={form.baseUrl ?? ''}
            onChange={(v) => update('baseUrl', v)}
            placeholder="https://api.openai.com/v1"
            required
            hint={
              <span className="font-mono text-[10px] text-slate-400">
                {isEdit ? 'Use https://…/v1 style endpoint' : 'Works with OpenAI, Ollama, LM Studio, OpenRouter, Groq, Together…'}
              </span>
            }
          />
        </div>

        <Input
          label="API Key"
          type="password"
          value={form.apiKey ?? ''}
          onChange={(v) => update('apiKey', v)}
          placeholder={isEdit ? '•••••••• (leave empty to keep)' : 'sk-…'}
          hint="Stored encrypted via OS keychain (safeStorage)"
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Model *</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={form.model ?? ''}
              onChange={(e) => update('model', e.target.value)}
              required
              placeholder="gpt-4o-mini"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={loadModels}
              loading={loadingModels}
              leftIcon={<RefreshCw size={14} />}
            >
              Load models
            </Button>
          </div>
          {modelsError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{modelsError}</p>
          )}
          {models.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 p-2 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => update('model', m)}
                    className={`truncate rounded px-2 py-1 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${
                      form.model === m
                        ? 'bg-slate-100 text-slate-900 dark:bg-zinc-700 dark:text-slate-100'
                        : ''
                    }`}
                    title={m}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
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
              className="w-full accent-primary-600"
            />
          </div>
          <Input
            label="Max tokens"
            type="number"
            value={form.maxTokens ?? 4096}
            onChange={(v) => update('maxTokens', Number(v) || 4096)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Top P: {Number(form.topP ?? 1).toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.topP ?? 1}
              onChange={(e) => update('topP', Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>
        </div>

        <Textarea
          label="System Prompt Prefix (optional)"
          value={form.systemPromptPrefix ?? ''}
          onChange={(v) => update('systemPromptPrefix', v)}
          placeholder="Prepended to every conversation"
          rows={3}
        />

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={!!form.isDefault}
            onChange={(e) => update('isDefault', e.target.checked)}
            className="rounded accent-primary-600"
          />
          Set as default provider
        </label>
      </form>
    </Modal>
  );
};

export default LLMProviderEditor;
