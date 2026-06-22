/**
 * IPC handlers for workspaces.
 *
 * In addition to CRUD on the workspace record, this module exposes:
 *   - listFiles(workspaceId): shallow directory listing (1 level, no recursion)
 *   - readFile({ path } or { workspaceId, path }): text/binary file read with
 *     path-traversal protection and a 1 MB cap
 *   - openInOs({ path }): shell.openPath for the user's OS file manager
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse, Workspace, WorkspaceFile } from '../../shared/types';
import type { WorkspaceRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:workspace');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB

export interface WorkspaceHandlerDeps {
  workspaces: WorkspaceRepository;
}

export function registerWorkspaceHandlers(deps: WorkspaceHandlerDeps): void {
  const { workspaces: repo } = deps;

  ipcMain.handle(IPC_CHANNELS.WORKSPACE.LIST, async (): Promise<ApiResponse<Workspace[]>> => {
    try {
      return ok(repo.findAll());
    } catch (err) {
      return failErr('WORKSPACE.LIST', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE.GET_DEFAULT, async (): Promise<ApiResponse<Workspace | null>> => {
    try {
      return ok(repo.getDefault());
    } catch (err) {
      return failErr('WORKSPACE.GET_DEFAULT', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE.CREATE, async (
    _evt,
    input: Partial<Workspace>,
  ): Promise<ApiResponse<Workspace>> => {
    try {
      if (!input?.name || !input?.path) {
        return fail('name and path are required');
      }
      const created = repo.create({
        name: String(input.name),
        path: String(input.path),
        isDefault: Boolean(input.isDefault),
      });
      return ok(created);
    } catch (err) {
      return failErr('WORKSPACE.CREATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE.UPDATE, async (
    _evt,
    id: string,
    partial: Partial<Workspace>,
  ): Promise<ApiResponse<Workspace | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      const out: import('../db/repositories/workspaces').WorkspaceUpdateInput = {};
      if (partial.name !== undefined) out.name = String(partial.name);
      if (partial.path !== undefined) out.path = String(partial.path);
      if (partial.isDefault !== undefined) out.isDefault = Boolean(partial.isDefault);
      return ok(repo.update(id, out));
    } catch (err) {
      return failErr('WORKSPACE.UPDATE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE.DELETE, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(repo.delete(id));
    } catch (err) {
      return failErr('WORKSPACE.DELETE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE.SET_DEFAULT, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      const existing = repo.findById(id);
      if (!existing) return fail(`Workspace not found: ${id}`);
      repo.setDefault(id);
      return ok(true);
    } catch (err) {
      return failErr('WORKSPACE.SET_DEFAULT', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE.LIST_FILES, async (
    _evt,
    workspaceId: string,
  ): Promise<ApiResponse<WorkspaceFile[]>> => {
    try {
      if (!workspaceId || typeof workspaceId !== 'string') return fail('workspaceId is required');
      const ws = repo.findById(workspaceId);
      if (!ws) return fail(`Workspace not found: ${workspaceId}`);
      const files = await listFilesShallow(ws.path);
      return ok(files);
    } catch (err) {
      return failErr('WORKSPACE.LIST_FILES', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE.READ_FILE, async (
    _evt,
    args: { workspaceId?: string; path: string },
  ): Promise<ApiResponse<string>> => {
    try {
      if (!args?.path) return fail('path is required');
      const ws = args.workspaceId ? repo.findById(args.workspaceId) : repo.getDefault();
      if (!ws) return fail('No workspace to resolve path against');
      const resolved = safeResolve(ws.path, args.path);
      if (!resolved) return fail('Path escapes workspace root');
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) return fail('Not a file');
      if (stat.size > MAX_FILE_BYTES) {
        return fail(`File too large: ${stat.size} bytes (max ${MAX_FILE_BYTES})`);
      }
      const buf = await fs.readFile(resolved);
      return ok(buf.toString('utf8'));
    } catch (err) {
      return failErr('WORKSPACE.READ_FILE', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE.OPEN_IN_OS, async (
    _evt,
    args: { path: string },
  ): Promise<ApiResponse<void>> => {
    try {
      if (!args?.path) return fail('path is required');
      const result = await shell.openPath(String(args.path));
      if (result) {
        // Electron returns a non-empty string on error.
        return fail(result);
      }
      return ok(undefined);
    } catch (err) {
      return failErr('WORKSPACE.OPEN_IN_OS', err);
    }
  });
}

async function listFilesShallow(workspacePath: string): Promise<WorkspaceFile[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(workspacePath, { withFileTypes: true });
  } catch (err) {
    log.warn(`failed to read workspace dir: ${workspacePath}`, err);
    return [];
  }
  const out: WorkspaceFile[] = [];
  for (const entry of entries) {
    const full = path.join(workspacePath, entry.name);
    let size: number | undefined;
    let modifiedAt: number | undefined;
    try {
      const st = await fs.stat(full);
      size = st.isFile() ? st.size : undefined;
      modifiedAt = st.mtimeMs;
    } catch {
      /* ignore stat errors */
    }
    out.push({
      path: full,
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size,
      modifiedAt,
    });
  }
  // Directories first, then files; alphabetical within each group.
  out.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

function safeResolve(workspaceRoot: string, requested: string): string | null {
  const stripped = String(requested).replace(/^[/\\]+/, '');
  if (!stripped) return null;
  const candidate = path.resolve(workspaceRoot, stripped);
  const rootWithSep = workspaceRoot.endsWith(path.sep)
    ? workspaceRoot
    : workspaceRoot + path.sep;
  if (candidate !== workspaceRoot && !candidate.startsWith(rootWithSep)) {
    return null;
  }
  return candidate;
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
