import { randomUUID } from 'node:crypto';

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoToMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

export function msToIso(ms: number | null | undefined): string {
  return new Date(typeof ms === 'number' && Number.isFinite(ms) ? ms : Date.now()).toISOString();
}

export function toIntBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
  return false;
}

export function fromIntBool(v: boolean | null | undefined): number {
  return v ? 1 : 0;
}

export function parseJson<T = unknown>(val: string | null | undefined): T | undefined {
  if (val == null || val === '') return undefined;
  try {
    return JSON.parse(val) as T;
  } catch {
    return undefined;
  }
}

export function stringifyJson(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  try {
    return JSON.stringify(val);
  } catch {
    return null;
  }
}

export function newId(): string {
  return randomUUID();
}

export function safeParseInt(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

export function safeParseFloat(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

export function notNull<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('Unexpected null value');
  return v;
}