import React, { useEffect, useState } from 'react';
import { Check, X, Loader2, TestTube2, Activity, Zap, AlertCircle, RotateCw } from 'lucide-react';
import { cn } from '../lib/utils';

export interface TestResultData {
  ok: boolean;
  success?: boolean;
  message: string;
  latencyMs?: number;
  testedAt?: number;
}

export interface TestConnectionButtonProps {
  onTest: () => Promise<TestResultData>;
  disabled?: boolean;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  label?: string;
  showLastResult?: boolean;
  inline?: boolean;
}

/**
 * A button that runs an async test and renders the result inline below it.
 * Used to test LLM provider connections (and any other connectivity check).
 */
const TestConnectionButton: React.FC<TestConnectionButtonProps> = ({
  onTest,
  disabled,
  size = 'sm',
  variant = 'secondary',
  className,
  label = 'Test',
  showLastResult = true,
  inline = true,
}) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResultData | null>(null);

  useEffect(() => {
    setResult(null);
  }, [disabled]);

  const handleClick = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await onTest();
      setResult(r);
    } catch (err) {
      setResult({
        ok: false,
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const buttonBase =
    size === 'sm'
      ? 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50'
      : 'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50';

  const variantClass =
    variant === 'primary'
      ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
      : variant === 'ghost'
        ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
        : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:ring-slate-600';

  return (
    <div className={cn('flex flex-col gap-2', inline ? '' : 'w-fit')}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || testing}
        className={cn(buttonBase, variantClass, className)}
      >
        {testing ? <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin" /> : <TestTube2 size={size === 'sm' ? 12 : 14} />}
        {testing ? 'Testing…' : label}
      </button>

      {showLastResult && result && !testing && (
        <TestResultDisplay result={result} compact={size === 'sm'} />
      )}
    </div>
  );
};

export interface TestResultDisplayProps {
  result: TestResultData;
  compact?: boolean;
  onClear?: () => void;
  onRetry?: () => void;
}

export const TestResultDisplay: React.FC<TestResultDisplayProps> = ({ result, compact, onClear, onRetry }) => {
  const ok = result.ok;
  const LatencyBadge = result.latencyMs !== undefined && (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium',
        'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
      )}
    >
      <Zap size={9} />
      {result.latencyMs} ms
    </span>
  );

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1 text-[11px]',
          ok
            ? 'bg-slate-50 text-slate-700 dark:bg-zinc-800/60 dark:text-slate-300'
            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
        )}
      >
        {ok ? <Check size={11} className="flex-shrink-0" /> : <X size={11} className="flex-shrink-0" />}
        <span className="truncate">{result.message}</span>
        {LatencyBadge}
        {(onClear || onRetry) && (
          <div className="ml-auto flex items-center gap-1">
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5"
                title="Retry"
              >
                <RotateCw size={10} />
              </button>
            )}
            {onClear && (
              <button
                onClick={onClear}
                className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5"
                title="Clear"
              >
                <X size={10} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-sm',
        ok
          ? 'border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50'
          : 'border-red-200 bg-red-50 dark:border-red-800/60 dark:bg-red-950/20',
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
            ok
              ? 'bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-slate-300'
              : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
          )}
        >
          {ok ? <Check size={16} /> : <AlertCircle size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'font-semibold',
                ok
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-red-900 dark:text-red-200',
              )}
            >
              {ok ? 'Connection successful' : 'Connection failed'}
            </span>
            {LatencyBadge}
          </div>
          <p
            className={cn(
              'mt-0.5 text-xs',
              ok
                ? 'text-slate-700 dark:text-slate-300'
                : 'text-red-800 dark:text-red-300',
            )}
          >
            {result.message}
          </p>
        </div>
        {(onClear || onRetry) && (
          <div className="flex items-center gap-1">
            {onRetry && (
              <button
                onClick={onRetry}
                className={cn(
                  'rounded p-1 transition-colors',
                  ok
                    ? 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-700'
                    : 'text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40',
                )}
                title="Retry"
              >
                <RotateCw size={12} />
              </button>
            )}
            {onClear && (
              <button
                onClick={onClear}
                className={cn(
                  'rounded p-1 transition-colors',
                  ok
                    ? 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-700'
                    : 'text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40',
                )}
                title="Clear"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export interface TestConnectionStatusProps {
  label?: string;
  status: 'idle' | 'testing' | 'ok' | 'error';
  message?: string;
  latencyMs?: number;
}

export const TestConnectionStatus: React.FC<TestConnectionStatusProps> = ({ label = 'Connection', status, message, latencyMs }) => {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-center gap-1.5">
        {status === 'testing' && <Loader2 size={12} className="animate-spin text-slate-400" />}
        {status === 'ok' && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-500" />
          </span>
        )}
        {status === 'error' && <X size={12} className="text-red-500" />}
        {status === 'idle' && <Activity size={12} className="text-slate-400" />}
      </div>
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
      {latencyMs !== undefined && (
        <span className="ml-auto font-mono text-[10px] text-slate-500">{latencyMs}ms</span>
      )}
      {message && (
        <span className="ml-auto truncate text-slate-500" title={message}>
          {message}
        </span>
      )}
    </div>
  );
};

export default TestConnectionButton;
