const STORAGE_KEY = 'office-ai-agent:template-usage:v1';

type UsageMap = Record<string, number>;

function readAll(): UsageMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: UsageMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        out[k] = Math.floor(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(map: UsageMap): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

export function getTemplateUsage(templateId: string): number {
  const all = readAll();
  return all[templateId] ?? 0;
}

export function getAllTemplateUsage(): UsageMap {
  return readAll();
}

export function incrementTemplateUsage(templateId: string, by: number = 1): number {
  if (!templateId) return 0;
  const all = readAll();
  const next = (all[templateId] ?? 0) + by;
  all[templateId] = next;
  writeAll(all);
  return next;
}

export function resetTemplateUsage(templateId?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!templateId) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const all = readAll();
  delete all[templateId];
  writeAll(all);
}
