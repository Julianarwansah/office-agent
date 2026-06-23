---
id: agent-management
title: Agent Management — Duplicate, Export, Import
status: in_progress
created: 2026-06-23T00:00:00Z
---

# Intent: Agent Management — Duplicate, Export, Import

## Goal

Tambahkan tiga kemampuan manajemen agent: duplicate (copy agent), export (unduh JSON), dan import (upload JSON).

## Users

Pengguna yang mengelola banyak agent dan ingin bisa clone, backup, atau share konfigurasi agent.

## Problem

Saat ini tidak ada cara untuk menduplikasi agent, menyimpan konfigurasinya ke file, atau memuat dari file. Membuat agent baru selalu dari awal.

## Success Criteria

- Tombol Duplicate di halaman Agents menghasilkan agent baru bernama "Copy of {nama}"
- Tombol Export mengunduh file `{agent-name}.json` berisi konfigurasi lengkap
- Tombol Import membuka file picker, memvalidasi JSON, dan membuat agent baru
- TypeScript bersih, tidak ada regression

## Constraints

- Export hanya menyertakan konfigurasi agent (bukan memories atau chat history)
- Import validasi field wajib sebelum create
- Duplicate tidak meng-copy skills yang disable
- Agent yang di-import mendapat ID baru

## Notes

IPC channels sudah terdefinisi di shared/types.ts: AGENT.DUPLICATE, AGENT.EXPORT, AGENT.IMPORT
