/**
 * WindowManager — owns the single main BrowserWindow for the application.
 *
 * Exposes a singleton, IPC forward helpers, and a tiny `loadURL()` that
 * picks between the Vite dev server and the built renderer bundle.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { BrowserWindow, shell } from 'electron';
import { createLogger } from '../utils/logger';

const log = createLogger('window');

const PRELOAD_PATH = path.join(__dirname, '..', '..', 'preload', 'preload.js');

function resolveIconPath(): string | null {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'icon.png'),
    path.join(__dirname, '..', '..', 'resources', 'icon.png'),
    path.join(process.cwd(), 'resources', 'icon.png'),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function resolveRendererEntry(): string {
  // In dev (no dist-renderer yet) → Vite. In packaged builds → dist-renderer/index.html.
  const devUrl = process.env.VITE_DEV_SERVER_URL ?? process.env.OFFICE_AI_DEV_URL;
  if (devUrl) return devUrl;
  const candidates = [
    path.join(__dirname, '..', '..', 'dist-renderer', 'index.html'),
    path.join(process.resourcesPath ?? '', 'app', 'dist-renderer', 'index.html'),
    path.join(process.cwd(), 'dist-renderer', 'index.html'),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  // Final fallback to Vite dev default.
  return 'http://localhost:5173';
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  createMainWindow(): BrowserWindow {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }

    const iconPath = resolveIconPath();
    const window = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: 'Office AI Agent',
      backgroundColor: '#0f172a',
      show: false,
      autoHideMenuBar: true,
      ...(iconPath ? { icon: iconPath } : {}),
      webPreferences: {
        preload: PRELOAD_PATH,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: true,
        devTools: true,
      },
    });

    window.once('ready-to-show', () => {
      try { window.show(); } catch (err) { log.warn('failed to show window', err); }
      log.info('main window shown');
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      // Always open external links in the user's browser, never inside the app.
      void shell.openExternal(url);
      return { action: 'deny' };
    });

    window.webContents.on('will-navigate', (event, navUrl) => {
      const target = resolveRendererEntry();
      if (!navUrl.startsWith(target) && !navUrl.startsWith('http://localhost:5173')) {
        event.preventDefault();
        void shell.openExternal(navUrl);
      }
    });

    window.on('close', (event) => {
      // Allow close unless we're quitting the app — quit path uses
      // `before-quit` to flush DB / server.
      log.debug('window close event');
      void event;
    });

    window.on('closed', () => {
      log.info('window closed');
      if (this.mainWindow === window) this.mainWindow = null;
    });

    this.mainWindow = window;
    this.loadURL(window);
    return window;
  }

  getWindow(): BrowserWindow | null {
    return this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : null;
  }

  sendToRenderer(channel: string, data: unknown): void {
    const win = this.getWindow();
    if (!win) return;
    try {
      win.webContents.send(channel, data);
    } catch (err) {
      log.warn(`failed to send on ${channel}`, err);
    }
  }

  loadURL(target?: BrowserWindow): void {
    const win = target ?? this.getWindow();
    if (!win) return;
    const entry = resolveRendererEntry();
    const isDev = entry.startsWith('http://') || entry.startsWith('https://');
    if (isDev) {
      log.info(`loading dev URL: ${entry}`);
      void win.loadURL(entry);
    } else {
      const fileUrl = pathToFileUrl(entry);
      log.info(`loading file URL: ${fileUrl}`);
      void win.loadURL(fileUrl);
    }
  }
}

function pathToFileUrl(p: string): string {
  let normalized = p.replace(/\\/g, '/');
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  return 'file://' + encodeURI(normalized);
}

let singleton: WindowManager | null = null;

export function getWindowManager(): WindowManager {
  if (!singleton) singleton = new WindowManager();
  return singleton;
}

export function setWindowManager(mgr: WindowManager | null): void {
  singleton = mgr;
}