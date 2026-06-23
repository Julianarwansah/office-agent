import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon, Laptop, ExternalLink, Activity, type LucideIcon } from 'lucide-react';
import { useAppStore } from '../stores/app';
import type { AppTheme } from '../../shared/types';

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Workspace overview' },
  '/agent-chat': { title: 'Chat Agent', subtitle: 'Private 1:1 conversations' },
  '/agents': { title: 'Agents', subtitle: 'AI personas & skills' },
  '/org-chart': { title: 'Org Chart', subtitle: 'Team structure & hierarchy' },
  '/teams': { title: 'Teams', subtitle: 'Groups of collaborating agents' },
  '/skills': { title: 'Skills', subtitle: 'Tool catalog' },
  '/memories': { title: 'Memories', subtitle: 'Long-term agent knowledge' },
  '/workspace': { title: 'Workspace', subtitle: 'Files & projects' },
  '/terminal': { title: 'Terminal', subtitle: 'Run shell commands' },
  '/kanban': { title: 'Kanban', subtitle: 'Task boards & agent workflows' },
  '/settings': { title: 'Settings', subtitle: 'Preferences & configuration' },
};

function getPageMeta(pathname: string): { title: string; subtitle?: string } {
  if (pathname.startsWith('/agent-chat')) return PAGE_TITLES['/agent-chat'];
  if (pathname.startsWith('/chat')) return { title: 'Chatgrub', subtitle: 'Multi-agent team rooms' };
  for (const key of Object.keys(PAGE_TITLES)) {
    if (key === '/' ? pathname === '/' : pathname.startsWith(key)) return PAGE_TITLES[key];
  }
  return { title: 'Office AI Agent' };
}

const TopBar: React.FC = () => {
  const { theme, setTheme, localhostUrl } = useAppStore();
  const location = useLocation();
  const meta = getPageMeta(location.pathname);

  const themeOptions: Array<{ value: AppTheme; icon: LucideIcon; label: string }> = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Laptop, label: 'System' },
  ];

  return (
    <header className="sticky top-0 z-20 flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {meta.title}
        </h1>
        {meta.subtitle && (
          <p className="truncate text-xs text-slate-400 dark:text-slate-500">{meta.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {localhostUrl && (
          <a
            href={localhostUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-slate-400 dark:hover:bg-zinc-800 sm:flex"
            title={localhostUrl}
          >
            <Activity size={11} />
            <span className="font-mono text-[11px]">{localhostUrl.replace(/^https?:\/\//, '')}</span>
            <ExternalLink size={10} />
          </a>
        )}

        {/* Theme switcher */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex items-center justify-center rounded-md p-1.5 transition-all ${
                  active
                    ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/80 dark:bg-zinc-700 dark:text-slate-200 dark:ring-zinc-600'
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                }`}
                title={opt.label}
                aria-label={opt.label}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
