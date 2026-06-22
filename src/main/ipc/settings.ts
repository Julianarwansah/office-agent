/**
 * IPC handlers for app + per-key settings.
 *
 * `SettingsRepository` exposes both:
 *   - a generic key/value store (`get`, `set`, `delete`, `getAll`)
 *   - a typed `AppSettings` view (`getAppSettings` / `saveAppSettings`)
 *
 * This module wires both surfaces.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse, AppSettings, AppTheme } from '../../shared/types';
import type { SettingsRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:settings');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

const THEMES: AppTheme[] = ['light', 'dark', 'system'];

export interface SettingsHandlerDeps {
  settings: SettingsRepository;
}

export function registerSettingsHandlers(deps: SettingsHandlerDeps): void {
  const { settings: repo } = deps;

  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET_ALL, async (): Promise<ApiResponse<Record<string, unknown>>> => {
    try {
      return ok(repo.getAll());
    } catch (err) {
      return failErr('SETTINGS.GET_ALL', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET_APP, async (): Promise<ApiResponse<AppSettings>> => {
    try {
      return ok(repo.getAppSettings());
    } catch (err) {
      return failErr('SETTINGS.GET_APP', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.SAVE_APP, async (
    _evt,
    partial: Partial<AppSettings>,
  ): Promise<ApiResponse<AppSettings>> => {
    try {
      const sanitized = sanitizeAppSettings(partial);
      const saved = repo.saveAppSettings(sanitized);
      return ok(saved);
    } catch (err) {
      return failErr('SETTINGS.SAVE_APP', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET, async (
    _evt,
    key: string,
  ): Promise<ApiResponse<unknown>> => {
    try {
      if (!key || typeof key !== 'string') return fail('key is required');
      return ok(repo.get(key));
    } catch (err) {
      return failErr('SETTINGS.GET', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.SET, async (
    _evt,
    args: { key: string; value: unknown },
  ): Promise<ApiResponse<void>> => {
    try {
      if (!args?.key) return fail('key is required');
      repo.set(String(args.key), args.value);
      return ok(undefined);
    } catch (err) {
      return failErr('SETTINGS.SET', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.DELETE, async (
    _evt,
    key: string,
  ): Promise<ApiResponse<void>> => {
    try {
      if (!key || typeof key !== 'string') return fail('key is required');
      repo.delete(key);
      return ok(undefined);
    } catch (err) {
      return failErr('SETTINGS.DELETE', err);
    }
  });
}

function sanitizeAppSettings(partial: Partial<AppSettings> | undefined): Partial<AppSettings> {
  if (!partial) return {};
  const out: Partial<AppSettings> = {};
  if (partial.theme !== undefined && THEMES.includes(partial.theme as AppTheme)) {
    out.theme = partial.theme as AppTheme;
  }
  if (partial.localhostPort !== undefined && typeof partial.localhostPort === 'number') {
    out.localhostPort = clampInt(partial.localhostPort, 1, 65535, 4317);
  }
  if (partial.defaultProviderId !== undefined) {
    out.defaultProviderId = partial.defaultProviderId ?? undefined;
  }
  if (partial.terminalShell !== undefined) {
    out.terminalShell = String(partial.terminalShell ?? '');
  }
  if (partial.workingDirectory !== undefined) {
    out.workingDirectory = String(partial.workingDirectory ?? '');
  }
  if (partial.maxMemoryItems !== undefined && typeof partial.maxMemoryItems === 'number') {
    out.maxMemoryItems = clampInt(partial.maxMemoryItems, 1, 10000, 500);
  }
  if (partial.memoryImportanceThreshold !== undefined && typeof partial.memoryImportanceThreshold === 'number') {
    out.memoryImportanceThreshold = Math.max(0, Math.min(1, partial.memoryImportanceThreshold));
  }
  if (partial.autoCreateMemories !== undefined) out.autoCreateMemories = Boolean(partial.autoCreateMemories);
  if (partial.streamResponses !== undefined) out.streamResponses = Boolean(partial.streamResponses);
  if (partial.saveHistory !== undefined) out.saveHistory = Boolean(partial.saveHistory);
  return out;
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
