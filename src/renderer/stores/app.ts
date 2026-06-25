import { create } from 'zustand';
import type { AppSettings, AppTheme } from '../../shared/types';
import { api, unwrap } from '../lib/api';
import type { SystemInfo } from '../lib/types';

interface AppState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;

  systemInfo: SystemInfo | null;
  loadSystemInfo: () => Promise<void>;
  localhostUrl: string | null;
  loadLocalhostUrl: () => Promise<void>;

  appSettings: AppSettings | null;
  loadSettings: () => Promise<void>;
  saveSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

const DEFAULT_THEME: AppTheme = 'system';

function applyTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const effective =
    theme === 'system'
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light')
      : theme;
  root.classList.toggle('dark', effective === 'dark');
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: DEFAULT_THEME,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    get().saveSettings({ theme }).catch((err) => console.error('[AppStore] Failed to save theme:', err));
  },

  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  currentPage: 'Dashboard',
  setCurrentPage: (currentPage) => set({ currentPage }),

  systemInfo: null,
  loadSystemInfo: async () => {
    try {
      const info = unwrap(await api.system.getInfo());
      set({ systemInfo: info });
    } catch (err) {
      console.error('Failed to load system info:', err);
    }
  },

  localhostUrl: null,
  loadLocalhostUrl: async () => {
    try {
      const url = unwrap(await api.system.getLocalhostUrl());
      set({ localhostUrl: url });
    } catch (err) {
      console.error('Failed to load localhost URL:', err);
    }
  },

  appSettings: null,
  loadSettings: async () => {
    try {
      const settings = unwrap(await api.settings.getApp());
      set({ appSettings: settings, theme: settings.theme ?? DEFAULT_THEME });
      applyTheme(settings.theme ?? DEFAULT_THEME);
    } catch (err) {
      console.error('Failed to load app settings:', err);
    }
  },
  saveSettings: async (partial) => {
    try {
      const merged = await unwrap(await api.settings.saveApp(partial));
      set({ appSettings: merged });
      if (partial.theme !== undefined) {
        applyTheme(partial.theme);
      }
    } catch (err) {
      console.error('Failed to save app settings:', err);
      throw err;
    }
  },
}));

if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', () => {
    const { theme } = useAppStore.getState();
    if (theme === 'system') applyTheme('system');
  });
}