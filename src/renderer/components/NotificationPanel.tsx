import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, Bot, AlertTriangle, Info } from 'lucide-react';
import { useNotificationsStore } from '../stores/notifications';
import type { Notification, NotificationType } from '../../shared/types';
import { cn, formatRelative } from '../lib/utils';

const TYPE_CONFIG: Record<NotificationType, { icon: React.ComponentType<{ size?: string | number; className?: string }>; color: string }> = {
  agent_done: { icon: Bot, color: 'text-green-500' },
  agent_error: { icon: AlertTriangle, color: 'text-red-500' },
  agent_input_needed: { icon: Bell, color: 'text-yellow-500' },
  info: { icon: Info, color: 'text-blue-500' },
};

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loadNotifications, markRead, markAllRead, clearAll } = useNotificationsStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  function handleClick(n: Notification) {
    if (!n.isRead) markRead(n.id);
    if (n.chatroomId) {
      navigate(`/chat/${n.chatroomId}`);
    }
    onClose();
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Notifikasi {unreadCount > 0 && <span className="ml-1 text-xs text-slate-400">({unreadCount} baru)</span>}
        </span>
        <div className="flex gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="rounded p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800"
              title="Tandai semua sudah dibaca"
            >
              <Check size={14} />
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-zinc-800"
              title="Hapus semua"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            Tidak ada notifikasi
          </div>
        ) : (
          notifications.slice(0, 20).map((n) => {
            const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
            const Icon = config.icon;
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60',
                  !n.isRead && 'bg-blue-50/50 dark:bg-blue-900/10',
                )}
              >
                <Icon size={16} className={cn('mt-0.5 flex-shrink-0', config.color)} />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-xs', n.isRead ? 'text-slate-600 dark:text-slate-400' : 'font-medium text-slate-800 dark:text-slate-200')}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">{n.message}</p>
                  )}
                  <p className="mt-1 text-[10px] text-slate-300 dark:text-slate-600">{formatRelative(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
