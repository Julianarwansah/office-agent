import { getDb } from '../index';
import { nowIso, parseJson, stringifyJson } from '../helpers';
import type { AppSettings, AppTheme } from '../../../shared/types';

const SETTINGS_KEY_PREFIX = 'app:';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  localhostPort: 4317,
  terminalShell: '',
  workingDirectory: '',
  maxMemoryItems: 500,
  memoryImportanceThreshold: 0.3,
  autoCreateMemories: true,
  streamResponses: true,
  saveHistory: true,
};

interface SettingRow {
  key: string;
  value: string | null;
  updated_at: string;
}

export class SettingsRepository {
  get<T = unknown>(key: string): T | null {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string | null }
      | undefined;
    if (!row) return null;
    const parsed = parseJson<T>(row.value);
    return parsed === undefined ? null : parsed;
  }

  set<T = unknown>(key: string, value: T): void {
    const db = getDb();
    const serialized = stringifyJson(value);
    db.prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(key, serialized, nowIso());
  }

  delete(key: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    return result.changes > 0;
  }

  getAll(): Record<string, unknown> {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM settings').all() as SettingRow[];
    const out: Record<string, unknown> = {};
    for (const row of rows) {
      const value = parseJson(row.value);
      if (value !== undefined) out[row.key] = value;
    }
    return out;
  }

  getAppSettings(): AppSettings {
    const stored = this.get<Partial<AppSettings>>(SETTINGS_KEY_PREFIX + 'settings') ?? {};
    return {
      ...DEFAULT_APP_SETTINGS,
      ...stored,
    };
  }

  saveAppSettings(partial: Partial<AppSettings>): AppSettings {
    const current = this.getAppSettings();
    const merged: AppSettings = {
      ...current,
      ...partial,
    };
    if (merged.theme) merged.theme = merged.theme as AppTheme;
    this.set(SETTINGS_KEY_PREFIX + 'settings', merged);
    return merged;
  }
}

export const settings = new SettingsRepository();
