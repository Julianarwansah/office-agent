# Office AI Agent — Project Overview

## Tujuan
Aplikasi desktop berbasis Electron untuk berinteraksi dengan agen AI dalam berbagai mode:
- **Chatrooms**: grup chat multi-agent (seperti Slack dengan bot)
- **Chat Agent**: percakapan 1:1 langsung dengan satu agent
- **Kanban Board**: manajemen task yang bisa dikelola agent
- **Memori Jangka Panjang**: agent mengingat info penting dari percakapan sebelumnya
- **Custom Skills**: extend kemampuan agent dengan tools/fungsi buatan sendiri
- **Workspace**: agent bisa mengakses dan memanipulasi file lokal

## Tech Stack

| Layer | Teknologi | Catatan |
|---|---|---|
| Desktop shell | Electron | Main + Renderer process |
| Frontend | React 18 + TypeScript | Renderer process |
| Bundler frontend | Vite | Fast HMR di dev |
| Styling | Tailwind CSS | + custom classes di globals.css |
| State management | Zustand | Per-domain stores, no Provider |
| Routing | React Router (HashRouter) | Hash-based untuk Electron compatibility |
| Database | SQLite via `better-sqlite3` | Synchronous, di main process |
| IPC | Electron IPC + contextBridge | Renderer → Main (invoke), Main → Renderer (send) |
| LLM | Custom OpenAI-compatible client | Support semua provider dengan API OpenAI-format |
| Packaging | electron-builder | `electron-builder.yml` |

## Struktur Folder

```
src/
├── main/                    ← Electron main process (Node.js)
│   ├── db/
│   │   ├── index.ts         ← DatabaseManager, initDatabase(), getDb()
│   │   └── repositories/    ← Repository per entity (agents, messages, dll)
│   ├── ipc/
│   │   ├── index.ts         ← registerAllIpcHandlers() — entry point
│   │   ├── agents.ts        ← Handler: agent:list, agent:create, dll
│   │   ├── chat.ts          ← Handler: chat:send, chat:stream, chat:cancel
│   │   ├── chatrooms.ts     ← Handler: chatroom:*
│   │   ├── messages.ts      ← Handler: message:*
│   │   ├── memories.ts      ← Handler: memory:*
│   │   ├── skills.ts        ← Handler: skill:*
│   │   ├── llm.ts           ← Handler: llm:*
│   │   ├── settings.ts      ← Handler: settings:*
│   │   ├── workspace.ts     ← Handler: workspace:*
│   │   ├── system.ts        ← Handler: system:*
│   │   ├── terminal.ts      ← Handler: terminal:*
│   │   ├── app.ts           ← Handler: app:quit, app:minimize, dll
│   │   └── kanban.ts        ← Handler: kanban:*
│   ├── llm/
│   │   ├── client.ts        ← LLMClient (HTTP OpenAI-compat)
│   │   ├── provider-manager.ts ← ProviderManager (factory client)
│   │   ├── prompt-builder.ts   ← PromptBuilder (system prompt, chat messages)
│   │   ├── streaming.ts        ← SSE stream parser
│   │   └── types.ts            ← ChatRequest, ChatResult, StreamChunk, LLMError
│   ├── orchestrator/
│   │   ├── orchestrator.ts  ← Orchestrator (koordinator multi-agent)
│   │   ├── agent-runner.ts  ← AgentRunner (single agent turn)
│   │   ├── memory-manager.ts ← MemoryManager (retrieval, extraction, consolidation)
│   │   ├── event-bus.ts     ← TypedEventEmitter
│   │   ├── prompt-builder.ts ← re-export atau extended
│   │   ├── prompts.ts       ← Template string prompt
│   │   ├── tool-accumulator.ts ← Akumulasi streaming tool calls
│   │   └── types.ts         ← OrchestratorDeps, AgentRunOptions, dll
│   ├── skills/
│   │   ├── registry.ts      ← SkillRegistry (register, lookup, getToolsForAgent)
│   │   ├── executor.ts      ← SkillExecutor (execute + record)
│   │   ├── index.ts         ← Register semua builtin skills
│   │   ├── user-skills.ts   ← Load + register user skills dari DB
│   │   ├── user-script.ts   ← Sandbox eksekusi user skill JS
│   │   └── builtin/         ← Implementasi masing-masing builtin skill
│   ├── security/
│   │   └── crypto.ts        ← Enkripsi/dekripsi API key (AES-256-GCM)
│   ├── server/
│   │   └── localhost.ts     ← LocalServer (HTTP server lokal untuk API)
│   ├── window/
│   │   └── window.ts        ← WindowManager (BrowserWindow, sendToRenderer)
│   └── utils/
│       └── logger.ts        ← createLogger(scope) — structured logging
│
├── renderer/                ← React frontend (Vite)
│   ├── App.tsx              ← Routes + global data loading
│   ├── main.tsx             ← Entry point React
│   ├── env.d.ts             ← Type augmentation window.officeAPI
│   ├── pages/               ← Satu file per halaman
│   │   ├── Dashboard.tsx
│   │   ├── ChatRoom.tsx     ← /chat, /chat/:id
│   │   ├── AgentChats.tsx   ← /agent-chat
│   │   ├── Agents.tsx
│   │   ├── Teams.tsx
│   │   ├── Skills.tsx
│   │   ├── Memories.tsx
│   │   ├── Workspace.tsx
│   │   ├── Settings.tsx
│   │   └── Kanban.tsx
│   ├── components/
│   │   ├── AppShell.tsx     ← Layout wrapper
│   │   ├── Sidebar.tsx      ← Nav kiri
│   │   ├── TopBar.tsx       ← Header atas
│   │   ├── MessageBubble.tsx
│   │   ├── InputArea.tsx
│   │   ├── AgentEditor.tsx
│   │   ├── TeamEditor.tsx
│   │   ├── SkillEditor.tsx
│   │   ├── MemoryCard.tsx
│   │   ├── LLMProviderEditor.tsx
│   │   ├── AgentTemplatePicker.tsx
│   │   └── ui/              ← Modal, Button, Input (reusable primitives)
│   ├── stores/
│   │   ├── app.ts           ← useAppStore (sidebar, theme, settings, system)
│   │   ├── agents.ts        ← useAgentsStore (agents, teams)
│   │   ├── chatrooms.ts     ← useChatRoomsStore (chatrooms, messages, streaming)
│   │   ├── llm.ts           ← useLLMStore (providers, presets)
│   │   ├── skills.ts        ← useSkillsStore
│   │   ├── memories.ts      ← useMemoriesStore
│   │   ├── kanban.ts        ← useKanbanStore
│   │   ├── workspace.ts     ← useWorkspaceStore
│   │   └── index.ts         ← re-exports
│   └── lib/
│       ├── api.ts           ← api object (window.officeAPI wrapper), unwrap(), ApiError
│       ├── utils.ts         ← cn(), getInitial(), formatRelative()
│       ├── types.ts         ← Renderer-only types (ChatRoomFormData, StreamingMessageState, dll)
│       └── template-usage.ts ← Template helpers
│
├── shared/                  ← Dipakai main + renderer
│   ├── types.ts             ← SEMUA shared types + IPC_CHANNELS constant
│   ├── index.ts             ← re-exports
│   ├── skills-schema.ts     ← SkillManifest type
│   ├── llm-providers.ts     ← LLM provider presets
│   └── utils.ts             ← Shared utility functions
│
└── preload/                 ← Electron preload (bridge)
    ├── index.d.ts           ← Type declaration window.officeAPI + window.office
    └── api.ts               ← OfficeAPI interface definition
```

