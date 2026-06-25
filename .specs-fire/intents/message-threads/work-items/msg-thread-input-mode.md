---
id: msg-thread-input-mode
title: InputArea Reply Mode Support
status: completed
complexity: medium
mode: confirm
intent: message-threads
---

## Description

Update InputArea component to support replying to a specific message (reply mode).

## Acceptance Criteria

- [x] Add reply mode state to InputArea
- [x] Show "Replying to..." indicator with parent message preview
- [x] Cancel reply button to exit reply mode
- [x] Send message as reply (include parent_message_id)
- [x] Auto-exit reply mode after sending
- [x] Keyboard shortcut: Escape to cancel reply
- [x] Reply indicator shows sender name and message snippet

## Implementation

- Added new props to InputArea:
  - `replyingTo?: Message | null` - message being replied to
  - `replyingToAgentName?: string` - name for display
  - `onCancelReply?: () => void` - cancel handler
- Modified `onSend` callback signature to include optional `parentMessageId`
- Added reply indicator bar with message preview and cancel button
- Escape key now cancels reply mode

## Estimated Effort

2-3 hours (completed)
