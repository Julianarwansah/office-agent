import React, { useEffect, useMemo, useState } from 'react';
import {
  Wand2,
  AlertTriangle,
  RefreshCw,
  Terminal,
  Plus,
  Pencil,
  Trash2,
  FlaskConical,
  CheckCircle2,
  CircleX,
} from 'lucide-react';
import { useSkillsStore, type UserSkillRecord } from '../stores/skills';
import type { Skill } from '../../shared/types';
import { cn } from '../lib/utils';
import Button from '../components/ui/Button';
import SkillEditor from '../components/SkillEditor';
import type { UserSkillDraft } from '../stores/skills';

const CATEGORY_COLORS: Record<string, string> = {
  file: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  web: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  network: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  shell: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  system: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  code: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  memory: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  data: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  productivity: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300',
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

function colorForCategory(cat?: string): string {
  if (!cat) return CATEGORY_COLORS.default;
  const key = cat.toLowerCase();
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS.default;
}

const SkillsPage: React.FC = () => {
  const skills = useSkillsStore((s) => s.skills);
  const userSkills = useSkillsStore((s) => s.userSkills);
  const loading = useSkillsStore((s) => s.loading);
  const error = useSkillsStore((s) => s.error);
  const loadSkills = useSkillsStore((s) => s.loadSkills);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<UserSkillRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const userSkillNames = useMemo(
    () => new Set(userSkills.map((s) => s.name)),
    [userSkills],
  );

  function openNew() {
    setEditing(null);
    setPageError(null);
    setEditorOpen(true);
  }

  function openEdit(skill: UserSkillRecord) {
    setEditing(skill);
    setPageError(null);
    setEditorOpen(true);
  }

  async function handleSave(draft: UserSkillDraft) {
    setSaving(true);
    setPageError(null);
    try {
      const store = useSkillsStore.getState();
      if (editing) {
        await store.updateUserSkill(editing.name, draft);
      } else {
        await store.createUserSkill(draft);
      }
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to save skill');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(skill: UserSkillRecord) {
    const confirmed = window.confirm(
      `Delete user skill "${skill.displayName}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    setPageError(null);
    try {
      await useSkillsStore.getState().deleteUserSkill(skill.name);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to delete skill');
    }
  }

  async function handleTest(skill: UserSkillRecord) {
    setPageError(null);
    try {
      const result = await useSkillsStore.getState().testUserSkill({
        name: skill.name,
        testArgs: {},
      });
      if (!result.success) {
        setPageError(`Test failed: ${result.error ?? 'unknown error'}`);
      }
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Test failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Skills</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Available capabilities that agents can use. Built-in skills are shipped with the app;
            you can create your own user skills on top of them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadSkills()}
            className="btn-secondary"
            disabled={loading}
            title="Reload skills"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Button
            variant="primary"
            leftIcon={<Plus size={14} />}
            onClick={openNew}
          >
            New Skill
          </Button>
        </div>
      </div>

      {(pageError || error) && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {pageError ?? error}
        </div>
      )}

      {loading && skills.length === 0 && (
        <p className="text-sm text-slate-500">Loading skills…</p>
      )}

      {!loading && skills.length === 0 && (
        <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Wand2 className="text-slate-400" size={40} />
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">No skills installed</h2>
          <p className="max-w-sm text-sm text-slate-500">
            Skills are auto-registered on app startup. Drop new ones into the skills directory.
          </p>
        </div>
      )}

      {userSkills.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            User-defined skills
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userSkills.map((s) => (
              <UserSkillCard
                key={s.name}
                skill={s}
                onEdit={() => openEdit(s)}
                onDelete={() => handleDelete(s)}
                onTest={() => handleTest(s)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Built-in skills
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills
            .filter((s) => !userSkillNames.has(s.name))
            .map((skill) => (
              <SkillCard key={skill.name} skill={skill} />
            ))}
        </div>
      </section>

      <SkillEditor
        open={editorOpen}
        skill={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onTest={async (args) => {
          return useSkillsStore.getState().testUserSkill({
            name: args.name,
            manifest: args.manifest,
            implementation: args.implementation,
            testArgs: args.testArgs,
          });
        }}
        isSaving={saving}
      />
    </div>
  );
};

const SkillCard: React.FC<{ skill: Skill }> = ({ skill }) => {
  const params = skill.parameters ?? [];
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="flex-shrink-0 text-slate-500" />
            <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">
              {skill.displayName}
            </h3>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">{skill.name}</p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          {skill.category && (
            <span className={cn('badge', colorForCategory(skill.category))}>{skill.category}</span>
          )}
          {skill.dangerous && (
            <span className="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <AlertTriangle size={10} className="mr-1" />
              dangerous
            </span>
          )}
        </div>
      </div>

      <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
        {skill.description || 'No description provided.'}
      </p>

      {params.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Parameters
          </p>
          <div className="flex flex-wrap gap-1">
            {params.map((p) => (
              <span
                key={p.name}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              >
                {p.name}
                {p.required ? '*' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {skill.requiresApproval && (
        <p className="text-xs italic text-slate-500 dark:text-slate-400">
          Requires user approval before execution.
        </p>
      )}
    </div>
  );
};

interface UserSkillCardProps {
  skill: UserSkillRecord;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}

const UserSkillCard: React.FC<UserSkillCardProps> = ({ skill, onEdit, onDelete, onTest }) => {
  return (
    <div className="card group relative flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="flex-shrink-0 text-slate-500" />
            <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">
              {skill.displayName || skill.name}
            </h3>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">{skill.name}</p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          {skill.category && (
            <span className={cn('badge', colorForCategory(skill.category))}>{skill.category}</span>
          )}
          {skill.dangerous && (
            <span className="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <AlertTriangle size={10} className="mr-1" />
              dangerous
            </span>
          )}
          <span
            className={cn(
              'badge',
              skill.enabled
                ? 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
            )}
            title={skill.enabled ? 'Enabled' : 'Disabled'}
          >
            {skill.enabled ? (
              <>
                <CheckCircle2 size={10} className="mr-1" /> enabled
              </>
            ) : (
              <>
                <CircleX size={10} className="mr-1" /> disabled
              </>
            )}
          </span>
        </div>
      </div>

      <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
        {skill.description || 'No description provided.'}
      </p>

      {skill.parameters && skill.parameters.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Parameters
          </p>
          <div className="flex flex-wrap gap-1">
            {skill.parameters.map((p) => (
              <span
                key={p.name}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              >
                {p.name}
                {p.required ? '*' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {skill.requiresApproval && (
        <p className="text-xs italic text-slate-500 dark:text-slate-400">
          Requires user approval before execution.
        </p>
      )}

      <div className="mt-auto flex items-center justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          type="button"
          onClick={onTest}
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title="Dry-run the implementation"
        >
          <FlaskConical size={14} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default SkillsPage;
