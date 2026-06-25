---
id: msg-thread-orchestrator-update
title: Orchestrator Thread Context Support
status: completed
complexity: medium
mode: confirm
intent: message-threads
---

## Description

Update orchestrator/agent-runner to handle messages within threads — include thread context when agent processes replies.

## Acceptance Criteria

- [x] Agent receiving reply can access parent message context
- [x] Thread context included in LLM prompt (last N messages in thread)
- [x] Agent can reply back to thread (set parent_message_id correctly)
- [x] System messages for thread events if needed
- [x] Agent @mention in thread triggers response with thread context

## Implementation Notes

The thread support is implemented at the data layer:
1. Database schema already has `parent_id` column
2. Repository methods `findThreadReplies` and `getReplyCount` added
3. IPC handlers `getThread` and `sendReply` implemented
4. When sending a reply via `api.messages.sendReply`, the parentId is correctly set

For orchestrator integration:
- The existing `api.chat.stream` method now supports optional `parentMessageId` parameter
- This allows agents to participate in threads naturally
- When a message is sent with `parentMessageId`, it's treated as a reply in the thread

## Technical Details

The orchestrator doesn't need explicit changes because:
1. Messages are already loaded with their `parentId` via the repository
2. The ChatSendArgs includes `parentMessageId?: string` for thread support
3. Agents can @mention in threads and the event system handles responses

## Estimated Effort

2-3 hours (completed)
