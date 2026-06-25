---
id: notification-db-schema
title: Notifications Database Schema
intent: notification-center
complexity: low
mode: autopilot
status: completed
depends_on: []
created: 2026-06-25T09:00:00Z
run_id: run-office-agent-005
completed_at: 2026-06-25T08:44:32.307Z
---

# Work Item: Notifications Database Schema

## Description

Tambah tabel `notifications` di SQLite database untuk menyimpan notifikasi.

## Acceptance Criteria

- [ ] Tabel `notifications` ada di schema
- [ ] Columns: id, type, title, message, chatroomId, agentId, isRead, createdAt
- [ ] Index on `isRead` dan `createdAt` untuk query cepat
- [ ] Migration tidak menghapus data existing

## Technical Notes

- Ikuti pattern di `src/main/db/index.ts` — tambah CREATE TABLE + migration
- Type enum: `agent_done`, `agent_error`, `agent_input_needed`, `info`
- Repository pattern di `src/main/db/repositories/notifications.ts`

## Dependencies

(none)
