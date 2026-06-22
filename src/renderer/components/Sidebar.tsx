import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Users,
  Wand2,
  Brain,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../stores/app';
import { cn } from '../lib/utils';

interface NavEntry {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  end?: boolean;
}

const NAV_ITEMS: NavEntry[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, end: true },
  { label: 'Chat', path: '/chat', icon: MessageSquare },
  { label: 'Agents', path: '/agents', icon: Bot },
  { label: 'Teams', path: '/teams', icon: Users },
  { label: 'Skills', path: '/skills', icon: Wand2 },
  { label: 'Memories', path: '/memories', icon: Brain },
  { label: 'Workspace', path: '/workspace', icon: FolderOpen },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const Sidebar: React.FC = () => {
  const { sidebarOpen, toggleSidebar, localhostUrl } = useAppStore();
  const location = useLocation();
  const collapsed = !sidebarOpen;
  const serverRunning = !!localhostUrl;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-700 dark:bg-slate-800',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-white">
              <Sparkles size={18} />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                Office AI Agent
              </span>
              <span className="truncate text-[10px] uppercase tracking-wide text-slate-500">
                v0.1.0
              </span>
            </div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.end
              ? location.pathname === item.path
              : location.pathname === item.path ||
                location.pathname.startsWith(item.path + '/');
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.end}
                  className={cn(
                    'group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
                    collapsed && 'justify-center',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    size={18}
                    className={cn(
                      'flex-shrink-0',
                      isActive
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200',
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={cn(
          'flex items-center gap-2 border-t border-slate-200 px-3 py-3 text-xs dark:border-slate-700',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        <div className="flex items-center gap-2" title={serverRunning ? 'Local server running' : 'Local server offline'}>
          <span
            className={cn(
              'h-2 w-2 flex-shrink-0 rounded-full',
              serverRunning
                ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
                : 'bg-slate-300 dark:bg-slate-600',
            )}
          />
          {!collapsed && (
            <span className="text-slate-600 dark:text-slate-400">
              {serverRunning ? 'Server: online' : 'Server: offline'}
            </span>
          )}
        </div>
        {!collapsed && serverRunning && (
          <a
            href={localhostUrl ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="truncate text-primary-600 hover:underline dark:text-primary-400"
            title={localhostUrl ?? ''}
          >
            Open
          </a>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;