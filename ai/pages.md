# Halaman (Pages)

Semua halaman ada di `src/renderer/pages/`. Routing dikonfigurasi di `src/renderer/App.tsx` menggunakan `HashRouter`.

## Daftar Halaman

| Route | File | Deskripsi |
|---|---|---|
| `/` | `Dashboard.tsx` | Ringkasan statistik, quick actions |
| `/chat` | `ChatRoom.tsx` | Daftar chatroom grup + area chat |
| `/chat/:chatRoomId` | `ChatRoom.tsx` | Chatroom spesifik |
| `/agent-chat` | `AgentChats.tsx` | Pilih agent untuk chat 1:1 langsung |
| `/kanban` | `Kanban.tsx` | Daftar board kanban |
| `/kanban/:boardId` | `Kanban.tsx` | Board spesifik |
| `/agents` | `Agents.tsx` | Manajemen agent (CRUD) |
| `/teams` | `Teams.tsx` | Manajemen tim agent |
| `/skills` | `Skills.tsx` | Skill yang tersedia + user skills |
| `/memories` | `Memories.tsx` | Memori agent (short/long term) |
| `/workspace` | `Workspace.tsx` | File browser workspace |
| `/settings` | `Settings.tsx` | LLM providers, app settings |

## Pola Umum Setiap Halaman
- Akses state via Zustand store (bukan props drilling)
- Layout dengan `flex h-full -m-6 overflow-hidden` untuk mengisi AppShell
- Modal untuk operasi CRUD menggunakan komponen `Modal` dari `src/renderer/components/ui/`

## Navigasi (Sidebar)
Sidebar (`src/renderer/components/Sidebar.tsx`) memiliki dua grup:
- **Main nav**: Dashboard, Chatrooms, Chat Agent, Kanban, Agents, Teams, Skills, Memories, Workspace
- **Bottom nav**: Settings

Sidebar bisa di-collapse (state `sidebarOpen` dari `useAppStore`).

## Perbedaan Chatrooms vs Chat Agent
- **Chatrooms** (`/chat`): Chat grup dengan satu atau banyak agent, mendukung tipe `direct`, `team`, dan `global`. Ada panel info room di kanan.
- **Chat Agent** (`/agent-chat`): Entry point untuk langsung memilih agent dan membuka sesi 1:1. Otomatis buat/temukan chatroom bertipe `direct` untuk agent tersebut via `getOrCreateDirect`.
