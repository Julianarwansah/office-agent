# Arsitektur Aplikasi

## Process Model (Electron)

```
┌─────────────────────────────────┐     IPC      ┌─────────────────────────────────┐
│         Main Process            │◄────────────►│       Renderer Process          │
│         (Node.js)               │              │       (React + Vite)             │
│                                 │              │                                 │
│  ┌─────────┐  ┌─────────────┐  │              │  ┌──────────┐  ┌─────────────┐  │
│  │   DB    │  │ Orchestrator│  │              │  │  Zustand │  │   React UI  │  │
│  │ SQLite  │  │ (multi-agent│  │              │  │  Stores  │  │   (pages +  │  │
│  │         │  │  runner)    │  │              │  │          │  │  components)│  │
│  └─────────┘  └─────────────┘  │              │  └──────────┘  └─────────────┘  │
│  ┌─────────┐  ┌─────────────┐  │              │                                 │
│  │   LLM   │  │   Skills    │  │  push events │  preload/index.ts               │
│  │ Provider│  │  Registry   │  │─────────────►│  (contextBridge)                │
│  └─────────┘  └─────────────┘  │              │                                 │
└─────────────────────────────────┘              └─────────────────────────────────┘
```

## IPC Communication

Channel-channel IPC didefinisikan di `src/shared/types.ts` → `IPC_CHANNELS`.

**Pattern invoke (request-response):**
```ts
// Renderer
const result = await window.electron.invoke('chatroom:list');

// Main (handler di src/main/ipc/chatrooms.ts)
ipcMain.handle('chatroom:list', async () => { ... });
```

**Pattern push event (main → renderer):**
```ts
// Main process mengirim event streaming
win.webContents.send('orchestrator:event', { type: 'agent:content', payload: {...} });

// Renderer menerima (di Zustand store)
window.electron.on('orchestrator:event', handler);
```

## Orchestrator (Multi-Agent Runner)

File: `src/main/orchestrator/`

1. User kirim pesan → `orchestrator.ts` menerima
2. Tentukan agent mana yang perlu respond (berdasarkan chatroom type + mention)
3. `agent-runner.ts` jalankan tiap agent:
   - Ambil memori relevan (`memory-manager.ts`)
   - Build prompt (`prompt-builder.ts`)
   - Panggil LLM via `llm/client.ts`
   - Stream response token per token → push ke renderer via `agent:content` event
   - Eksekusi tool calls jika ada (`skills/executor.ts`)
4. Simpan pesan final ke DB

## Database Schema

File: `src/main/db/` (SQLite via `better-sqlite3`)

Tabel utama:
- `agents` — definisi agent
- `teams` — tim agent
- `chatrooms` — room chat (type: direct/team/global)
- `chatroom_agents` — relasi many-to-many chatroom ↔ agent
- `messages` — pesan per chatroom
- `memories` — memori jangka panjang per agent
- `conversation_summaries` — ringkasan percakapan
- `llm_providers` — konfigurasi provider LLM
- `user_skills` — skill custom user
- `kanban_boards`, `kanban_columns`, `kanban_tasks`, `kanban_task_events`
- `workspaces` — workspace path

## Component Architecture

```
AppShell (layout wrapper)
  ├── Sidebar (navigasi kiri, collapsible)
  ├── TopBar (breadcrumb, search, theme toggle, server status)
  └── <Route children> (halaman aktif)
        └── Page components
              ├── Store hooks (data + actions)
              ├── UI components (src/renderer/components/ui/)
              │     ├── Modal, Button, Input, Textarea, Select
              └── Domain components
                    ├── MessageBubble
                    ├── InputArea (chat input + @mention)
                    ├── AgentEditor
                    ├── SkillEditor
                    └── ...
```

## Skill System

Skills adalah tool/fungsi yang bisa dipanggil agent saat merespons.

- **Builtin skills**: `src/main/skills/builtin/` — terminal, web-fetch, web-search, file-system, code-exec, memory-ops, agent-delegate, dll
- **User skills**: script yang dibuat pengguna, disimpan di DB
- **Registry**: `src/main/skills/registry.ts` — register semua skill, generate tool descriptor untuk LLM
- Agent mengaktifkan skill tertentu via `enabledSkills` di profil agent-nya
