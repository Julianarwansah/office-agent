# AI Instructions — Office AI Agent

## WAJIB DIBACA SEBELUM MULAI

Sebelum mengerjakan task apapun di project ini, baca seluruh file dokumentasi di folder `ai/` terlebih dahulu. Jangan lewati langkah ini meskipun task terlihat sederhana.

### Urutan Baca

1. **[ai/README.md](ai/README.md)** — index dan quick reference, baca ini dulu
2. **[ai/overview.md](ai/overview.md)** — tech stack, struktur folder, alur data
3. **[ai/architecture.md](ai/architecture.md)** — arsitektur Electron, IPC, component hierarchy
4. **[ai/pages.md](ai/pages.md)** — semua halaman dan routes
5. **[ai/stores.md](ai/stores.md)** — state management (Zustand stores)
6. **[ai/ipc.md](ai/ipc.md)** — semua IPC channels
7. **[ai/orchestrator.md](ai/orchestrator.md)** — bagaimana agent berjalan
8. **[ai/llm.md](ai/llm.md)** — LLM provider system
9. **[ai/database.md](ai/database.md)** — schema database lengkap
10. **[ai/skills.md](ai/skills.md)** — skill system
11. **[ai/components.md](ai/components.md)** — React components
12. **[ai/types.md](ai/types.md)** — TypeScript types

Setelah membaca semua file di atas, baru mulai mengerjakan task yang diminta.

---

## Project Context

**Office AI Agent** adalah aplikasi desktop Electron untuk berinteraksi dengan agen AI.

- **Main process** (Node.js): DB, LLM, Orchestrator, Skills, IPC handlers
- **Renderer process** (React + Vite): UI, Zustand stores
- **Bridge**: Electron preload via `contextBridge` → `window.officeAPI`
- **Database**: SQLite (`better-sqlite3`) di main process
- **LLM**: OpenAI-compatible HTTP client, support semua provider

## Aturan Coding

- TypeScript strict di semua file
- Zustand untuk state management (tidak pakai Redux atau Context untuk state global)
- Semua IPC handler return `ApiResponse<T>` — gunakan `unwrap()` di renderer
- Tailwind CSS untuk styling — gunakan `cn()` untuk conditional class
- Jangan langsung akses Node.js APIs dari renderer — selalu lewat IPC
- Jangan tambah comment kecuali WHY-nya tidak obvious dari kode
- Jangan buat abstraksi prematur — tiga baris serupa lebih baik dari abstraksi yang tidak perlu

## Lokasi File Kunci

| Kebutuhan | File |
|---|---|
| Tambah route baru | `src/renderer/App.tsx` + `src/renderer/components/Sidebar.tsx` |
| Tambah halaman | `src/renderer/pages/` |
| Tambah IPC channel | `src/shared/types.ts` (channel name) + `src/main/ipc/` (handler) + `src/preload/api.ts` (expose) |
| Tambah DB tabel | `src/main/db/index.ts` (schema + migration) + `src/main/db/repositories/` |
| Tambah skill baru | `src/main/skills/builtin/` + register di `src/main/skills/index.ts` |
| Ubah behavior agent | `src/main/orchestrator/agent-runner.ts` atau `src/main/llm/prompt-builder.ts` |
| Ubah shared types | `src/shared/types.ts` |
