import React, { useMemo, useState } from 'react';
import { Terminal, AlertTriangle, User, Bot, Sparkles, RefreshCw, Copy, Trash2, Check } from 'lucide-react';
import type { LLMToolCall, Message } from '../../shared/types';
import { cn, formatTime, getInitial, renderMarkdown, copyToClipboard } from '../lib/utils';
import { api } from '../lib/api';

export interface MessageBubbleProps {
  message: Message;
  agentName?: string;
  agentColor?: string;
  agentAvatar?: string;
  isStreaming?: boolean;
  showHeader?: boolean;
  onRegenerate?: () => void;
  onDelete?: () => void;
}

function safeParseArgs(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return JSON.stringify(obj, null, 2);
    return String(obj);
  } catch {
    return raw;
  }
}

const ToolCallBadge: React.FC<{ tc: LLMToolCall }> = ({ tc }) => {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/50 dark:text-slate-200"
      title={safeParseArgs(tc.function.arguments)}
    >
      <Terminal size={10} />
      <span>{tc.function.name}</span>
    </span>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  agentName,
  agentColor,
  agentAvatar,
  isStreaming,
  showHeader = true,
  onRegenerate,
  onDelete,
}) => {
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await api.messages.regenerate({ messageId: message.id });
      onRegenerate?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCopy() {
    const text = message.content ?? '';
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleDelete() {
    if (!window.confirm('Delete this message?')) return;
    setDeleting(true);
    try {
      await api.messages.delete(message.id);
      onDelete?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }
  const isUser = message.senderType === 'user';
  const isSystem = message.senderType === 'system';
  const [avatarBroken, setAvatarBroken] = React.useState(false);
  const showAgentAvatar = !!agentAvatar && !isUser && !avatarBroken;
  const initial = useMemo(
    () => getInitial(isUser ? 'You' : agentName ?? 'A'),
    [isUser, agentName],
  );
  const avatarBg = isUser
    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
    : agentColor
      ? 'text-white'
      : 'bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-slate-300';
  const avatarStyle = !isUser && agentColor ? { backgroundColor: agentColor } : undefined;

  const html = useMemo(() => {
    if (!message.content) return '';
    return renderMarkdown(message.content);
  }, [message.content]);

  if (isSystem) {
    return (
      <div className="my-3 flex justify-center animate-fade-in">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
          <AlertTriangle size={12} className="text-slate-500" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group/bubble flex w-full gap-3 animate-fade-in',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-semibold',
          avatarBg,
          !isUser && !agentColor && 'ring-2 ring-white/20',
        )}
        style={avatarStyle}
        title={isUser ? 'You' : agentName ?? 'Agent'}
      >
        {showAgentAvatar ? (
          <img
            src={agentAvatar}
            alt={agentName ?? 'agent'}
            className="h-full w-full rounded-xl object-cover"
            onError={() => setAvatarBroken(true)}
          />
        ) : isUser ? (
          <User size={16} />
        ) : (
          initial
        )}
      </div>

      <div className={cn('flex max-w-[80%] min-w-0 flex-col', isUser ? 'items-end' : 'items-start')}>
        {showHeader && (
          <div
            className={cn(
              'mb-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400',
              isUser && 'flex-row-reverse',
            )}
          >
            {!isUser && (
              <Bot size={11} className="text-slate-400" />
            )}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {isUser ? 'You' : agentName ?? 'Agent'}
            </span>
            <span>·</span>
            <span>{formatTime(message.createdAt)}</span>
            {isStreaming && (
              <span className="flex items-center gap-0.5">
                <span className="streaming-dot h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span className="streaming-dot h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span className="streaming-dot h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
              </span>
            )}
          </div>
        )}

        <div
          className={cn(
            'relative rounded-2xl px-4 py-2.5 shadow-sm transition-shadow',
            isUser
              ? 'rounded-tr-sm bg-slate-900 text-white dark:bg-zinc-800 dark:text-slate-100'
              : 'rounded-tl-sm border border-slate-200 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-800/80',
          )}
        >
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className={cn('mb-2 flex flex-wrap gap-1.5', isUser && 'opacity-95')}>
              {message.toolCalls.map((tc) => (
                <ToolCallBadge key={tc.id} tc={tc} />
              ))}
            </div>
          )}

          {message.content ? (
            <div
              className={cn('prose', isUser && 'prose-invert')}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : isStreaming ? (
            <span className="flex items-center gap-2 text-sm italic text-slate-400 dark:text-slate-500">
              <Sparkles size={12} className="animate-pulse text-slate-400" />
              Thinking…
            </span>
          ) : null}

          {isStreaming && message.content && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle opacity-70" />
          )}
        </div>

        {!isStreaming && !isSystem && (
          <div className={cn(
            'mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover/bubble:opacity-100',
            isUser ? 'flex-row-reverse' : 'flex-row',
          )}>
            {message.content && (
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-700 dark:hover:text-slate-200"
                title="Copy message"
              >
                {copied ? <Check size={10} className="text-slate-600" /> : <Copy size={10} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
            {!isUser && (
              <button
                type="button"
                onClick={() => void handleRegenerate()}
                disabled={regenerating}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-slate-200"
                title="Regenerate response"
              >
                <RefreshCw size={10} className={cn(regenerating && 'animate-spin')} />
                Regenerate
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              title="Delete message"
            >
              <Trash2 size={10} className={cn(deleting && 'animate-pulse')} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
