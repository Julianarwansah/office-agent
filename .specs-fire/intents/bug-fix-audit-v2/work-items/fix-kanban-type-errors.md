---
id: fix-kanban-type-errors
title: Fix Kanban.tsx useRef Import + Type Errors
intent: bug-fix-audit-v2
complexity: low
mode: autopilot
status: completed
depends_on: []
created: 2026-06-25T07:00:00Z
run_id: run-office-agent-004
completed_at: 2026-06-25T08:29:12.560Z
---

# Work Item: Fix Kanban.tsx useRef Import + Type Errors

## Description

Di `src/renderer/pages/Kanban.tsx`:
1. `useRef` tidak di-import (line 1) tapi dipakai di line 268 → runtime crash
2. 10 type errors: icon type mismatch, onChange type mismatch, `isFiltered` type mismatch

## Acceptance Criteria

- [ ] `useRef` di-import dari React
- [ ] `tsc --noEmit` tidak error di Kanban.tsx (0 errors)
- [ ] Kanban page mount tanpa crash
- [ ] Filter dropdown berfungsi normal

## Technical Notes

- Tambah `useRef` ke import React
- `FilterDropdownProps.icon`: widen type ke `React.ComponentType<{size?: string | number; className?: string}>`
- `FilterDropdownProps.onChange`: widen ke `(selected: string[]) => void` (sudah benar)
- `isFiltered={hasActiveFilters}`: gunakan `!!hasActiveFilters`

## Dependencies

(none)
