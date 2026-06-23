# AI Context Docs — Office AI Agent

Folder ini berisi dokumentasi struktural lengkap project **Office AI Agent** untuk membantu AI (dan developer) memahami codebase dengan cepat tanpa harus membaca seluruh source code.

## Index File

| File | Isi |
|---|---|
| [overview.md](overview.md) | Tech stack, tujuan project, struktur folder, alur data |
| [architecture.md](architecture.md) | Arsitektur Electron, IPC model, component hierarchy, skill system |
| [pages.md](pages.md) | Semua halaman, routes, sidebar navigation, perbedaan Chatrooms vs Chat Agent |
| [stores.md](stores.md) | Semua Zustand stores, state shape, actions, dan pola penggunaan |
| [ipc.md](ipc.md) | Semua IPC channels (request-response dan push events), contoh kode |
| [orchestrator.md](orchestrator.md) | Orchestrator, AgentRunner, MemoryManager, event flow end-to-end |
| [llm.md](llm.md) | LLM client, provider manager, prompt builder, streaming, enkripsi API key |
| [database.md](database.md) | Schema SQLite lengkap semua tabel, migration, repositories |
| [skills.md](skills.md) | Skill system: builtin skills, user skills, registry, executor, cara tambah skill baru |
| [components.md](components.md) | React components: layout, UI, domain components, styling conventions |
| [types.md](types.md) | TypeScript types reference: semua interface dan type utama |

## Quick Reference

### "Saya mau tambah halaman baru"
1. Buat file di `src/renderer/pages/NewPage.tsx`
2. Tambah route di `src/renderer/App.tsx`
3. Tambah entry di `NAV_ITEMS` di `src/renderer/components/Sidebar.tsx`
4. Baca: [pages.md](pages.md)

### "Saya mau akses/modifikasi data dari renderer"
1. Cek apakah sudah ada store yang relevan di `src/renderer/stores/`
2. Gunakan `useXxxStore((s) => s.field)` untuk akses state
3. Gunakan `useXxxStore((s) => s.action)` untuk aksi
4. Jika belum ada: tambah action di store yang memanggil `api.xxx` via IPC
5. Baca: [stores.md](stores.md) + [ipc.md](ipc.md)

### "Saya mau modifikasi bagaimana agent merespons"
1. Modifikasi `PromptBuilder` di `src/main/llm/prompt-builder.ts`
2. Atau modifikasi logika orchestrator di `src/main/orchestrator/orchestrator.ts`
3. Atau modifikasi AgentRunner di `src/main/orchestrator/agent-runner.ts`
4. Baca: [orchestrator.md](orchestrator.md)

### "Saya mau tambah skill baru"
1. Buat file di `src/main/skills/builtin/`
2. Register di `src/main/skills/index.ts`
3. Baca: [skills.md](skills.md)

### "Saya mau tambah tabel DB baru"
1. Tambah CREATE TABLE ke schema di `src/main/db/index.ts` (SCHEMA_SQL)
2. Tambah migration di array `migrations` di file yang sama
3. Buat repository baru di `src/main/db/repositories/`
4. Tambah ke `Repositories` interface di `src/main/db/repositories/index.ts`
5. Baca: [database.md](database.md)

### "Saya mau tambah IPC channel baru"
1. Tambah channel name ke `IPC_CHANNELS` di `src/shared/types.ts`
2. Buat atau update handler di `src/main/ipc/`
3. Register di `src/main/ipc/index.ts`
4. Expose di preload API (`src/preload/api.ts`)
5. Akses dari renderer via `api.xxx`
6. Baca: [ipc.md](ipc.md)

## Catatan Arsitektur Penting

- **Main process = Node.js**: Semua akses DB, LLM, file system ada di sini
- **Renderer = React**: Tidak bisa langsung akses Node.js APIs
- **Preload bridge**: Satu-satunya penghubung, via `contextBridge`
- **IPC pattern**: Selalu `ApiResponse<T>` wrapper, gunakan `unwrap()` di renderer
- **Streaming**: Unidirectional push via `orchestrator:event` IPC channel, bukan bi-directional
- **State management**: Zustand (bukan Redux), no Provider needed, selector untuk performa
- **DB adalah synchronous**: `better-sqlite3` synchronous API, semua query blocking di main process
