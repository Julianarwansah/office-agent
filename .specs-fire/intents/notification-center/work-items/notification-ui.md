---
id: notification-ui
title: Notification Bell UI in TopBar
intent: notification-center
complexity: medium
mode: confirm
status: completed
depends_on:
  - notification-store
created: 2026-06-25T09:00:00Z
run_id: run-office-agent-005
completed_at: 2026-06-25T08:58:05.168Z
---

# Work Item: Notification Bell UI in TopBar

## Description

Tambah Bell icon dengan badge di TopBar dan dropdown panel notifikasi.

## Acceptance Criteria

- [ ] Bell icon di TopBar (sebelah theme toggle)
- [ ] Red badge dengan jumlah unread
- [ ] Klik bell → buka dropdown panel
- [ ] Panel menampilkan list notifikasi (max 20 terbaru)
- [ ] Klik notifikasi → navigate ke chatroom terkait + mark as read
- [ ] "Mark all read" button
- [ ] "Clear all" button
- [ ] Empty state jika tidak ada notifikasi
- [ ] Real-time update tanpa refresh

## Technical Notes

- Modify `src/renderer/components/TopBar.tsx`
- Buat komponen `NotificationPanel.tsx` di `src/renderer/components/`
- Gunakan existing UI components (Button, Modal dari `src/renderer/components/ui/`)
- Icon: `Bell` dari lucide-react
- Badge: gunakan pattern yang sudah ada di Sidebar (`badge-neutral`)

## Dependencies

notification-store
