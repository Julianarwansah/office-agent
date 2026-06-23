import React, { useState } from 'react';
import { Pin, Edit, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import type { Memory } from '../../shared/types';
import { cn, formatDate } from '../lib/utils';

export interface MemoryCardProps {
  memory: Memory;
  onEdit?: (memory: Memory) => void;
  onDelete?: (memory: Memory) => void;
  onTogglePin?: (memory: Memory) => void;
}

const CATEGORY_LABELS: Record<Memory['category'], string> = {
  user_preference: 'Preference',
  fact: 'Fact',
  instruction: 'Instruction',
  context: 'Context',
  task: 'Task',
};

const TYPE_LABELS: Record<Memory['type'], string> = {
  short_term: 'Short term',
  long_term: 'Long term',
  episodic: 'Episodic',
  semantic: 'Semantic',
};

const CATEGORY_COLORS: Record<Memory['category'], string> = {
  user_preference: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  fact: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  instruction: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  context: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  task: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
};

const MemoryCard: React.FC<MemoryCardProps> = ({ memory, onEdit, onDelete, onTogglePin }) => {
  const [expanded, setExpanded] = useState(false);
  const importance = Math.max(0, Math.min(1, memory.importance));
  const importancePct = Math.round(importance * 100);
  const content = memory.content ?? '';
  const truncated = content.length > 220 && !expanded;

  return (
    <div
      className={cn(
        'card group relative flex flex-col gap-2 p-4 transition-shadow hover:shadow-md',
        memory.isPinned && 'ring-1 ring-slate-300 dark:ring-zinc-600',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn('badge', CATEGORY_COLORS[memory.category])}>
            {CATEGORY_LABELS[memory.category]}
          </span>
          <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {TYPE_LABELS[memory.type]}
          </span>
          {memory.isPinned && (
            <span className="badge-neutral">
              <Pin size={10} className="mr-1" /> Pinned
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(memory)}
              className={`rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700 ${
                memory.isPinned ? 'text-slate-700' : 'text-slate-500'
              }`}
              title={memory.isPinned ? 'Unpin' : 'Pin'}
            >
              <Pin size={14} />
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(memory)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              title="Edit"
            >
              <Edit size={14} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Delete this memory?')) onDelete(memory);
              }}
              className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <p
        className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100"
        style={truncated ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
      >
        {content}
      </p>
      {content.length > 220 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs text-slate-600 hover:underline dark:text-slate-400"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Calendar size={12} />
          <span>{formatDate(memory.createdAt)}</span>
          <span>·</span>
          <span>accessed {memory.accessCount}×</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Importance</span>
          <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className={cn(
                'h-full rounded-full',
                importance > 0.7 ? 'bg-slate-700' : importance > 0.4 ? 'bg-slate-400' : 'bg-slate-200',
              )}
              style={{ width: `${importancePct}%` }}
            />
          </div>
          <span className="font-mono text-xs text-slate-500">{importancePct}%</span>
        </div>
      </div>

      {memory.accessCount > 10 && (
        <div className="absolute right-2 top-2">
          <AlertTriangle size={12} className="text-slate-500" />
        </div>
      )}
    </div>
  );
};

export default MemoryCard;