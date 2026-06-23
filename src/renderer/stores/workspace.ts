import { create } from 'zustand';
import type { Workspace, WorkspaceFile } from '../../shared/types';
import { api, unwrap } from '../lib/api';

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  files: WorkspaceFile[];
  fileContent: Record<string, string>;
  loading: boolean;
  loadingFiles: boolean;
  error: string | null;

  loadWorkspaces: () => Promise<void>;
  setCurrentWorkspace: (id: string | null) => Promise<void>;
  loadFiles: (workspaceId?: string) => Promise<void>;
  createWorkspace: (input: { name: string; path: string; isDefault?: boolean }) => Promise<Workspace>;
  readFile: (path: string) => Promise<string>;
  openInOS: (path: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspaceId: null,
  files: [],
  fileContent: {},
  loading: false,
  loadingFiles: false,
  error: null,

  loadWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const workspaces = unwrap(await api.workspace.list());
      let current = get().currentWorkspaceId;
      if (!current) {
        try {
          const def = unwrap(await api.workspace.getDefault());
          current = def?.id ?? null;
        } catch {
          current = workspaces.find((w) => w.isDefault)?.id ?? workspaces[0]?.id ?? null;
        }
      }
      set({ workspaces, currentWorkspaceId: current, loading: false });
      if (current) {
        await get().loadFiles(current);
      }
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load workspaces',
      });
    }
  },

  setCurrentWorkspace: async (id) => {
    set({ currentWorkspaceId: id, files: [] });
    if (id) await get().loadFiles(id);
  },

  loadFiles: async (workspaceId) => {
    const id = workspaceId ?? get().currentWorkspaceId;
    if (!id) {
      set({ files: [] });
      return;
    }
    set({ loadingFiles: true });
    try {
      const files = unwrap(await api.workspace.listFiles(id));
      set({ files, loadingFiles: false });
    } catch (err) {
      set({
        loadingFiles: false,
        error: err instanceof Error ? err.message : 'Failed to load files',
      });
    }
  },

  createWorkspace: async (input) => {
    const created = unwrap(await api.workspace.create(input));
    await get().loadWorkspaces();
    await get().setCurrentWorkspace(created.id);
    return created;
  },

  readFile: async (path) => {
    try {
      const content = unwrap(await api.workspace.readFile(path));
      set((s) => ({ fileContent: { ...s.fileContent, [path]: content } }));
      return content;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read file';
      set({ error: msg });
      throw err;
    }
  },

  openInOS: async (path) => {
    try {
      unwrap(await api.workspace.openInOs(path));
    } catch (err) {
      console.error('Failed to open in OS:', err);
      throw err;
    }
  },
}));
