---
id: msg-thread-chatroom-integration
title: ChatRoom Page Thread Integration
status: completed
complexity: medium
mode: confirm
intent: message-threads
---

## Description

Integrate thread functionality into ChatRoom page — wire up all components and handle thread state.

## Acceptance Criteria

- [x] ChatRoom manages thread expansion state (which threads are expanded)
- [x] Click reply button on MessageBubble → enters reply mode
- [x] Click "X replies" → expands/collapses thread view
- [x] Thread messages fetched via IPC when expanded
- [x] Send reply uses `message:sendReply` IPC (or chat.stream with parentMessageId)
- [x] Real-time: New thread replies appear automatically (via existing event system)
- [x] Scroll behavior: Auto-scroll to new reply in thread
- [x] Multiple threads can be expanded simultaneously

## Implementation

- Added state management:
  - `replyingTo: Message | null` - current reply target
  - `expandedThreads: Set<string>` - which threads are expanded
  - `threadReplies: Record<string, Message[]>` - cached replies
  - `replyCounts: Record<string, number>` - reply counts
- Added handlers:
  - `handleReplyClick` - set reply target
  - `handleToggleThread` - expand/collapse thread and load replies
  - `handleCancelReply` - exit reply mode
- Updated message rendering to filter parent messages only
- Added thread reply rendering below expanded messages
- Updated handleSend to support `parentMessageId` parameter
- Updated InputArea with reply mode props

## Estimated Effort

3-4 hours (completed)
