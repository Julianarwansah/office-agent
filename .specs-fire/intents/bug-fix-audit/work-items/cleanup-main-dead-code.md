---
id: cleanup-main-dead-code
title: Remove dead code and duplicate comment in main/index.ts
intent: bug-fix-audit
complexity: low
mode: autopilot
status: pending
depends_on: []
created: 2026-06-23T00:00:00Z
---

# Work Item: Remove dead code and duplicate comment in main/index.ts

## Description

`src/main/index.ts` contains:
1. `windowManagerRef()` function that is defined but never called
2. The Electron API resolution comment block appears twice (lines 26-58)

## Acceptance Criteria

- [ ] `windowManagerRef()` function removed
- [ ] Duplicate comment block removed (keep one copy)
- [ ] `tsc` compiles without errors

## Technical Notes

The duplicate comment is between lines 26-58. The function `windowManagerRef` is at
approximately line 256-261.

## Dependencies

(none)
