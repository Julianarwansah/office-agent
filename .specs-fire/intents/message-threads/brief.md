---
id: message-threads
title: Message Thread/Replies
status: in_progress
created: 2026-06-23T00:00:00Z
---

# Intent: Message Thread/Replies

## Goal

Menambahkan kemampuan reply ke pesan spesifik dalam chat, menciptakan thread terpisah untuk diskusi yang lebih terstruktur tanpa mengganggu alur chat utama.

## Users

User yang chatting dengan agent atau dalam grup chatroom di Office AI Agent.

## Problem

Saat ini chat bersifat flat — semua pesan sequential. Jika ada beberapa topik sekaligus dalam satu chatroom, chat menjadi sulit diikuti. Tidak ada cara untuk melanjutkan diskusi spesifik tanpa mengganggu alur utama chat. Pesan-pesan terkait satu topik tercampur dengan pesan lainnya.

## Success Criteria

- User bisa reply ke pesan apapun dengan tombol/memu reply
- Thread ditampilkan inline (expand/collapse) di bawah pesan asli
- Reply bersifat flat (satu level, tidak nested) — reply ke reply tetap di level yang sama
- Pesan dengan reply menampilkan "X replies" indicator yang bisa diklik
- Thread bisa di-expand dan di-collapse
- Agent juga bisa reply dalam thread (jika di-mention atau context mengarah ke thread)
- Reply menggunakan input area yang sama dengan pesan biasa (mode reply aktif)
- Thread replies muncul real-time via existing event system

## Constraints

- Harus kompatibel dengan struktur database `messages` yang sudah ada (gunakan parent_message_id)
- Tidak mengubah flow chat yang sudah berjalan (backward compatible)
- UI harus konsisten dengan design system existing (Tailwind + komponen yang ada)
- Tidak membuat UI menjadi cluttered — thread harus compact
- Support dark mode

## Notes

- Reference UI: Slack threads (inline), Discord replies (compact), WhatsApp replies
- Parent message tidak perlu pindah ke thread — tetap di chat utama
- Notification untuk replies bisa di-follow-up di iterasi berikutnya
- Thread depth: flat (1 level) untuk simplicity
