---
id: notification-center
title: Notification Center
status: completed
created: 2026-06-25T09:00:00Z
completed_at: 2026-06-25T08:58:38.953Z
---

# Intent: Notification Center

## Goal

Sistem notifikasi real-time untuk memberi tahu user tentang aktivitas agent — selesai, error, butuh input, atau event penting lainnya.

## Users

Developer (owner project) yang menggunakan agent untuk tugas-tugas.

## Problem

Sekarang user tidak tau kapan agent selesai, error, atau butuh input. Harus cek manual ke chatroom satu per satu. Ini tidak scalable ketika ada banyak agent dan chatroom.

## Success Criteria

- Bell icon di TopBar dengan unread count badge
- Dropdown panel menampilkan notifikasi terbaru
- Klik notifikasi → navigate ke chatroom/page terkait
- Notifikasi otomatis dibuat saat: agent done, agent error, agent butuh input
- Mark as read / mark all as read
- Clear all notifikasi

## Constraints

- Tidak mengubah fitur existing — hanya menambah
- Minimal perubahan di orchestrator — hook ke event bus yang sudah ada
- Persistensi di SQLite (sudah ada di project)

## Notes

Event bus sudah ada di `src/main/orchestrator/event-bus.ts` dengan events: `agent:start`, `agent:done`, `agent:error`, dll. Tinggal listen dan buat notifikasi.
