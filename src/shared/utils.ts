import clsx, { type ClassValue } from 'clsx';
import { v4 as uuidv4, validate as isUuid } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function isValidId(id: string): boolean {
  return isUuid(id);
}

export function formatDate(timestamp: number, locale: string = 'en-US'): string {
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  if (!Number.isFinite(timestamp)) return '';
  const diff = now - timestamp;
  const absDiff = Math.abs(diff);
  const past = diff >= 0;
  const units: Array<{ ms: number; suffix: string }> = [
    { ms: 365 * 24 * 60 * 60 * 1000, suffix: 'year' },
    { ms: 30 * 24 * 60 * 60 * 1000, suffix: 'month' },
    { ms: 7 * 24 * 60 * 60 * 1000, suffix: 'week' },
    { ms: 24 * 60 * 60 * 1000, suffix: 'day' },
    { ms: 60 * 60 * 1000, suffix: 'hour' },
    { ms: 60 * 1000, suffix: 'minute' },
    { ms: 1000, suffix: 'second' },
  ];
  for (const u of units) {
    if (absDiff >= u.ms) {
      const value = Math.floor(absDiff / u.ms);
      const plural = value === 1 ? u.suffix : `${u.suffix}s`;
      return past ? `${value} ${plural} ago` : `in ${value} ${plural}`;
    }
  }
  return past ? 'just now' : 'in a moment';
}

export function truncate(text: string, maxLen: number, suffix: string = '...'): string {
  if (typeof text !== 'string') return '';
  if (maxLen <= 0) return '';
  if (text.length <= maxLen) return text;
  const keep = Math.max(0, maxLen - suffix.length);
  return text.slice(0, keep) + suffix;
}

export function estimateTokens(text: string): number {
  if (typeof text !== 'string' || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

export interface SafeJsonResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export function safeJsonParse<T = unknown>(input: string, fallback?: T): T | undefined {
  if (typeof input !== 'string') return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonParseStrict<T = unknown>(input: string): SafeJsonResult<T> {
  if (typeof input !== 'string') return { ok: false, error: 'Input is not a string' };
  try {
    return { ok: true, value: JSON.parse(input) as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function sleep(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms < 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}

export function classNames(...inputs: ClassValue[]): string {
  return clsx(...inputs);
}
