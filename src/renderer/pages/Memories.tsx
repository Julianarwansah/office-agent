import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Plus, RefreshCw, Sparkles, Brain } from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import { useMemoriesStore } from '../stores/memories';
import Button from '../components/ui/Button';
import Input, { Textarea, Select } from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import MemoryCard from '../components/MemoryCard';
import { useSkillsStore } from '../stores/skills';
import { useAppStore } from '../stores/app';
import { cn } from '../lib/utils';
import type { Memory, MemoryCategory, MemoryType } from '@shared/types';

const CATEGORY_OPTIONS: { value: MemoryCategory; label: string }[] = [
  { value: 'user_preference', label: 'User Preference' },
  { value: 'fact', label: 'Fact' },
  { value: 'instruction', label: 'Instruction' },
  { value: 'context', label: 'Context' },
  { value: 'task', label: 'Task' },
];

const TYPE_OPTIONS: { value: MemoryType; label: string }[] = [
  { value: 'long_term', label: 'Long Term' },
  { value: 'semantic', label: 'Semantic' },
  { value: 'episodic', label: 'Episodic' },
  { value: 'short_term', label: 'Short Term' },
];

const MemoriesPage: React.FC = () => {
  const agents = useAgentsStore((s) => s.agents);
  const loadAgents = useAgentsStore((s) => s.loadAgents);
  const loadTeams = useAgentsStore((s) => s.loadTeams);
  const teams = useAgentsStore((s) => s.teams);

  const memoriesByAgent = useMemoriesStore((s) => s.memoriesByAgent);
  const searchResults = useMemoriesStore((s) => s.searchResults);
  const loading = useMemoriesStore((s) => s.loading);
  const searching = useMemoriesStore((s) => s.searching);
  const consolidating = useMemoriesStore((s) => s.consolidating);
  const error = useMemoriesStore((s) => s.error);
  const loadMemories = useMemoriesStore((s) => s.loadMemories);
  const createMemory = useMemoriesStore((s) => s.createMemory);
  const updateMemory = useMemoriesStore((s) => s.updateMemory);
  const deleteMemory = useMemoriesStore((s) => s.deleteMemory);
  const pinMemory = useMemoriesStore((s) => s.pinMemory);
  const unpinMemory = useMemoriesStore((s) => s.unpinMemory);
  const searchMemories = useMemoriesStore((s) => s.searchMemories);
  const consolidateMemories = useMemoriesStore((s) => s.consolidateMemories);

  const loadSkills = useSkillsStore((s) => s.loadSkills);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Memory | null>(null);

  // form state
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<MemoryCategory>('fact');
  const [formType, setFormType] = useState<MemoryType>('long_term');
  const [formImportance, setFormImportance] = useState(0.5);
  const [formPinned, setFormPinned] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage('Memories');
  }, [setCurrentPage]);

  useEffect(() => {
    void loadAgents();
    void loadTeams();
    void loadSkills();
  }, [loadAgents, loadTeams, loadSkills]);

  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (selectedAgentId) {
      void loadMemories(selectedAgentId);
    }
  }, [selectedAgentId, loadMemories]);

  const currentMemories = useMemo(() => {
    if (!selectedAgentId) return [];
    return searchQuery
      ? searchResults[selectedAgentId] ?? []
      : memoriesByAgent[selectedAgentId] ?? [];
  }, [selectedAgentId, searchQuery, searchResults, memoriesByAgent]);

  const teamName = useMemo(() => {
    const agent = agents.find((a) => a.id === selectedAgentId);
    if (!agent?.teamId) return null;
    return teams.find((t) => t.id === agent.teamId)?.name ?? null;
  }, [agents, teams, selectedAgentId]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!selectedAgentId) return;
    if (q.trim().length === 0) return;
    try {
      await searchMemories(selectedAgentId, q);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConsolidate = async () => {
    if (!selectedAgentId) return;
    try {
      const agent = agents.find((a) => a.id === selectedAgentId);
      if (!agent) return;
      const teamChatroomId = (agent as { teamId?: string }).teamId ?? '';
      if (!teamChatroomId) {
        alert('Pilih agent yang punya team / chatroom untuk konsolidasi.');
        return;
      }
      await consolidateMemories(selectedAgentId, teamChatroomId);
    } catch (err) {
      console.error(err);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormContent('');
    setFormCategory('fact');
    setFormType('long_term');
    setFormImportance(0.5);
    setFormPinned(false);
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (mem: Memory) => {
    setEditing(mem);
    setFormContent(mem.content);
    setFormCategory((mem.category as MemoryCategory) ?? 'fact');
    setFormType((mem.type as MemoryType) ?? 'long_term');
    setFormImportance(mem.importance ?? 0.5);
    setFormPinned(Boolean(mem.isPinned));
    setFormError(null);
    setCreateOpen(true);
  };

  const closeForm = () => {
    setCreateOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const handleSubmitForm = async () => {
    if (!formContent.trim()) {
      setFormError('Content wajib diisi');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await updateMemory(editing.id, {
          content: formContent.trim(),
          category: formCategory,
          type: formType,
          importance: formImportance,
          isPinned: formPinned,
        });
      } else {
        if (!selectedAgentId) {
          setFormError('Pilih agent dulu');
          setFormBusy(false);
          return;
        }
        await createMemory({
          agentId: selectedAgentId,
          content: formContent.trim(),
          category: formCategory,
          type: formType,
          importance: formImportance,
          isPinned: formPinned,
        });
      }
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (mem: Memory) => {
    if (!window.confirm(`Hapus memory ini?\n\n"${mem.content.slice(0, 80)}..."`)) return;
    try {
      await deleteMemory(mem.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePin = async (mem: Memory) => {
    try {
      if (mem.isPinned) {
        await unpinMemory(mem.id);
      } else {
        await pinMemory(mem.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Brain className="w-6 h-6" />
            Agent Memory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Long-term memory persists across sessions. Agents retrieve relevant memories automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => selectedAgentId && loadMemories(selectedAgentId)}>
            Refresh
          </Button>
          <Button variant="secondary" leftIcon={<Sparkles className="w-4 h-4" />} loading={consolidating} onClick={handleConsolidate} disabled={!selectedAgentId}>
            Consolidate
          </Button>
          <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate} disabled={!selectedAgentId}>
            Add Memory
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select
          label="Agent"
          value={selectedAgentId}
          onChange={setSelectedAgentId}
          options={[{ value: '', label: '— Select agent —' }, ...agents.map((a) => ({ value: a.id, label: a.name }))]}
          className="min-w-[260px]"
        />
        {teamName && (
          <span className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            Team: {teamName}
          </span>
        )}
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search memories…"
            value={searchQuery}
            onChange={(v) => {
              setSearchQuery(v);
              void handleSearch(v);
            }}
          />
        </div>
        {searching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1">
        {!selectedAgentId ? (
          <EmptyState
            title="No agent selected"
            description="Select an agent above to view and manage their memories."
          />
        ) : loading && currentMemories.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading memories…
          </div>
        ) : currentMemories.length === 0 ? (
          <EmptyState
            title="No memories yet"
            description="Add a memory manually or chat with the agent — memories are extracted automatically."
          />
        ) : (
          <div className="grid gap-3">
            {currentMemories.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                onEdit={() => openEdit(m)}
                onDelete={() => handleDelete(m)}
                onTogglePin={() => handleTogglePin(m)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={closeForm}
        title={editing ? 'Edit Memory' : 'Add Memory'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeForm} disabled={formBusy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmitForm} loading={formBusy}>
              {editing ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Textarea
            label="Content"
            rows={5}
            value={formContent}
            onChange={setFormContent}
            placeholder="e.g. User prefers dark mode and TypeScript over JavaScript."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={formCategory}
              onChange={(v) => setFormCategory(v as MemoryCategory)}
              options={CATEGORY_OPTIONS}
            />
            <Select
              label="Type"
              value={formType}
              onChange={(v) => setFormType(v as MemoryType)}
              options={TYPE_OPTIONS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Importance: <span className="font-mono">{formImportance.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={formImportance}
              onChange={(e) => setFormImportance(parseFloat(e.target.value))}
              className="w-full accent-primary-600"
            />
            <div className="h-1.5 mt-2 rounded bg-gradient-to-r from-slate-300 via-blue-400 to-green-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={formPinned}
              onChange={(e) => setFormPinned(e.target.checked)}
              className="rounded accent-primary-600"
            />
            Pin this memory (always retrieved)
          </label>
          {formError && (
            <div className="text-sm text-red-600 dark:text-red-400">{formError}</div>
          )}
        </div>
      </Modal>
    </div>
  );
};

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className={cn('flex flex-col items-center justify-center py-20 text-center text-slate-500 dark:text-slate-400')}>
    <Brain className="w-10 h-10 mb-3 opacity-40" />
    <div className="font-medium text-slate-700 dark:text-slate-200">{title}</div>
    <div className="text-sm mt-1 max-w-sm">{description}</div>
  </div>
);

export default MemoriesPage;
