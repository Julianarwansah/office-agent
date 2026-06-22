import React, { useMemo } from 'react';
import { Terminal, AlertTriangle, User } from 'lucide-react';
import type { LLMToolCall, Message } from '../../shared/types';
import { cn, formatTime, getInitial, renderMarkdown } from '../lib/utils';

export interface MessageBubbleProps {
  message: Message;
  agentName?: string;
  agentColor?: string;
  agentAvatar?: string;
  isStreaming?: boolean;
  showHeader?: boolean;
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
      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      title={safeParseArgs(tc.function.arguments)}
    >
      <Terminal size={11} />
      <span className="font-mono">{tc.function.name}</span>
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
}) => {
  const isUser = message.senderType === 'user';
  const isSystem = message.senderType === 'system';
  const initial = useMemo(
    () => getInitial(isUser ? 'You' : agentName ?? 'A'),
    [isUser, agentName],
  );
  const avatarBg = isUser
    ? 'bg-primary-600 text-white'
    : agentColor
      ? 'text-white'
      : 'bg-emerald-600 text-white';
  const avatarStyle = !isUser && agentColor ? { backgroundColor: agentColor } : undefined;

  const html = useMemo(() => {
    if (!message.content) return '';
    return renderMarkdown(message.content);
  }, [message.content]);

  if (isSystem) {
    return (
      <div className="my-2 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <AlertTriangle size={12} />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          avatarBg,
        )}
        style={avatarStyle}
        title={isUser ? 'You' : agentName ?? 'Agent'}
      >
        {agentAvatar && !isUser ? (
          <img src={agentAvatar} alt={agentName ?? 'agent'} className="h-full w-full rounded-full object-cover" />
        ) : isUser ? (
          <User size={16} />
        ) : (
          initial
        )}
      </div>

      <div className={cn('flex max-w-[80%] flex-col', isUser ? 'items-end' : 'items-start')}>
        {showHeader && (
          <div
            className={cn(
              'mb-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400',
              isUser && 'flex-row-reverse',
            )}
          >
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {isUser ? 'You' : agentName ?? 'Agent'}
            </span>
            <span>{formatTime(message.createdAt)}</span>
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 shadow-sm',
            isUser
              ? 'bg-primary-600 text-white'
              : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100',
            'border border-slate-200 dark:border-slate-700',
          )}
        >
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
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
            <span className="text-sm italic text-slate-400">Thinking…</span>
          ) : null}

          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle" />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;