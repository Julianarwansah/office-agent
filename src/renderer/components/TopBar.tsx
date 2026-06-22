import React from 'react';
import { Sun, Moon, Laptop, ExternalLink, Activity } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/app';
import type { AppTheme } from '../../shared/types';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/chat': 'Chat',
  '/agents': 'Agents',
  '/teams': 'Teams',
  '/skills': 'Skills',
  '/memories': 'Memories',
  '/workspace': 'Workspace',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/chat')) return 'Chat';
  for (const key of Object.keys(PAGE_TITLES)) {
    if (key === '/' ? pathname === '/' : pathname.startsWith(key)) {
      return PAGE_TITLES[key];
    }
  }
  return 'Office AI Agent';
}

const TopBar: React.FC = () => {
  const { theme, setTheme, localhostUrl, systemInfo } = useAppStore();
  const location = useLocation();

  const title = getPageTitle(location.pathname);

  const themeOptions: Array<{ value: AppTheme; icon: React.ComponentType<{ size?: number }>; label: string }> = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Laptop, label: 'System' },
  ];

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {localhostUrl && (
          <a
            href={localhostUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100 sm:flex"
            title={localhostUrl}
          >
            <Activity size={14} className="text-green-500" />
            <span className="font-mono">{localhostUrl}</span>
            <ExternalLink size={12} />
          </a>
        )}

        {systemInfo && (
          <div
            className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 dark:text-slate-400 md:flex"
            title={`Platform: ${systemInfo.platform}\nArch: ${systemInfo.arch}\nCPUs: ${systemInfo.cpus}`}
          >
            <Activity size={14} />
            <span>{systemInfo.platform}</span>
          </div>
        )}

        <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex items-center justify-center rounded p-1.5 transition-colors ${
                  active
                    ? 'bg-white text-primary-600 shadow-sm dark:bg-slate-700 dark:text-primary-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                title={opt.label}
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