---
id: msg-thread-message-bubble
title: MessageBubble Thread UI Enhancement
status: completed
complexity: medium
mode: confirm
intent: message-threads
---

## Description

Update MessageBubble component to support thread display and reply action.

## Acceptance Criteria

- [x] Add reply button to MessageBubble (hover state atau selalu visible)
- [x] Add "X replies" indicator below message if has replies
- [x] Click on "X replies" expands thread view inline
- [x] Thread view shows nested replies below parent message
- [x] Each reply in thread has compact styling (smaller avatar, less padding)
- [x] Thread can be collapsed back
- [x] Visual indicator linking parent message to thread
- [x] Support dark mode

## Implementation

- Added new props to MessageBubble:
  - `isInThread?: boolean` - compact mode for thread replies
  - `replyCount?: number` - number of replies indicator
  - `threadReplies?: Message[]` - replies for avatar preview
  - `isThreadExpanded?: boolean` - expand/collapse state
  - `onReplyClick?: () => void` - reply handler
  - `onToggleThread?: () => void` - expand/collapse handler
- Added Reply button to action bar
- Added thread indicator with reply count and participant avatars
- Compact styling for thread replies (smaller avatars)

## Estimated Effort

3-4 hours (completed)
