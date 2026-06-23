---
id: fix-orchestrator-event-types
title: Align OrchestratorEventMap between main and renderer
intent: bug-fix-audit
complexity: low
mode: autopilot
status: pending
depends_on: []
created: 2026-06-23T00:00:00Z
---

# Work Item: Align OrchestratorEventMap between main and renderer

## Description

The OrchestratorEventMap in `src/main/orchestrator/types.ts` (producer) does not match
the one in `src/shared/types.ts` and `src/preload/api.ts` (consumer).

Mismatches:
- `memory:used`: main emits `{ agentId, memoryIds: string[] }`, types say `{ agentId, memories: Memory[] }`
- `memory:created`: main emits `{ agentId, memories: Memory[] }`, types say `{ agentId, memory: Memory }` (singular)

## Acceptance Criteria

- [ ] `shared/types.ts` OrchestratorEventMap matches what main actually emits
- [ ] `preload/api.ts` OrchestratorEventMap matches `shared/types.ts`
- [ ] `tsc` compiles without errors after the change

## Technical Notes

Fix by updating shared/types.ts and preload/api.ts to reflect what main actually emits:
- `memory:used` → `{ agentId: string; memoryIds: string[] }`
- `memory:created` → `{ agentId: string; memories: Memory[] }` (plural, matching main)

## Dependencies

(none)
