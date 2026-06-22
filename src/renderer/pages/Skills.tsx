import React from 'react';
import { Wand2, AlertTriangle, RefreshCw, Terminal } from 'lucide-react';
import { useSkillsStore } from '../stores/skills';
import type { Skill } from '../../shared/types';
import { cn } from '../lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  file: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  web: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  shell: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  code: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  memory: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

function colorForCategory(cat?: string): string {
  if (!cat) return CATEGORY_COLORS.default;
  const key = cat.toLowerCase();
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS.default;
}

const SkillsPage: React.FC = () => {
  const skills = useSkillsStore((s) => s.skills);
  const loading = useSkillsStore((s) => s.loading);
  const loadSkills = useSkillsStore((s) => s.loadSkills);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Skills</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Available capabilities that agents can use.
          </p>
        </div>
        <button
          onClick={() => void loadSkills()}
          className="btn-secondary"
          disabled={loading}
          title="Reload skills"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((skill) => (
          <SkillCard key={skill.name} skill={skill} />
        ))}
      </div>
    </div>
  );
};

const SkillCard: React.FC<{ skill: Skill }> = ({ skill }) => {
  const params = skill.parameters ? Object.keys(skill.parameters) : [];
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="flex-shrink-0 text-primary-500" />
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
                key={p}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {skill.requiresApproval && (
        <p className="text-xs italic text-amber-600 dark:text-amber-400">
          Requires user approval before execution.
        </p>
      )}
    </div>
  );
};

export default SkillsPage;