---
id: msg-thread-backend-ipc
title: Backend IPC Handlers for Thread Operations
status: completed
complexity: low
mode: autopilot
intent: message-threads
---

## Description

Create IPC handlers for thread-related operations (get replies, send reply to thread).

## Acceptance Criteria

- [x] New IPC channel: `message:getThread` — Get all replies for a parent message
- [x] New IPC channel: `message:sendReply` — Send a reply to a specific message
- [x] Handler implementation in `src/main/ipc/messages.ts`
- [x] Update `src/shared/types.ts` with new IPC channel types
- [x] Repository methods wired to IPC handlers
- [x] Error handling for invalid parent_message_id
- [x] Expose to renderer via `src/preload/preload.ts`
- [x] Update `src/preload/api.ts` type definitions

## Implementation

- Added `MESSAGE.GET_THREAD` and `MESSAGE.SEND_REPLY` to IPC_CHANNELS
- Implemented handlers in `src/main/ipc/messages.ts`
- Updated preload API with `getThread` and `sendReply` methods

## Estimated Effort

1-2 hours (completed)
