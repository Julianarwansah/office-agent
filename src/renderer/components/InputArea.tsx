import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Send, Square, AtSign, Users } from 'lucide-react';
import type { Agent } from '../../shared/types';
import { cn, getInitial } from '../lib/utils';

export interface InputAreaHandle {
  focus(): void;
}

export interface InputAreaProps {
  onSend: (message: string, mentionedAgentIds: string[]) => void;
  onCancel?: () => void;
  isStreaming: boolean;
  agents: Agent[];
  placeholder?: string;
  disabled?: boolean;
  maxRows?: number;
  initialMentionedAgentIds?: string[];
}

interface MentionState {
  active: boolean;
  query: string;
  startIndex: number;
}

const InputArea = forwardRef<InputAreaHandle, InputAreaProps>(({
  onSend,
  onCancel,
  isStreaming,
  agents,
  placeholder = 'Type a message. Use @ to mention an agent.',
  disabled = false,
  maxRows = 6,
  initialMentionedAgentIds = [],
}, ref) => {
  const [value, setValue] = useState('');
  const [mentions, setMentions] = useState<string[]>(initialMentionedAgentIds);
  const [mentionAll, setMentionAll] = useState(false);
  const [mention, setMention] = useState<MentionState>({ active: false, query: '', startIndex: 0 });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => ({
    focus() {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
  }));

  const showAllOption = useMemo(() => {
    if (!mention.active || agents.length < 2) return false;
    const q = mention.query.toLowerCase();
    return !q || 'all'.includes(q) || 'everyone'.includes(q);
  }, [mention, agents]);

  const filteredAgents = useMemo(() => {
    if (!mention.active) return [] as Agent[];
    const q = mention.query.toLowerCase();
    return agents
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mention, agents]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const lineHeight = 24;
    const maxHeight = lineHeight * maxRows;
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
  }, [value, maxRows]);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setMention((m) => ({ ...m, active: false }));
      }
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  function detectMention(text: string, caret: number): MentionState {
    const before = text.slice(0, caret);
    const at = before.lastIndexOf('@');
    if (at < 0) return { active: false, query: '', startIndex: 0 };
    const between = before.slice(at + 1);
    if (/\s/.test(between)) return { active: false, query: '', startIndex: 0 };
    return { active: true, query: between, startIndex: at };
  }

  function handleChange(next: string) {
    const ta = textareaRef.current;
    const caret = ta?.selectionStart ?? next.length;
    setValue(next);
    setMention(detectMention(next, caret));
    if (mentionAll && !/@all\b/i.test(next)) {
      setMentionAll(false);
    }
  }

  function pickAll() {
    const before = value.slice(0, mention.startIndex);
    const after = value.slice(mention.startIndex + 1 + mention.query.length);
    const insertion = '@all ';
    const next = before + insertion + after;
    setValue(next);
    setMentionAll(true);
    setMentions([]);
    setMention({ active: false, query: '', startIndex: 0 });
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const pos = (before + insertion).length;
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  function pickMention(agent: Agent) {
    const before = value.slice(0, mention.startIndex);
    const after = value.slice(
      mention.startIndex + 1 + mention.query.length,
      value.length,
    );
    const insertion = `@${agent.name} `;
    const next = before + insertion + after;
    setValue(next);
    setMentions((m) => (m.includes(agent.id) ? m : [...m, agent.id]));
    setMention({ active: false, query: '', startIndex: 0 });
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const pos = (before + insertion).length;
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed, [...mentions]);
    setValue('');
    setMentions([]);
    setMentionAll(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention.active && (showAllOption || filteredAgents.length > 0)) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredAgents.length > 0) {
          pickMention(filteredAgents[0]);
        } else if (showAllOption) {
          pickAll();
        }
        return;
      }
      if (e.key === 'Escape') {
        setMention({ active: false, query: '', startIndex: 0 });
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const mentionedAgents = agents.filter((a) => mentions.includes(a.id));

  return (
    <div className="border-t border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800" ref={containerRef}>
      {(mentionAll || mentionedAgents.length > 0) && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <AtSign size={12} /> Mentioning:
          </span>
          {mentionAll ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-slate-300">
              <Users size={11} />
              All agents ({agents.length})
            </span>
          ) : (
            mentionedAgents.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-800 dark:bg-zinc-800 dark:text-slate-300"
                title={a.description ?? a.name}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: '#64748b' }}
                >
                  {getInitial(a.name)}
                </span>
                {a.name}
              </span>
            ))
          )}
        </div>
      )}

      <div className="relative">
        {mention.active && (showAllOption || filteredAgents.length > 0) && (
          <div className="absolute bottom-full left-0 z-10 mb-2 max-h-64 w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg scrollbar-thin dark:border-zinc-700 dark:bg-zinc-800">
            <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-zinc-700 dark:text-slate-400">
              Mention agent
            </div>
            {showAllOption && (
              <button
                type="button"
                onClick={pickAll}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-700/60"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-white dark:bg-zinc-600">
                  <Users size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">@all</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Mention all {agents.length} agents
                  </div>
                </div>
              </button>
            )}
            {filteredAgents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => pickMention(a)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: '#64748b' }}
                >
                  {getInitial(a.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{a.name}</div>
                  {a.description && (
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">{a.description}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div
          className={cn(
            'flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-2 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200 dark:border-zinc-700 dark:bg-zinc-800',
            disabled && 'opacity-60',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isStreaming}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-900 outline-none placeholder-slate-400 dark:text-slate-100"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
              title="Stop generation"
            >
              <Square size={14} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              className="flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              title="Send (Enter)"
            >
              <Send size={14} />
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
InputArea.displayName = 'InputArea';

export default InputArea;