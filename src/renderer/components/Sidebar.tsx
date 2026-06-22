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
  Circle,
  KanbanSquare,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '../stores/app';
import { cn } from '../lib/utils';

interface NavEntry {
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavEntry[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, end: true },
  { label: 'Chat', path: '/chat', icon: MessageSquare },
  { label: 'Kanban', path: '/kanban', icon: KanbanSquare },
  { label: 'Agents', path: '/agents', icon: Bot },
  { label: 'Teams', path: '/teams', icon: Users },
  { label: 'Skills', path: '/skills', icon: Wand2 },
  { label: 'Memories', path: '/memories', icon: Brain },
  { label: 'Workspace', path: '/workspace', icon: FolderOpen },
];

const BOTTOM_NAV: NavEntry[] = [
  { label: 'Settings', path: '/settings', icon: Settings },
];

const Sidebar: React.FC = () => {
  const { sidebarOpen, toggleSidebar, localhostUrl } = useAppStore();
  const location = useLocation();
  const collapsed = !sidebarOpen;
  const serverRunning = !!localhostUrl;

  const renderNavItem = (item: NavEntry) => {
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
            'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
            isActive
              ? 'bg-gradient-to-r from-primary-50 to-primary-100/50 text-primary-700 shadow-sm dark:from-primary-900/30 dark:to-primary-900/10 dark:text-primary-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100',
            collapsed && 'justify-center px-2',
          )}
          title={collapsed ? item.label : undefined}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-primary-500" />
          )}
          <Icon
            size={18}
            strokeWidth={isActive ? 2.2 : 1.8}
            className={cn(
              'flex-shrink-0 transition-transform duration-150',
              isActive
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200',
              'group-hover:scale-110',
            )}
          />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="badge-primary !py-0 !text-[10px]">
                  {item.badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      </li>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-md transition-all duration-200 dark:border-slate-800/80 dark:bg-slate-950/95',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200/60 px-3 dark:border-slate-800/60">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-primary-500/30">
              <Sparkles size={18} strokeWidth={2.2} />
              <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-950" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                Office AI Agent
              </span>
              <span className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-400">
                v0.1.0
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="relative mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-primary-500/30">
            <Sparkles size={18} strokeWidth={2.2} />
            <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-950" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            className="ml-auto rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center border-b border-slate-200/60 py-2 dark:border-slate-800/60">
          <button
            onClick={toggleSidebar}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Expand sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin">
        {!collapsed && (
          <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>
        )}
        <ul className="space-y-0.5">{NAV_ITEMS.map(renderNavItem)}</ul>
      </nav>

      {/* Bottom: settings + status */}
      <div className="border-t border-slate-200/60 px-2 py-3 dark:border-slate-800/60">
        <ul className="space-y-0.5">{BOTTOM_NAV.map(renderNavItem)}</ul>

        <div
          className={cn(
            'mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs',
            serverRunning
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400',
            collapsed && 'justify-center px-0',
          )}
          title={serverRunning ? `Server online: ${localhostUrl}` : 'Local server offline'}
        >
          {serverRunning ? (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          ) : (
            <Circle size={8} className="flex-shrink-0 fill-slate-400" />
          )}
          {!collapsed && (
            <>
              <span className="flex-1 truncate font-medium">
                {serverRunning ? 'Online' : 'Offline'}
              </span>
              {serverRunning && localhostUrl && (
                <a
                  href={localhostUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 hover:underline dark:text-emerald-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
