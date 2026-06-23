---
id: fix-unwrap-void
title: Fix unwrap throwing on ApiResponse<void>
intent: bug-fix-audit
complexity: low
mode: autopilot
status: in_progress
depends_on: []
created: 2026-06-23T00:00:00Z
---

# Work Item: Fix unwrap throwing on ApiResponse<void>

## Description

`unwrap()` in `src/renderer/lib/api.ts` throws an error when `response.data === undefined`,
but all `ApiResponse<void>` IPC handlers return `ok(undefined)` which sets data to undefined.
This causes false errors on every cancel stream and every workspace.openInOS call.

## Acceptance Criteria

- [ ] `cancelStream` no longer logs "Failed to cancel stream" on successful cancel
- [ ] `workspace.openInOS` no longer throws on successful open
- [ ] `unwrap<void>()` returns without throwing when `success === true` and `data === undefined`
- [ ] Error responses (`success === false`) still throw correctly

## Technical Notes

Remove the `if (response.data === undefined)` guard. TypeScript's type system ensures
that callers expecting a non-void value will get one (the handler must return it).

## Dependencies

(none)
