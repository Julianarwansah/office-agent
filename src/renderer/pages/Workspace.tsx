import React, { useEffect, useMemo, useState } from 'react';
import { Folder, FolderOpen, FileText, RefreshCw, Plus, ExternalLink, Loader2 } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace';
import { useAppStore } from '../stores/app';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { cn } from '../lib/utils';
import type { WorkspaceFile } from '@shared/types';

const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  json: 'json', md: 'markdown', css: 'css', html: 'xml', xml: 'xml',
  yaml: 'yaml', yml: 'yaml', sh: 'bash', sql: 'sql',
};

const WorkspacePage: React.FC = () => {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const files = useWorkspaceStore((s) => s.files);
  const fileContent = useWorkspaceStore((s) => s.fileContent);
  const loadingFiles = useWorkspaceStore((s) => s.loadingFiles);
  const error = useWorkspaceStore((s) => s.error);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const loadFiles = useWorkspaceStore((s) => s.loadFiles);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const readFile = useWorkspaceStore((s) => s.readFile);
  const openInOS = useWorkspaceStore((s) => s.openInOS);

  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage('Workspace');
  }, [setCurrentPage]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId) ?? null,
    [workspaces, currentWorkspaceId],
  );

  useEffect(() => {
    if (currentWorkspaceId) {
      void loadFiles(currentWorkspaceId);
    }
  }, [currentWorkspaceId, loadFiles]);

  const selectedContent = selectedPath ? fileContent[selectedPath] ?? null : null;

  const langFor = (name: string): string | null => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return EXT_LANG[ext] ?? null;
  };

  const handleOpenFile = async (path: string) => {
    setSelectedPath(path);
    setReadError(null);
    try {
      await readFile(path);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'Gagal membaca file');
    }
  };

  const handleOpenInOS = async () => {
    if (!currentWorkspace) return;
    try {
      await openInOS(currentWorkspace.path);
    } catch (err) {
      console.error(err);
    }
  };

  const openCreate = () => {
    setNewName('');
    setNewPath('');
    setFormError(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setFormError(null);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newPath.trim()) {
      setFormError('Nama dan path wajib diisi');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await createWorkspace({ name: newName.trim(), path: newPath.trim() });
      closeCreate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat workspace');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Workspace</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Working directory for agents. File operations are sandboxed to the selected workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => currentWorkspaceId && loadFiles(currentWorkspaceId)}>
            Refresh
          </Button>
          <Button variant="secondary" leftIcon={<ExternalLink className="w-4 h-4" />} onClick={handleOpenInOS} disabled={!currentWorkspace}>
            Open in OS
          </Button>
          <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Add Workspace
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600 dark:text-slate-400">Workspace:</label>
        <select
          className="px-3 py-1.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
          value={currentWorkspaceId ?? ''}
          onChange={(e) => setCurrentWorkspace(e.target.value || null)}
        >
          <option value="">— Select —</option>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} {w.isDefault ? '(default)' : ''}
            </option>
          ))}
        </select>
        {currentWorkspace && (
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
            {currentWorkspace.path}
          </span>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 overflow-hidden">
        <div className="border border-slate-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 overflow-y-auto">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-zinc-700 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <FolderOpen className="w-3.5 h-3.5" /> Files
            {loadingFiles && <Loader2 className="w-3 h-3 ml-auto animate-spin" />}
          </div>
          {!currentWorkspace ? (
            <div className="p-4 text-sm text-slate-500">No workspace selected.</div>
          ) : files.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Empty directory.</div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {files.map((f) => (
                <FileItem
                  key={f.path}
                  file={f}
                  selected={selectedPath === f.path}
                  onClick={() => handleOpenFile(f.path)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="border border-slate-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-zinc-700 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {selectedPath ? selectedPath.split(/[\\/]/).pop() : 'Preview'}
          </div>
          <div className="flex-1 overflow-auto">
            {!selectedPath ? (
              <div className="p-6 text-sm text-slate-500">Select a file to preview its contents.</div>
            ) : readError ? (
              <div className="p-4 text-sm text-red-600 dark:text-red-400">{readError}</div>
            ) : selectedContent === null ? (
              <div className="p-4 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <pre className="text-xs font-mono leading-relaxed">
                <code className={cn('hljs', langFor(selectedPath ?? '') ? `language-${langFor(selectedPath ?? '')}` : '')}>
                  {selectedContent}
                </code>
              </pre>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Add Workspace"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeCreate} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} loading={busy}>
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Name" value={newName}           onChange={setNewName} placeholder="My Project" required />
          <Input
            label="Path"
            value={newPath}
            onChange={setNewPath}
            placeholder={navigator?.platform?.toLowerCase().includes('win') ? 'C:\\Users\\me\\project' : '/Users/me/project'}
            required
          />
          {formError && <div className="text-sm text-red-600 dark:text-red-400">{formError}</div>}
          <p className="text-xs text-slate-500">
            Path harus absolut dan sudah ada di filesystem. Agents hanya bisa membaca/menulis di dalam path ini.
          </p>
        </div>
      </Modal>
    </div>
  );
};

const FileItem: React.FC<{ file: WorkspaceFile; selected: boolean; onClick: () => void }> = ({ file, selected, onClick }) => {
  const isDir = file.type === 'directory';
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800',
          selected && 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-slate-100',
        )}
      >
        {isDir ? <Folder className="w-4 h-4 text-slate-500" /> : <FileText className="w-4 h-4 text-slate-500" />}
        <span className="flex-1 truncate">{file.name}</span>
        {!isDir && file.size !== undefined && (
          <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
        )}
      </button>
    </li>
  );
};

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default WorkspacePage;
