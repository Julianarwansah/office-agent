/**
 * IPC handlers for the in-app terminal.
 *
 * Each terminal session spawns a child process whose stdout/stderr are
 * streamed back to the renderer over `terminal:data` and `terminal:exit`.
 *
 * Note: we use simple stdio pipes (no PTY), which means the session is
 * not a full terminal emulator — it's closer to `child_process.exec`-style
 * behavior. RESIZE is therefore a no-op.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ipcMain } from 'electron';
import { IPC_CHANNELS, RENDERER_EVENT_CHANNELS } from '../../shared/types';
import type { ApiResponse } from '../../shared/types';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:terminal');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export type SendToRenderer = (channel: string, payload: unknown) => void;

export interface TerminalHandlerDeps {
  sendToRenderer: SendToRenderer;
}

export interface TerminalSessionHandle {
  id: string;
  child: ChildProcessWithoutNullStreams;
  cwd: string;
  shell: string;
  startedAt: number;
}

class TerminalManager {
  private sessions = new Map<string, TerminalSessionHandle>();

  get(sessionId: string): TerminalSessionHandle | undefined {
    return this.sessions.get(sessionId);
  }

  add(handle: TerminalSessionHandle): void {
    this.sessions.set(handle.id, handle);
  }

  remove(sessionId: string): TerminalSessionHandle | undefined {
    const handle = this.sessions.get(sessionId);
    if (handle) {
      try {
        if (!handle.child.killed) handle.child.kill();
      } catch {
        /* ignore */
      }
      this.sessions.delete(sessionId);
    }
    return handle;
  }

  size(): number {
    return this.sessions.size;
  }

  list(): TerminalSessionHandle[] {
    return Array.from(this.sessions.values());
  }
}

let manager: TerminalManager | null = null;

export function getTerminalManager(): TerminalManager {
  if (!manager) manager = new TerminalManager();
  return manager;
}

function defaultShell(): string {
  if (process.platform === 'win32') return 'powershell.exe';
  if (process.platform === 'darwin') return '/bin/zsh';
  return '/bin/bash';
}

export function registerTerminalHandlers(deps: TerminalHandlerDeps): void {
  const { sendToRenderer } = deps;
  const mgr = getTerminalManager();

  ipcMain.handle(IPC_CHANNELS.TERMINAL.CREATE, async (
    _evt,
    args: {
      cwd?: string;
      shell?: string;
      env?: Record<string, string>;
      cols?: number;
      rows?: number;
    },
  ): Promise<ApiResponse<{ sessionId: string }>> => {
    try {
      const sessionId = randomUUID();
      const shellPath = String(args?.shell ?? defaultShell());
      const cwd = args?.cwd ? String(args.cwd) : process.cwd();
      const env = { ...process.env, ...(args?.env ?? {}) } as NodeJS.ProcessEnv;

      log.info(`creating terminal session ${sessionId} (shell=${shellPath}, cwd=${cwd})`);

      const child = spawn(shellPath, [], {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      const handle: TerminalSessionHandle = {
        id: sessionId,
        child,
        cwd,
        shell: shellPath,
        startedAt: Date.now(),
      };

      child.stdout.on('data', (chunk: Buffer | string) => {
        const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        sendToRenderer(RENDERER_EVENT_CHANNELS.TERMINAL_DATA, { sessionId, data });
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        sendToRenderer(RENDERER_EVENT_CHANNELS.TERMINAL_DATA, { sessionId, data });
      });

      child.on('exit', (code, signal) => {
        sendToRenderer(RENDERER_EVENT_CHANNELS.TERMINAL_EXIT, {
          sessionId,
          code,
          signal: signal ?? null,
        });
        mgr.remove(sessionId);
      });

      child.on('error', (err) => {
        log.error(`terminal ${sessionId} child error`, err);
        sendToRenderer(RENDERER_EVENT_CHANNELS.TERMINAL_DATA, {
          sessionId,
          data: `\r\n[error] ${err.message}\r\n`,
        });
      });

      mgr.add(handle);
      return ok({ sessionId });
    } catch (err) {
      return failErr('TERMINAL.CREATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL.WRITE, async (
    _evt,
    args: { sessionId: string; data: string },
  ): Promise<ApiResponse<void>> => {
    try {
      if (!args?.sessionId) return fail('sessionId is required');
      const handle = mgr.get(args.sessionId);
      if (!handle) return fail(`Unknown session: ${args.sessionId}`);
      try {
        handle.child.stdin.write(String(args.data ?? ''), 'utf8');
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
      return ok(undefined);
    } catch (err) {
      return failErr('TERMINAL.WRITE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL.RESIZE, async (
    _evt,
    _args: { sessionId: string; cols: number; rows: number },
  ): Promise<ApiResponse<void>> => {
    // No PTY — resize is a no-op.
    return ok(undefined);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL.KILL, async (
    _evt,
    sessionId: string,
  ): Promise<ApiResponse<void>> => {
    try {
      if (!sessionId) return fail('sessionId is required');
      mgr.remove(sessionId);
      return ok(undefined);
    } catch (err) {
      return failErr('TERMINAL.KILL', err);
    }
  });
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
