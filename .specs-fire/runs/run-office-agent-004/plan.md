# Run Plan: run-office-agent-004

## Scope: batch

### Work Item 1: fix-chatroom-reply-crash

**Goal**: Fix undefined `set` crash in ChatRoom.tsx:150

**Changes**:
- `src/renderer/pages/ChatRoom.tsx:150` — Replace `set((s) => {...})` with proper Zustand store update using `useChatRoomsStore.setState(...)`

**Verification**: `npx tsc --noEmit` no errors in ChatRoom.tsx

### Work Item 2: fix-kanban-type-errors

**Goal**: Fix missing useRef import and all type errors in Kanban.tsx

**Changes**:
- `src/renderer/pages/Kanban.tsx:1` — Add `useRef` to React import
- `src/renderer/pages/Kanban.tsx:258` — Widen icon prop type
- `src/renderer/pages/Kanban.tsx:901` — Fix `isFiltered` type with `!!`

**Verification**: `npx tsc --noEmit` no errors in Kanban.tsx

### Work Item 3: improve-silent-error-handling

**Goal**: Add logging to silent catch blocks

**Changes**:
- `src/renderer/stores/app.ts:44` — Log error in `.catch()`
- `src/renderer/stores/skills.ts:75` — Log error in `.catch()`
- `src/main/llm/client.ts:143,339` — Log error in catch
- `src/main/llm/provider-manager.ts:70,104,142` — Log error in catch

**Verification**: All catch blocks log errors to console
