---
id: chat-export-ui
title: Chat Export Button & Dialog
status: completed
complexity: low
mode: autopilot
intent: chat-history-export
---

## Description

Tambahkan export button di ChatRoom dan dialog untuk memilih format export.

## Acceptance Criteria

- [x] Export button di header ChatRoom (icon Download)
- [x] Export dialog/modal dengan pilihan format
- [x] Format options: Markdown (default), Plain Text
- [x] Button "Export" dan "Cancel"
- [x] Dark mode support
- [x] Export button disabled saat tidak ada pesan

## Implementation

- Added export button di header (sebelah search button)
- Created ExportChatModal component
- Format selection dengan visual feedback
- Export button disabled saat activeMessages.length === 0

## Estimated Effort

1-2 hours (completed)
