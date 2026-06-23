# Coding Standards

## Overview

TypeScript strict across all files. Renderer and main process are separate compilation units. All cross-process calls go through IPC — never import Node.js APIs directly in the renderer.

## Code Formatting

**Tool**: TypeScript compiler (tsc) — no separate formatter configured
**Config**: `tsconfig.json` / `tsconfig.main.json`
**Enforcement**: Build-time type errors block compilation

### Key Settings

- **strict**: true
- **target**: ESNext
- **moduleResolution**: Bundler (renderer) / Node (main)

## Linting

**Tool**: TypeScript strict
**Base Config**: `tsconfig.json`
**Strictness**: Strict (no implicit any, strict null checks)

### Key Rules

- `noImplicitAny`: error — all types must be explicit
- `strictNullChecks`: error — handle null/undefined explicitly
- `no-unused-vars`: all unused vars must be prefixed `_` or removed

## Naming Conventions

### Variables and Functions

| Element | Convention | Example |
|---------|------------|---------|
| Variables | camelCase | `chatSession` |
| Functions | camelCase | `sendMessage()` |
| React components | PascalCase | `ChatRoom` |
| Types / Interfaces | PascalCase | `ApiResponse<T>` |
| Constants | SCREAMING_SNAKE or camelCase | `MAX_TOKENS` |
| Zustand stores | camelCase hook | `useChatStore` |
| IPC channels | kebab-case string | `'chat:send-message'` |

### Files and Folders

- **React components**: PascalCase (e.g., `ChatRoom.tsx`)
- **Pages**: PascalCase (e.g., `OrgChart.tsx`)
- **IPC handlers**: kebab-case (e.g., `chat-handler.ts`)
- **Repositories**: kebab-case (e.g., `chat-repository.ts`)
- **Stores**: camelCase with "Store" suffix (e.g., `chatStore.ts`)
- **Utilities**: camelCase (e.g., `promptBuilder.ts`)

## File Organization

### Project Structure

```
src/
├── main/           # Electron main process (Node.js)
│   ├── db/         # SQLite schema, migrations, repositories
│   ├── ipc/        # IPC handlers (one file per domain)
│   ├── llm/        # LLM provider, prompt builder
│   ├── orchestrator/ # Agent runner
│   └── skills/     # Built-in and user skills
├── renderer/       # React app (Vite/Chromium)
│   ├── components/ # Shared React components
│   ├── pages/      # Route-level page components
│   └── stores/     # Zustand stores
├── preload/        # contextBridge API exposure
└── shared/         # Types shared between main and renderer
```

### Conventions

- **IPC boundary**: Renderer never imports from `src/main/`. Always use `window.officeAPI`.
- **Shared types**: All shared types go in `src/shared/types.ts`.
- **One handler per domain**: `src/main/ipc/chat-handler.ts`, `src/main/ipc/agent-handler.ts`, etc.
- **One repository per table/domain**: `src/main/db/repositories/`.

## Import Order

```typescript
// 1. Node built-ins (main process only)
import path from 'path'
import fs from 'fs'

// 2. Third-party
import { ipcMain } from 'electron'
import { create } from 'zustand'

// 3. Internal — shared
import type { ApiResponse } from '@shared/types'

// 4. Internal — same process
import { db } from '../db'
import { ChatRepository } from '../db/repositories/chat-repository'
```

**Rules**:
- Node built-ins first (main process only)
- Third-party packages second
- Internal shared types third
- Local imports last
- No barrel imports that cross the IPC boundary

## Error Handling

### Pattern

**Approach**: All IPC handlers return `ApiResponse<T>` — `{ success: true, data: T }` or `{ success: false, error: string }`. Renderer calls `unwrap()` to get data or throw.

### Guidelines

- Never throw uncaught errors across IPC — always wrap in `ApiResponse`
- Log errors in main process before returning error response
- Don't swallow errors silently; always surface them to the caller
- Renderer: handle loading/error states in UI, don't assume success

### Example

```typescript
// Main process handler
ipcMain.handle('chat:send-message', async (_, payload) => {
  try {
    const result = await chatRepo.insert(payload)
    return { success: true, data: result }
  } catch (err) {
    console.error('[chat:send-message]', err)
    return { success: false, error: String(err) }
  }
})

// Renderer
const msg = await window.officeAPI.chat.sendMessage(payload).then(unwrap)
```

## Logging

**Tool**: `console.error` / `console.log` (main process)
**Format**: `[channel-or-module] message`

### Log Levels

| Level | Usage |
|-------|-------|
| `console.error` | Caught exceptions, IPC handler failures |
| `console.warn` | Unexpected but non-fatal state |
| `console.log` | Dev-time tracing (remove before commit) |

### Guidelines

**Always log**:
- IPC handler errors before returning error response
- LLM API failures with model/provider info

**Never log**:
- API keys, tokens, or user credentials
- Full message content in production paths

## Comments and Documentation

### When to Comment

- Only when the WHY is non-obvious
- Hidden constraints or subtle invariants
- Workarounds for specific bugs or Electron quirks
- Behavior that would surprise a reader

### Documentation Format

**Functions**: No docstrings unless the function is part of a public API surface
**Classes**: No class-level comments unless the class has non-obvious invariants

## Code Patterns

### Preferred Patterns

#### IPC Handler Registration

All handlers registered in domain files, imported by `src/main/index.ts`.

```typescript
export function registerChatHandlers() {
  ipcMain.handle('chat:get-rooms', (_, agentId) =>
    wrapResult(() => chatRepo.getRoomsByAgent(agentId))
  )
}
```

#### Zustand Store

```typescript
interface ChatState {
  rooms: ChatRoom[]
  setRooms: (rooms: ChatRoom[]) => void
}

export const useChatStore = create<ChatState>((set) => ({
  rooms: [],
  setRooms: (rooms) => set({ rooms }),
}))
```

#### Conditional className

```typescript
import { cn } from '@/lib/utils'

<div className={cn('base-class', isActive && 'active-class', variant === 'primary' && 'primary-class')} />
```

### Anti-Patterns to Avoid

- **Importing Node.js APIs in renderer**: IPC boundary must be respected
- **Redux/Context for global state**: Use Zustand
- **Premature abstraction**: Three similar lines > unnecessary helper
- **Direct DB access from renderer**: Always go through IPC
- **Secrets in source**: API keys belong in user settings, never hardcoded

---
*Generated by specs.md - fabriqa.ai FIRE Flow*
