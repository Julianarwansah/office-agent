# System Architecture

## Overview

Office AI Agent is a local-first Electron desktop application. Users interact with AI agents through chatrooms and skill-based task execution. All data is stored locally in SQLite. LLM calls go out to external providers (OpenAI-compatible HTTP).

## System Context

The app runs entirely on the user's machine. The only external dependency is the LLM provider API (configurable: OpenAI, local Ollama, or any OpenAI-compatible endpoint).

### Context Diagram

```
┌─────────────────────────────────────────┐
│             User's Machine              │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │        Office AI Agent           │   │
│  │  ┌──────────┐  ┌──────────────┐  │   │
│  │  │ Renderer │  │ Main Process │  │   │
│  │  │ (React)  │◄─►│  (Node.js)  │  │   │
│  │  └──────────┘  └──────┬───────┘  │   │
│  │                       │          │   │
│  │                  ┌────▼─────┐    │   │
│  │                  │ SQLite   │    │   │
│  │                  └──────────┘    │   │
│  └──────────────────────┬───────────┘   │
└─────────────────────────┼───────────────┘
                          │ HTTPS
                 ┌────────▼────────┐
                 │  LLM Provider   │
                 │ (OpenAI / local)│
                 └─────────────────┘
```

### Users

- **End User**: Interacts with the desktop app via the React UI

### External Systems

- **LLM Provider**: OpenAI-compatible HTTP API (OpenAI, Ollama, custom endpoint)

## Architecture Pattern

**Pattern**: Electron two-process architecture (main + renderer) with strict IPC boundary
**Rationale**: Security isolation between privileged Node.js code and the UI. Renderer cannot access filesystem, DB, or network directly — all privileged operations go through IPC.

## Component Architecture

### Components

#### Renderer Process (React + Vite)

- **Purpose**: User interface
- **Responsibilities**: Routing, page rendering, state management (Zustand), calling IPC via `window.officeAPI`
- **Dependencies**: Zustand, React Router, Tailwind CSS, lucide-react

#### Main Process (Node.js)

- **Purpose**: Business logic and data access
- **Responsibilities**: SQLite DB, LLM HTTP calls, IPC handler registration, orchestrator, skills
- **Dependencies**: better-sqlite3, openai, electron ipcMain

#### Preload Script

- **Purpose**: IPC bridge
- **Responsibilities**: Expose safe `window.officeAPI` surface via `contextBridge`
- **Dependencies**: Electron contextBridge, ipcRenderer

#### Shared Types (`src/shared/types.ts`)

- **Purpose**: Type contracts shared between main and renderer
- **Responsibilities**: IPC channel names, `ApiResponse<T>`, domain types
- **Dependencies**: None (pure types)

### Component Diagram

```
Renderer Process
┌──────────────────────────────────────────┐
│  Pages → Components → Zustand Stores     │
│           │                              │
│    window.officeAPI.*()                  │
└───────────────┬──────────────────────────┘
                │ contextBridge (preload)
┌───────────────▼──────────────────────────┐
│              Main Process                │
│  ipcMain.handle(channel, handler)        │
│  ├── DB Repositories (better-sqlite3)   │
│  ├── LLM Client (openai SDK)            │
│  ├── Orchestrator (agent-runner)        │
│  └── Skills (builtin + user-defined)    │
└──────────────────────────────────────────┘
```

## Data Flow

All state mutations flow: UI action → `window.officeAPI.*` → IPC handler → DB write → return `ApiResponse<T>` → renderer updates Zustand store → UI re-renders.

```
User Action
    │
    ▼
React Component
    │ window.officeAPI.chat.sendMessage(payload)
    ▼
Preload (contextBridge)
    │ ipcRenderer.invoke('chat:send-message', payload)
    ▼
Main Process Handler
    │ chatRepo.insertMessage(payload)
    ▼
SQLite (better-sqlite3)
    │ returns row
    ▼
Handler → { success: true, data: row }
    │
    ▼
Renderer → unwrap() → useChatStore.setMessages()
    │
    ▼
UI re-renders
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Desktop runtime | Electron ^31 | Cross-platform app shell |
| UI | React ^18 | Component rendering |
| Routing | React Router DOM ^6 | Page navigation |
| State | Zustand ^4.5 | Client-side state |
| Styling | Tailwind CSS ^3.4 | Utility-first CSS |
| IPC | Electron contextBridge | Process communication |
| Database | SQLite (better-sqlite3) | Local data persistence |
| LLM | openai ^4.47 | AI completions |
| Build (renderer) | Vite ^5.2 | Fast HMR dev + bundle |
| Build (main) | tsc | TypeScript compilation |
| Language | TypeScript ^5.4 strict | Type safety everywhere |

## Non-Functional Requirements

### Performance

- **Startup time**: < 3 seconds to interactive
- **IPC latency**: < 50ms for DB-backed calls
- **LLM streaming**: Token-by-token streaming to minimize perceived latency

### Security

- Renderer has `nodeIntegration: false` and `contextIsolation: true`
- All privileged operations go through `contextBridge` — no direct Node access from renderer
- No API keys stored in source code — user-configured in settings
- No remote code execution from renderer

### Scalability

Local desktop app — single user. SQLite scales sufficiently for local-first data volumes.

## Constraints

- Must run on Windows, macOS, and Linux (Electron cross-platform)
- All data stored locally — no cloud sync (by design)
- LLM provider must expose an OpenAI-compatible HTTP API
- No internet access required except for LLM calls

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Process isolation | contextBridge + IPC | Security; renderer cannot access Node APIs |
| State management | Zustand (not Redux/Context) | Simpler API, no boilerplate, sufficient for app scale |
| DB access pattern | Raw better-sqlite3 (no ORM) | Sync API fits main process; avoids ORM overhead |
| LLM client | openai SDK (provider-agnostic) | Supports any OpenAI-compatible endpoint including local models |
| CSS approach | Tailwind utility classes | No context switching between CSS files and components |

---
*Generated by specs.md - fabriqa.ai FIRE Flow*
