# Walkthrough: run-office-agent-004 — Bug Fix & Type Error Audit v2

## Overview

Batch run fixing 13 TypeScript errors and 2 runtime crash bugs across ChatRoom and Kanban features.

## Changes

### 1. ChatRoom.tsx — Reply Crash Fix

**Before** (line 150):
```tsx
set((s) => {
  const existing = s.messagesByRoom[effectiveId] ?? [];
  return { messagesByRoom: { ...s.messagesByRoom, [effectiveId]: [...existing, reply] } };
});
```

**After**:
```tsx
useChatRoomsStore.setState((s) => {
  const existing = s.messagesByRoom[effectiveId] ?? [];
  return { messagesByRoom: { ...s.messagesByRoom, [effectiveId]: [...existing, reply] } };
});
```

**Why**: `set` was undefined — Zustand's `setState` must be called on the store object.

### 2. Kanban.tsx — Type Safety Fixes

| Fix | Line | Description |
|-----|------|-------------|
| `useRef` import | 1 | Added to React import — was causing ReferenceError |
| Icon prop type | 258, 359 | Widened `size?: number` → `size?: string \| number` for Lucide compatibility |
| Filter state | 585-586 | Changed from `KanbanTaskStatus[]`/`KanbanTaskPriority[]` to `string[]` to match FilterDropdown |
| `hasActiveFilters` | 665 | Wrapped in `!!` to convert `string \| boolean` → `boolean` |
| `STATUS_LABEL` key | 855 | Cast `s as KanbanTaskStatus` for type-safe record access |

### 3. Silent Error Handling

Added logging to:
- `stores/app.ts:44` — theme save failure
- `stores/skills.ts:75` — user skills load failure
- `main/llm/provider-manager.ts:70,105,144` — API key decryption failures

## Files Modified

| File | Changes |
|------|---------|
| `src/renderer/pages/ChatRoom.tsx` | 1 line — Zustand setState fix |
| `src/renderer/pages/Kanban.tsx` | 5 changes — import, types, casts |
| `src/renderer/stores/app.ts` | 1 line — error logging |
| `src/renderer/stores/skills.ts` | 1 line — error logging |
| `src/main/llm/provider-manager.ts` | 3 lines — error logging |

## Verification

```
$ npx tsc --noEmit
# 0 errors
```
