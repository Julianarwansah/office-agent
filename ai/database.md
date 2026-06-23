# Database Schema

## Teknologi

- **Engine**: SQLite via `better-sqlite3` (synchronous, file-based)
- **File DB**: `{userData}/office-ai-agent.db` (misal di Windows: `%APPDATA%\office-ai-agent\`)
- **Manager**: `DatabaseManager` class di `src/main/db/index.ts`
- **WAL mode**: aktif (`PRAGMA journal_mode = WAL`) untuk performa concurrent read
- **Foreign keys**: aktif (`PRAGMA foreign_keys = ON`)

## Inisialisasi

```ts
// Di main/index.ts saat startup
initDatabase(app.getPath('userData'));

// Akses di repositories
const db = getDb();
```

## Migrasi

Tabel `_migrations` melacak migration yang sudah dijalankan. Migrations bersifat idempotent dan dijalankan dalam transaksi. Migration gagal karena "already exists" tetap dicatat sebagai applied.

Migration saat ini:
1. `001_initial_indexes` — indexes untuk messages dan memories
2. `002_agent_team_index` — index `agents.team_id`
3. `003_user_skills` — tabel user_skills
4. `004_kanban` — tabel kanban_boards, columns, tasks, events

## Tabel-tabel

### `llm_providers`
Konfigurasi LLM provider.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Nama tampilan |
| `base_url` | TEXT | URL base API |
| `api_key_encrypted` | TEXT | API key terenkripsi AES-256-GCM |
| `model` | TEXT | ID model (gpt-4o, dll) |
| `temperature` | REAL | Default 0.7 |
| `max_tokens` | INTEGER | Default 4096 |
| `top_p` | REAL | Default 1.0 |
| `system_prompt_prefix` | TEXT | Prefix tambahan di semua system prompt |
| `is_default` | INTEGER | 0 atau 1, hanya satu default |
| `headers` | TEXT | JSON object custom HTTP headers |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |

### `teams`
Tim agent yang bisa berkolaborasi.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Nama tim |
| `description` | TEXT | Deskripsi |
| `instructions` | TEXT | Instruksi tim (dimasukkan ke system prompt semua agent tim ini) |
| `color` | TEXT | Warna HEX |
| `avatar` | TEXT | URL atau path avatar |
| `created_at` | TEXT | ISO timestamp |

### `agents`
Definisi agent AI.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Nama agent |
| `description` | TEXT | Deskripsi singkat |
| `avatar` | TEXT | URL/path avatar |
| `system_prompt` | TEXT | System prompt agent |
| `provider_id` | TEXT | FK ke llm_providers.id |
| `team_id` | TEXT | FK ke teams.id (nullable) |
| `role` | TEXT | 'lead' \| 'member' \| 'observer' |
| `color` | TEXT | Warna avatar HEX |
| `is_lead` | INTEGER | 0 atau 1 |
| `temperature` | REAL | Override temperature (nullable = pakai provider default) |
| `max_tokens` | INTEGER | Override max_tokens |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |

Index: `idx_agents_team` pada `team_id`

### `agent_skills`
Skills yang diaktifkan per agent.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `agent_id` | TEXT PK | FK ke agents.id |
| `skill_name` | TEXT PK | Nama skill |
| `enabled` | INTEGER | 1 = enabled |
| `config` | TEXT | JSON config skill |

PK: `(agent_id, skill_name)`

### `chatrooms`
Room chat (grup atau direct).

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Nama chatroom |
| `description` | TEXT | Deskripsi |
| `team_id` | TEXT | FK ke teams.id (optional) |
| `type` | TEXT | 'direct' \| 'team' \| 'global' |
| `created_at` | TEXT | ISO timestamp |

**Tipe chatroom:**
- `direct` — 1:1 dengan satu agent
- `team` — multi-agent dari satu tim
- `global` — semua agent yang tersedia

### `chatroom_agents`
Relasi many-to-many chatroom ↔ agent.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `chatroom_id` | TEXT PK | FK ke chatrooms.id |
| `agent_id` | TEXT PK | FK ke agents.id |

PK: `(chatroom_id, agent_id)`

### `messages`
Semua pesan dalam chatroom.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `chatroom_id` | TEXT | FK ke chatrooms.id |
| `sender_type` | TEXT | 'user' \| 'agent' \| 'system' |
| `sender_id` | TEXT | 'user' untuk user, agent.id untuk agent |
| `content` | TEXT | Konten pesan |
| `role` | TEXT | 'user' \| 'assistant' \| 'tool' \| 'system' (untuk LLM context) |
| `tool_calls` | TEXT | JSON array LLMToolCall[] |
| `tool_call_id` | TEXT | ID untuk tool result messages |
| `parent_id` | TEXT | FK ke messages.id (thread) |
| `created_at` | TEXT | ISO timestamp |
| `metadata` | TEXT | JSON metadata (agentName, agentColor, error, dll) |
| `is_streaming` | INTEGER | 1 = masih streaming (sementara) |

Index: `idx_messages_chatroom_created` pada `(chatroom_id, created_at)`

### `memories`
Memori jangka panjang per agent.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `agent_id` | TEXT | FK ke agents.id |
| `type` | TEXT | 'short_term' \| 'long_term' \| 'episodic' \| 'semantic' |
| `content` | TEXT | Konten memori |
| `importance` | REAL | 0.0–1.0 (digunakan untuk ranking retrieval) |
| `category` | TEXT | 'user_preference' \| 'fact' \| 'instruction' \| 'context' \| 'task' |
| `created_at` | TEXT | ISO timestamp |
| `last_accessed_at` | TEXT | ISO timestamp |
| `access_count` | INTEGER | Berapa kali diakses |
| `is_pinned` | INTEGER | 1 = pinned (tidak dihapus saat clear) |
| `source_message_id` | TEXT | FK ke messages.id (dari mana memori dibuat) |

Index: `idx_memories_agent_importance` pada `(agent_id, importance DESC)`

### `conversation_summaries`
Ringkasan percakapan per agent per chatroom (dibuat saat konsolidasi).

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `agent_id` | TEXT | FK ke agents.id |
| `chatroom_id` | TEXT | FK ke chatrooms.id |
| `summary` | TEXT | Teks ringkasan |
| `message_count` | INTEGER | Jumlah pesan yang dirangkum |
| `start_message_id` | TEXT | Pesan pertama yang dirangkum |
| `end_message_id` | TEXT | Pesan terakhir yang dirangkum |
| `created_at` | TEXT | ISO timestamp |

### `tool_executions`
Log eksekusi tool/skill.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `message_id` | TEXT | FK ke messages.id |
| `tool_name` | TEXT | Nama skill/tool |
| `arguments` | TEXT | JSON arguments |
| `result` | TEXT | Output eksekusi |
| `status` | TEXT | 'pending' \| 'running' \| 'success' \| 'error' |
| `started_at` | TEXT | ISO timestamp |
| `completed_at` | TEXT | ISO timestamp (nullable) |
| `error` | TEXT | Pesan error (nullable) |

### `settings`
Key-value store untuk app settings.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `key` | TEXT PK | Nama setting |
| `value` | TEXT | JSON value |
| `updated_at` | TEXT | ISO timestamp |

Setting keys utama: `theme`, `localhostPort`, `defaultProviderId`, `terminalShell`, `workingDirectory`, `maxMemoryItems`, `memoryImportanceThreshold`, `autoCreateMemories`, `streamResponses`, `saveHistory`.

### `workspaces`
Workspace (folder) yang dikelola oleh app.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Nama workspace |
| `path` | TEXT | Path absolut folder |
| `is_default` | INTEGER | 0 atau 1 |
| `created_at` | TEXT | ISO timestamp |

### `user_skills`
Skill kustom yang dibuat pengguna (JavaScript).

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `name` | TEXT PK | Nama unik skill (slug) |
| `display_name` | TEXT | Nama tampilan |
| `description` | TEXT | Deskripsi |
| `category` | TEXT | Kategori: 'productivity', 'data', dll |
| `version` | TEXT | Versi (semver) |
| `author` | TEXT | Nama pembuat |
| `parameters` | TEXT | JSON schema parameter |
| `requires_approval` | INTEGER | 1 = butuh konfirmasi user sebelum eksekusi |
| `dangerous` | INTEGER | 1 = skill berbahaya (warning) |
| `implementation` | TEXT | Kode JavaScript skill |
| `enabled` | INTEGER | 1 = aktif |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |

### Kanban Tables

#### `kanban_boards`
| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Nama board |
| `description` | TEXT | Deskripsi |
| `color` | TEXT | Warna HEX |
| `team_id` | TEXT | FK ke teams.id (nullable) |
| `owner_agent_id` | TEXT | FK ke agents.id (nullable) |
| `created_at` / `updated_at` | TEXT | ISO timestamp |

#### `kanban_columns`
| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `board_id` | TEXT | FK ke kanban_boards.id (CASCADE DELETE) |
| `name` | TEXT | Nama kolom |
| `position` | INTEGER | Urutan kolom |
| `status` | TEXT | 'todo' \| 'in_progress' \| 'review' \| 'done' \| 'blocked' |
| `wip_limit` | INTEGER | Work-in-progress limit (nullable) |
| `created_at` | TEXT | ISO timestamp |

#### `kanban_tasks`
| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `board_id` | TEXT | FK ke kanban_boards.id (CASCADE) |
| `column_id` | TEXT | FK ke kanban_columns.id (CASCADE) |
| `title` | TEXT | Judul task |
| `description` | TEXT | Deskripsi |
| `status` | TEXT | 'todo' \| 'in_progress' \| 'review' \| 'done' \| 'blocked' |
| `priority` | TEXT | 'low' \| 'medium' \| 'high' \| 'urgent' |
| `assignee_agent_id` | TEXT | FK ke agents.id (SET NULL) |
| `creator_agent_id` | TEXT | FK ke agents.id (SET NULL) |
| `due_date` | TEXT | ISO timestamp (nullable) |
| `position` | INTEGER | Urutan dalam kolom |
| `parent_task_id` | TEXT | FK ke kanban_tasks.id (nullable, sub-task) |
| `tags` | TEXT | JSON string[] |
| `created_at` / `updated_at` | TEXT | ISO timestamp |
| `completed_at` | TEXT | ISO timestamp (nullable) |

#### `kanban_task_events`
Log perubahan task (audit trail).

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | TEXT PK | UUID |
| `task_id` | TEXT | FK ke kanban_tasks.id (CASCADE) |
| `board_id` | TEXT | FK ke kanban_boards.id (CASCADE) |
| `event_type` | TEXT | 'created' \| 'moved' \| 'assigned' \| 'updated' \| 'completed' \| dll |
| `from_column_id` | TEXT | Kolom asal (untuk 'moved') |
| `to_column_id` | TEXT | Kolom tujuan (untuk 'moved') |
| `agent_id` | TEXT | Agent yang melakukan aksi |
| `message` | TEXT | Komentar event |
| `metadata` | TEXT | JSON metadata tambahan |
| `created_at` | TEXT | ISO timestamp |

## Repositories

File: `src/main/db/repositories/`

Setiap domain punya repository class:
- `agents.ts` → `AgentRepository` — `findAll()`, `findById()`, `create()`, `update()`, `delete()`, dll
- `teams.ts` → `TeamRepository`
- `chatrooms.ts` → `ChatRoomRepository` — termasuk `getOrCreateDirect(agentId)`
- `messages.ts` → `MessageRepository` — `findRecent(chatRoomId, limit)`, `appendContent(id, delta)`, `create()`, `update()`, dll
- `memories.ts` → `MemoryRepository` — `getTopRelevant(agentId, query, limit, threshold)`, `touchAccess(id)`, dll
- `summaries.ts` → `SummaryRepository`
- `llm-providers.ts` → `LLMProviderRepository`
- `settings.ts` → `SettingsRepository` — `get(): AppSettings`, `set(key, value)`
- `workspaces.ts` → `WorkspaceRepository`
- `user-skills.ts` → `UserSkillRepository`
- `tool-executions.ts` → `ToolExecutionRepository`
- `kanban.ts` (di `src/main/ipc/kanban.ts`) → via kanban repo

Semua repositories diinisialisasi dan dikelola via `Repositories` object dari `src/main/db/repositories/index.ts`.
