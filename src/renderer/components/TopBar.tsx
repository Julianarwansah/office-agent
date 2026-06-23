import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sun,
  Moon,
  Laptop,
  ExternalLink,
  Activity,
  Search,
  Command,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '../stores/app';
import type { AppTheme } from '../../shared/types';

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Workspace overview' },
  '/agent-chat': { title: 'Chat Agent', subtitle: 'Private 1:1 conversations' },
  '/agents': { title: 'Agents', subtitle: 'AI personas & skills' },
  '/teams': { title: 'Teams', subtitle: 'Groups of collaborating agents' },
  '/skills': { title: 'Skills', subtitle: 'Tool catalog' },
  '/memories': { title: 'Memories', subtitle: 'Long-term agent knowledge' },
  '/workspace': { title: 'Workspace', subtitle: 'Files & projects' },
  '/settings': { title: 'Settings', subtitle: 'Preferences & configuration' },
};

function getPageMeta(pathname: string): { title: string; subtitle?: string } {
  if (pathname.startsWith('/agent-chat')) {
    return PAGE_TITLES['/agent-chat'];
  }
  if (pathname.startsWith('/chat')) {
    return { title: 'Chatgrub', subtitle: 'Multi-agent team rooms' };
  }
  for (const key of Object.keys(PAGE_TITLES)) {
    if (key === '/' ? pathname === '/' : pathname.startsWith(key)) {
      return PAGE_TITLES[key];
    }
  }
  return { title: 'Office AI Agent' };
}

const TopBar: React.FC = () => {
  const { theme, setTheme, localhostUrl, systemInfo } = useAppStore();
  const location = useLocation();

  const meta = getPageMeta(location.pathname);

  const themeOptions: Array<{ value: AppTheme; icon: LucideIcon; label: string }> = [
    { value: 'light', icon: Sun, label: 'Light theme' },
    { value: 'dark', icon: Moon, label: 'Dark theme' },
    { value: 'system', icon: Laptop, label: 'System theme' },
  ];

  return (
    <header className="sticky top-0 z-20 flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/80 px-6 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/80">
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {meta.title}
        </h1>
        {meta.subtitle && (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {meta.subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Search hint */}
        <button
          className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800 md:flex"
          title="Quick search (coming soon)"
        >
          <Search size={13} />
          <span>Search</span>
          <kbd className="ml-1 inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1 font-mono text-[10px] dark:border-slate-700 dark:bg-slate-800">
            <Command size={9} />K
          </kbd>
        </button>

        {/* Server status pill */}
        {localhostUrl && (
          <a
            href={localhostUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 transition-all hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60 dark:hover:bg-emerald-950/60 sm:flex"
            title={localhostUrl}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <Activity size={11} />
            <span className="font-mono text-[11px]">{localhostUrl.replace(/^https?:\/\//, '')}</span>
            <ExternalLink size={10} />
          </a>
        )}

        {systemInfo && (
          <div
            className="hidden items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 lg:flex"
            title={`${systemInfo.platform} · ${systemInfo.arch} · ${systemInfo.cpus} CPUs`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            {systemInfo.platform}
          </div>
        )}

        {/* Theme switcher */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 dark:border-slate-800 dark:bg-slate-900/60">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex items-center justify-center rounded-md p-1.5 transition-all ${
                  active
                    ? 'bg-white text-primary-600 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-700 dark:text-primary-400 dark:ring-slate-600/60'
                    : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200'
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
