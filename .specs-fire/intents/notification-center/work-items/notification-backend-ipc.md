---
id: notification-backend-ipc
title: Notification Backend IPC Handlers
intent: notification-center
complexity: low
mode: autopilot
status: completed
depends_on:
  - notification-db-schema
created: 2026-06-25T09:00:00Z
run_id: run-office-agent-005
completed_at: 2026-06-25T08:51:56.051Z
---

# Work Item: Notification Backend IPC Handlers

## Description

Buat IPC handlers untuk CRUD notifikasi dan event listener yang listen ke orchestrator event bus.

## Acceptance Criteria

- [ ] IPC channel: `notifications:list`, `notifications:unread-count`, `notifications:mark-read`, `notifications:mark-all-read`, `notifications:clear-all`, `notifications:create`
- [ ] Event listener di orchestrator yang create notifikasi saat `agent:done`, `agent:error`
- [ ] Semua handler return `ApiResponse<T>`
- [ ] Expose di preload `api.notifications.*`

## Technical Notes

- IPC handler pattern: `src/main/ipc/notifications.ts`
- Register di `src/main/ipc/index.ts`
- Preload expose: `src/preload/api.ts`
- Listen event bus: `this.eventBus.on('agent:done', ...)` di orchestrator init
- Event types: `src/shared/types.ts` — tambah `IPC_CHANNELS.NOTIFICATIONS`

## Dependencies

notification-db-schema
