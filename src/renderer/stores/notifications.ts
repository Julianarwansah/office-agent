import { create } from 'zustand';
import type { Notification } from '../../shared/types';
import { api, unwrap } from '../lib/api';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  loadNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  addNotification: (notification: Notification) => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  loadNotifications: async () => {
    set({ loading: true });
    try {
      const notifications = unwrap(await api.notifications.list());
      const unreadCount = notifications.filter((n) => !n.isRead).length;
      set({ notifications, unreadCount, loading: false });
    } catch (err) {
      console.error('[NotificationsStore] Failed to load:', err);
      set({ loading: false });
    }
  },

  refreshUnreadCount: async () => {
    try {
      const count = unwrap(await api.notifications.unreadCount());
      set({ unreadCount: count });
    } catch (err) {
      console.error('[NotificationsStore] Failed to refresh unread count:', err);
    }
  },

  markRead: async (id: string) => {
    try {
      await api.notifications.markRead(id);
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch (err) {
      console.error('[NotificationsStore] Failed to mark read:', err);
    }
  },

  markAllRead: async () => {
    try {
      await api.notifications.markAllRead();
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.error('[NotificationsStore] Failed to mark all read:', err);
    }
  },

  clearAll: async () => {
    try {
      await api.notifications.clearAll();
      set({ notifications: [], unreadCount: 0 });
    } catch (err) {
      console.error('[NotificationsStore] Failed to clear:', err);
    }
  },

  addNotification: (notification: Notification) => {
    set((s) => ({
      notifications: [notification, ...s.notifications],
      unreadCount: notification.isRead ? s.unreadCount : s.unreadCount + 1,
    }));
  },
}));
