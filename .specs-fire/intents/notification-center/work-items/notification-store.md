---
id: notification-store
title: Notification Zustand Store
intent: notification-center
complexity: low
mode: autopilot
status: completed
depends_on:
  - notification-backend-ipc
created: 2026-06-25T09:00:00Z
run_id: run-office-agent-005
completed_at: 2026-06-25T08:56:04.530Z
---

# Work Item: Notification Zustand Store

## Description

Buat Zustand store untuk state notifikasi di renderer process.

## Acceptance Criteria

- [ ] Store `useNotificationsStore` dengan: notifications[], unreadCount, loading
- [ ] Actions: loadNotifications, markRead, markAllRead, clearAll, addNotification
- [ ] Subscribe ke orchestrator event untuk real-time notification
- [ ] Auto-refresh unread count

## Technical Notes

- File: `src/renderer/stores/notifications.ts`
- Subscribe orchestrator events via `api.orchestrator.on(...)` di useEffect
- Pattern sama dengan `src/renderer/stores/chatrooms.ts`

## Dependencies

notification-backend-ipc
