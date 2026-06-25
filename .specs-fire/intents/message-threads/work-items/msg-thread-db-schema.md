---
id: msg-thread-db-schema
title: Database Schema Migration for Thread Support
status: completed
complexity: low
mode: autopilot
intent: message-threads
---

## Description

Add database support for message threads by adding indexes and repository methods.

## Acceptance Criteria

- [x] Migration file created: `005_thread_support`
- [x] Add indexes for thread queries:
  - `idx_messages_parent` on `parent_id`
  - `idx_messages_thread` on `(parent_id, created_at)`
  - `idx_messages_has_replies` for covering index
- [x] Update `MessageRepository` with methods:
  - `findThreadReplies(parentMessageId: string): Message[]`
  - `getReplyCount(parentMessageId: string): number`
  - `findByChatRoomWithThreads(chatRoomId: string, ...)`
- [x] Update TypeScript types in `src/shared/types.ts` if needed

## Implementation

- Migration added to `src/main/db/index.ts`
- Repository methods added to `src/main/db/repositories/messages.ts`

## Estimated Effort

1-2 hours (completed)
