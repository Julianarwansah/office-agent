import React, { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, X, FileEdit, Check, Hash } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { cn } from '../lib/utils';
import {
  AGENT_TEMPLATES,
  AGENT_TEMPLATE_CATEGORIES,
  type AgentTemplate,
  type AgentTemplateCategory,
} from '../../shared/agent-templates';
import { getAllTemplateUsage } from '../lib/template-usage';

export interface AgentTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: AgentTemplate | null) => void;
}

const ALL_CATEGORY: AgentTemplateCategory = 'meta';

const AgentTemplatePicker: React.FC<AgentTemplatePickerProps> = ({ open, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AgentTemplateCategory | 'all'>('all');
  const [hovered, setHovered] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (open) {
      setUsage(getAllTemplateUsage());
      setRefreshTick((n) => n + 1);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AGENT_TEMPLATES.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (!q) return true;
      const hay = [
        t.name,
        t.tagline,
        t.description,
        t.systemPrompt,
        ...(t.tags ?? []),
      ]
        .join('\n')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, category]);

  function handlePick(template: AgentTemplate | null) {
    onSelect(template);
    setQuery('');
    setCategory('all');
    setHovered(null);
  }

  function handleClose() {
    setQuery('');
    setCategory('all');
    setHovered(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary-500" />
          <span>Choose an agent template</span>
        </div>
      }
      size="xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Start with a preconfigured persona, skills, and prompt. You can customize everything
          before saving.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates by name, skill, or tag…"
              className="input w-full pl-8 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <CategoryChip
            active={category === 'all'}
            onClick={() => setCategory('all')}
            emoji="🗂️"
            label={`All (${AGENT_TEMPLATES.length})`}
          />
          {AGENT_TEMPLATE_CATEGORIES.map((c) => {
            const count = AGENT_TEMPLATES.filter((t) => t.category === c.value).length;
            if (count === 0 && c.value !== ALL_CATEGORY) return null;
            return (
              <CategoryChip
                key={c.value}
                active={category === c.value}
                onClick={() => setCategory(c.value)}
                emoji={c.emoji}
                label={`${c.label} (${count})`}
              />
            );
          })}
        </div>

        <div className="max-h-[55vh] overflow-y-auto pr-1 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              No templates match your search. Try a different keyword or category.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <TemplateCard
                  key={`${t.id}-${refreshTick}`}
                  template={t}
                  highlighted={hovered === t.id}
                  usedCount={usage[t.id] ?? 0}
                  onHover={(h) => setHovered(h ? t.id : null)}
                  onPick={() => handlePick(t)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
          <p className="text-xs text-slate-500">
            Tip: you can also start from a blank agent and configure everything yourself.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleClose} size="sm">
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePick(null)}
              leftIcon={<FileEdit size={12} />}
            >
              Start from blank
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

interface CategoryChipProps {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}

const CategoryChip: React.FC<CategoryChipProps> = ({ active, onClick, emoji, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
      active
        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
    )}
  >
    <span>{emoji}</span>
    <span>{label}</span>
  </button>
);

interface TemplateCardProps {
  template: AgentTemplate;
  highlighted: boolean;
  usedCount: number;
  onHover: (hover: boolean) => void;
  onPick: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, highlighted, usedCount, onHover, onPick }) => {
  return (
    <button
      type="button"
      onClick={onPick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        'group relative flex h-full flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all',
        'hover:-translate-y-0.5 hover:border-primary-400 hover:shadow-md',
        highlighted
          ? 'border-primary-400 shadow-md'
          : 'border-slate-200 dark:border-slate-700',
        'bg-white dark:bg-slate-800',
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 rounded-t-lg"
        style={{ backgroundColor: template.color }}
      />
      <div className="flex w-full items-start gap-2.5 pt-1">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-xl shadow-sm"
          style={{ backgroundColor: `${template.color}22` }}
        >
          <span aria-hidden>{template.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {template.name}
            </h3>
            {template.isLead && (
              <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Lead
              </span>
            )}
          </div>
          <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
            {template.tagline}
          </p>
        </div>
      </div>

      <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
        {template.description}
      </p>

      <div className="mt-auto flex w-full flex-wrap items-center gap-1 pt-1">
        {template.enabledSkills.slice(0, 4).map((s) => (
          <span
            key={s}
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          >
            {s}
          </span>
        ))}
        {template.enabledSkills.length > 4 && (
          <span className="text-[10px] text-slate-500">
            +{template.enabledSkills.length - 4}
          </span>
        )}
      </div>

      <div className="mt-1 flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="uppercase tracking-wide text-slate-400">
            temp {template.temperature.toFixed(1)} · {template.maxTokens} tok
          </span>
        </div>
        <span
          className={cn(
            'inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            usedCount > 0
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
          )}
          title={
            usedCount > 0
              ? `This template has been used ${usedCount} time${usedCount === 1 ? '' : 's'}`
              : 'This template has not been used yet'
          }
        >
          <Hash size={9} />
          {usedCount === 0 ? 'unused' : `used ${usedCount}×`}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-primary-400">
          <Check size={12} /> Use
        </span>
      </div>
    </button>
  );
};

export default AgentTemplatePicker;
