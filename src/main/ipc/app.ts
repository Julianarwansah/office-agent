/**
 * IPC handlers for app-level actions (quit, minimize, etc.).
 */

import type { App as ElectronApp, BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse } from '../../shared/types';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:app');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export interface AppHandlerDeps {
  app: ElectronApp;
  getWindow: () => BrowserWindow | null;
}

export function registerAppHandlers(deps: AppHandlerDeps): void {
  const { app, getWindow } = deps;

  ipcMain.handle(IPC_CHANNELS.APP.QUIT, async (): Promise<ApiResponse<void>> => {
    try {
      setImmediate(() => app.quit());
      return ok(undefined);
    } catch (err) {
      return failErr('APP.QUIT', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.APP.MINIMIZE, async (): Promise<ApiResponse<void>> => {
    try {
      const win = getWindow();
      if (!win) return fail('No active window');
      win.minimize();
      return ok(undefined);
    } catch (err) {
      return failErr('APP.MINIMIZE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.APP.MAXIMIZE, async (): Promise<ApiResponse<void>> => {
    try {
      const win = getWindow();
      if (!win) return fail('No active window');
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      return ok(undefined);
    } catch (err) {
      return failErr('APP.MAXIMIZE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.APP.TOGGLE_DEVTOOLS, async (): Promise<ApiResponse<void>> => {
    try {
      const win = getWindow();
      if (!win) return fail('No active window');
      win.webContents.toggleDevTools();
      return ok(undefined);
    } catch (err) {
      return failErr('APP.TOGGLE_DEVTOOLS', err);
    }
  });
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
