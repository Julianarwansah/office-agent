/**
 * IPC handlers for system-level information + actions.
 */

import * as os from 'node:os';
import { ipcMain, shell, app as electronApp } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse } from '../../shared/types';
import type { LocalServer } from '../server/localhost';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:system');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export interface SystemInfo {
  platform: NodeJS.Platform;
  arch: string;
  versions: {
    node: string;
    electron: string;
    chrome: string;
    app: string;
  };
  cpus: number;
  totalMemory: number;
  freeMemory: number;
  hostname: string;
}

export interface SystemHandlerDeps {
  localServer: LocalServer;
}

export function registerSystemHandlers(deps: SystemHandlerDeps): void {
  const { localServer } = deps;

  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_INFO, async (): Promise<ApiResponse<SystemInfo>> => {
    try {
      const info: SystemInfo = {
        platform: process.platform,
        arch: process.arch,
        versions: {
          node: process.versions.node ?? '',
          electron: process.versions.electron ?? '',
          chrome: process.versions.chrome ?? '',
          app: safeAppVersion(),
        },
        cpus: os.cpus()?.length ?? 0,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        hostname: os.hostname(),
      };
      return ok(info);
    } catch (err) {
      return failErr('SYSTEM.GET_INFO', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM.OPEN_EXTERNAL, async (
    _evt,
    args: { url: string },
  ): Promise<ApiResponse<void>> => {
    try {
      if (!args?.url) return fail('url is required');
      const url = String(args.url);
      if (!/^https?:\/\//i.test(url)) {
        return fail('Only http(s) URLs are allowed');
      }
      await shell.openExternal(url);
      return ok(undefined);
    } catch (err) {
      return failErr('SYSTEM.OPEN_EXTERNAL', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_LOCALHOST_URL, async (): Promise<ApiResponse<string | null>> => {
    try {
      const url = localServer.url;
      return ok(url);
    } catch (err) {
      return failErr('SYSTEM.GET_LOCALHOST_URL', err);
    }
  });
}

function safeAppVersion(): string {
  try {
    return electronApp.getVersion();
  } catch {
    return '0.0.0';
  }
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
