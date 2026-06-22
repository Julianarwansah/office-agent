import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';

let hljsRegistered = false;

function ensureHljs(): void {
  if (hljsRegistered) return;
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('js', javascript);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('ts', typescript);
  hljs.registerLanguage('tsx', typescript);
  hljs.registerLanguage('jsx', javascript);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('py', python);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('sh', bash);
  hljs.registerLanguage('shell', bash);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('html', xml);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('markdown', markdown);
  hljs.registerLanguage('md', markdown);
  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('yaml', yaml);
  hljs.registerLanguage('yml', yaml);
  hljs.registerLanguage('go', go);
  hljs.registerLanguage('rust', rust);
  hljsRegistered = true;
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number, locale: string = 'en-US'): string {
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatTime(timestamp: number, locale: string = 'en-US'): string {
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(timestamp: number, locale: string = 'en-US'): string {
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(timestamp: number, now: number = Date.now()): string {
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

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadFile(content: string | Blob, filename: string, type: string = 'text/plain'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function highlightCode(code: string, lang?: string): string {
  ensureHljs();
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

export function renderMarkdown(md: string): string {
  ensureHljs();
  try {
    const renderer = new marked.Renderer();
    (renderer as unknown as { code: (code: unknown, infostring: string | undefined, escaped: boolean) => string }).code = (
      codeOrObj: unknown,
    ) => {
      const args = (typeof codeOrObj === 'object' && codeOrObj !== null
        ? (codeOrObj as { text?: string; lang?: string })
        : { text: String(codeOrObj ?? ''), lang: undefined });
      const text = args.text ?? '';
      const lang = args.lang;
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      let highlighted = '';
      try {
        highlighted = lang && hljs.getLanguage(lang)
          ? hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
          : hljs.highlightAuto(text).value;
      } catch {
        highlighted = escapeHtml(text);
      }
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
    };
    marked.setOptions({ renderer, gfm: true, breaks: true });
    const html = marked.parse(md ?? '', { async: false }) as string;
    return html;
  } catch (err) {
    return `<pre>${escapeHtml(md ?? '')}</pre>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

export function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): (...args: TArgs) => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#a855f7',
];

export function generateAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function getInitial(name: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function truncate(text: string, maxLen: number, suffix: string = '...'): string {
  if (typeof text !== 'string') return '';
  if (maxLen <= 0) return '';
  if (text.length <= maxLen) return text;
  const keep = Math.max(0, maxLen - suffix.length);
  return text.slice(0, keep) + suffix;
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}