## Alur Data (Request-Response)

```
User klik tombol di UI
    → Zustand action (misal: loadAgents)
    → api.agents.list()  (via window.officeAPI)
    → contextBridge → ipcRenderer.invoke('agent:list')
    → ipcMain.handle('agent:list')
    → repos.agents.findAll()
    → SQLite query (synchronous)
    → return { success: true, data: [...] }
    → ipcRenderer resolve
    → unwrap(response) → agents[]
    → set({ agents }) di Zustand store
    → React re-render komponen yang subscribe
```

## Alur Data (Streaming Chat)

```
User kirim pesan di InputArea
    → useChatRoomsStore.sendMessage({ chatRoomId, userMessage })
    → api.chat.stream({ chatRoomId, userMessage })  [IPC invoke, langsung return messageId]
    → Main: simpan user message ke DB
    → Main: orchestrator.streamChat(chatRoomId, agentId, ...) [fire-and-forget async]
         → AgentRunner.run() [async, loop tool calls]
             → Emit 'agent:start' event
             → LLM streaming → emit 'agent:content' per delta
             → [jika tool_call] → execute skill → emit 'agent:tool_call/result'
             → Emit 'agent:done'
    ← Main push tiap event ke renderer via 'orchestrator:event' channel
    ← Renderer (chatrooms store) subscribe events:
         'agent:start'   → tambah ke streamingMessages[chatRoomId]
         'agent:content' → update content di streamingMessages
         'agent:done'    → hapus dari streaming, fetch pesan final dari DB, masuk ke messagesByRoom
```

## File Konfigurasi

| File | Deskripsi |
|---|---|
| `package.json` | Dependencies, scripts (dev, build, preview) |
| `vite.config.ts` | Config Vite untuk renderer |
| `tsconfig.json` | TypeScript base config |
| `tsconfig.main.json` | TypeScript config untuk main process |
| `tsconfig.node.json` | TypeScript config untuk Node scripts |
| `electron-builder.yml` | Config packaging (platform targets, icons, dll) |
| `tailwind.config.js` | Custom colors, fonts, animations |
| `postcss.config.js` | PostCSS config untuk Tailwind |
| `index.html` | Entry HTML untuk renderer |
