---
id: chat-search
title: Chat Search — Cari pesan dalam history chatroom
status: in_progress
created: 2026-06-23T00:00:00Z
---

# Intent: Chat Search

## Goal

Tambah fitur search dalam history pesan di ChatRoom dan AgentChats. Backend (message:search IPC) sudah ada, tinggal UI.

## Success Criteria

- Search panel muncul saat klik ikon search di header chat
- Query dikirim ke api.messages.search, hasil tampil di panel
- Klik hasil → scroll ke pesan yang dimaksud (highlight)
- Tekan Esc atau klik X untuk tutup panel
