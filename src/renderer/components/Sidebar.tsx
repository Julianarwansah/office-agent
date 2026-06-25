import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  MessageCircle,
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
  Network,
  TerminalSquare,
  BarChart3,
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
  { label: 'Chatgrub', path: '/chat', icon: MessageSquare },
  { label: 'Chat Agent', path: '/agent-chat', icon: MessageCircle },
  { label: 'Kanban', path: '/kanban', icon: KanbanSquare },
  { label: 'Agents', path: '/agents', icon: Bot },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Org Chart', path: '/org-chart', icon: Network },
  { label: 'Teams', path: '/teams', icon: Users },
  { label: 'Skills', path: '/skills', icon: Wand2 },
  { label: 'Memories', path: '/memories', icon: Brain },
  { label: 'Workspace', path: '/workspace', icon: FolderOpen },
  { label: 'Terminal', path: '/terminal', icon: TerminalSquare },
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
      : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    return (
      <li key={item.path}>
        <NavLink
          to={item.path}
          end={item.end}
          className={cn(
            'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
            isActive
              ? 'bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-slate-100'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-zinc-800/70 dark:hover:text-slate-200',
            collapsed && 'justify-center px-2',
          )}
          title={collapsed ? item.label : undefined}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-slate-700 dark:bg-slate-300" />
          )}
          <Icon
            size={18}
            strokeWidth={isActive ? 2.2 : 1.8}
            className={cn(
              'flex-shrink-0 transition-transform duration-150',
              isActive
                ? 'text-slate-800 dark:text-slate-100'
                : 'text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300',
              'group-hover:scale-105',
            )}
          />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="badge-neutral !py-0 !text-[10px]">{item.badge}</span>
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
        'fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-950',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-3 dark:border-zinc-800">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <Sparkles size={17} strokeWidth={2} />
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
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Sparkles size={17} strokeWidth={2} />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            className="ml-auto rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-slate-200"
            title="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center border-b border-slate-200 py-2 dark:border-zinc-800">
          <button
            onClick={toggleSidebar}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-slate-200"
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
      <div className="border-t border-slate-200 px-2 py-3 dark:border-zinc-800">
        <ul className="space-y-0.5">{BOTTOM_NAV.map(renderNavItem)}</ul>

        <div
          className={cn(
            'mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs',
            serverRunning
              ? 'bg-slate-50 text-slate-600 dark:bg-zinc-800/50 dark:text-slate-400'
              : 'bg-slate-50 text-slate-400 dark:bg-zinc-800/30 dark:text-slate-500',
            collapsed && 'justify-center px-0',
          )}
          title={serverRunning ? `Server online: ${localhostUrl}` : 'Local server offline'}
        >
          {serverRunning ? (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-500" />
            </span>
          ) : (
            <Circle size={8} className="flex-shrink-0 fill-slate-300" />
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
                  className="text-slate-500 hover:underline dark:text-slate-400"
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
