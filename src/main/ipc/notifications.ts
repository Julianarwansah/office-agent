/**
 * IPC handlers for notifications.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse, Notification } from '../../shared/types';
import { notificationsRepo } from '../db/repositories/notifications';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:notifications');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export function registerNotificationHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.NOTIFICATIONS.LIST, async (): Promise<ApiResponse<Notification[]>> => {
    try {
      const notifications = notificationsRepo.list();
      return ok(notifications);
    } catch (err) {
      log.error('list', err);
      return fail('Failed to list notifications');
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTIFICATIONS.UNREAD_COUNT, async (): Promise<ApiResponse<number>> => {
    try {
      const count = notificationsRepo.unreadCount();
      return ok(count);
    } catch (err) {
      log.error('unreadCount', err);
      return fail('Failed to get unread count');
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTIFICATIONS.MARK_READ, async (_evt, id: string): Promise<ApiResponse<void>> => {
    try {
      notificationsRepo.markRead(id);
      return ok(undefined);
    } catch (err) {
      log.error('markRead', err);
      return fail('Failed to mark notification as read');
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTIFICATIONS.MARK_ALL_READ, async (): Promise<ApiResponse<void>> => {
    try {
      notificationsRepo.markAllRead();
      return ok(undefined);
    } catch (err) {
      log.error('markAllRead', err);
      return fail('Failed to mark all as read');
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTIFICATIONS.CLEAR_ALL, async (): Promise<ApiResponse<void>> => {
    try {
      notificationsRepo.clearAll();
      return ok(undefined);
    } catch (err) {
      log.error('clearAll', err);
      return fail('Failed to clear notifications');
    }
  });

  log.info('notification handlers registered');
}
