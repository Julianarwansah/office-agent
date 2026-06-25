---
id: kanban-filter-drag-drop
title: Kanban Filter Drag & Drop Compatibility
status: completed
complexity: medium
mode: confirm
intent: kanban-filters-search
---

## Description

Pastikan drag & drop tetap berfungsi dengan baik saat filter aktif.

## Acceptance Criteria

- [x] Drag & drop tetap bisa digunakan saat filter aktif
- [x] Task yang di-drop tetap di-filter setelah move (jika masih match)
- [x] Visual feedback drag tetap jelas dengan task ter-filter
- [x] Task yang di-drag ke kolom lain: update status dan re-evaluate filter
- [x] Handle edge case: task yang di-move tidak lagi match filter (hilang dari view)

## Implementation

- Drag & drop menggunakan HTML5 drag API yang sudah ada
- TaskCard tetap draggable tanpa perubahan
- onMoveTask handler tetap sama, task di-move di backend
- filteredTasksByColumn otomatis update setelah tasks berubah (via useMemo)
- Task yang tidak match filter otomatis hilang dari view (dikembalikan oleh useMemo)

## Estimated Effort

1-2 hours (completed)
