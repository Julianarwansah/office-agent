---
id: chat-export-generator
title: Chat Export Content Generator
status: completed
complexity: low
mode: autopilot
intent: chat-history-export
---

## Description

Generate export content dari messages array.

## Acceptance Criteria

- [x] Function generateMarkdownExport(messages, chatroomName)
- [x] Function generateTextExport(messages, chatroomName)
- [x] Include frontmatter: chatroom name, export date, message count
- [x] Format pesan: timestamp, sender name, content
- [x] Handle tool calls (tampilkan sebagai code block)
- [x] Handle messages dengan parentId (thread) - tampilkan sebagai reply note

## Format Markdown

```markdown
---
chatroom: "Chatroom Name"
exported_at: "2026-06-23T10:00:00Z"
message_count: 42
---

# Chat History: Chatroom Name

## 2026-06-23 10:00 — You (User)

Message content here...

## 2026-06-23 10:05 — Agent Name (Agent)

Agent response here...
**Tool Call:** `tool_name`
```json
{ "args": {} }
```
```

## Implementation

- generateMarkdown(): Creates markdown dengan frontmatter YAML
- generateText(): Creates plain text dengan separator
- Tool calls ditampilkan sebagai code blocks
- Reply indicator untuk messages dengan parentId
- Sanitize filename untuk safe download

## Estimated Effort

1-2 hours (completed)
