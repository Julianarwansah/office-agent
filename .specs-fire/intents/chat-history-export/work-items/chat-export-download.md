---
id: chat-export-download
title: Chat Export File Download
status: completed
complexity: low
mode: autopilot
intent: chat-history-export
---

## Description

Trigger download file ke browser.

## Acceptance Criteria

- [x] Function downloadFile(content, filename, mimeType)
- [x] Filename format: `{chatroom-name}_{YYYY-MM-DD}.{ext}`
- [x] Sanitize filename (remove special chars, spaces → underscore)
- [x] MIME type: text/markdown atau text/plain
- [x] Auto-trigger download menggunakan Blob URL
- [x] Cleanup Blob URL setelah download

## Technical Notes

- Using Blob API untuk create file
- Create anchor element dengan download attribute
- Trigger click programmatically
- Cleanup dengan URL.revokeObjectURL

## Implementation

- sanitizeFilename(): lowercase, replace special chars dengan underscore
- Blob creation dengan mime type yang sesuai
- Auto-download via anchor element
- Cleanup setelah download

## Estimated Effort

30 minutes - 1 hour (completed)
