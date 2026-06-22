# Office AI Agent — Product Requirements Document

> **Versi Dokumen:** 1.0.0
> **Tanggal:** 22 Juni 2026
> **Status:** Production-Ready Specification
> **Owner:** Product & Engineering Team
> **Repositori:** `C:\Users\pc\Documents\ngoding\Teamai`

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Tujuan & Sasaran](#2-tujuan--sasaran)
3. [User Personas](#3-user-personas)
4. [Fitur Utama](#4-fitur-utama)
   - [4.1 AI Agents dengan Skills](#41-ai-agents-dengan-skills)
   - [4.2 Sistem Memori Agent (CRITICAL)](#42-sistem-memori-agent-critical)
   - [4.3 Agent Orchestrator](#43-agent-orchestrator)
   - [4.4 Chatroom](#44-chatroom)
   - [4.5 Teams](#45-teams)
   - [4.6 Custom LLM Provider](#46-custom-llm-provider)
   - [4.7 Localhost Server](#47-localhost-server)
   - [4.8 Workspace](#48-workspace)
5. [Arsitektur Teknis](#5-arsitektur-teknis)
6. [Data Models](#6-data-models)
7. [Security](#7-security)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [User Flows](#9-user-flows)
10. [Roadmap](#10-roadmap)
11. [Out of Scope](#11-out-of-scope)
12. [Glossary](#12-glossary)

---

## 1. Ringkasan Eksekutif

### 1.1 Visi Produk

**Office AI Agent** adalah aplikasi desktop (Electron) yang berfungsi sebagai *control center* lokal bagi sekelompok AI agent yang dapat dikustomisasi penuh. Setiap agent memiliki persona, keahlian, *skills*, dan—yang paling penting—**memori persisten yang tidak pernah hilang** antar sesi.

Berbeda dengan chatbot web yang stateless, Office AI Agent memungkinkan pengguna untuk membangun *tim* AI yang saling berkolaborasi dalam *chatroom* multi-peserta, mengerjakan tugas dunia nyata (coding, riset, automasi file, eksekusi perintah) sambil terus **mengingat** preferensi, fakta, dan konteks historis pengguna.

### 1.2 Nama Produk

- **Display Name:** Office AI Agent
- **Internal Codename:** `teamai`
- **Tagline:** *"Your AI team that never forgets."*

### 1.3 Target Market

| Segmen | Use Case Utama |
|--------|----------------|
| **Software Developers** | Pair-programming dengan multi-agent (coder + reviewer + tester) |
| **Tech Leads & Engineering Managers** | Onboarding codebase baru, dokumentasi, sprint planning |
| **Knowledge Workers** | Research assistant dengan persistent notes & preferences |
| **AI Enthusiasts & Tinkerers** | Eksplorasi LLM lokal (Ollama, LM Studio) dengan agentic workflows |
| **Data Analysts** | Lokal data exploration + summarization dengan memori domain |

### 1.4 Diferensiasi Utama

1. **Persistent Memory (CRITICAL)** — Agent **tidak pernah lupa** konteks, preferensi, dan pengetahuan yang pernah dipelajari.
2. **100% Local-First** — Semua data, database, dan file ada di mesin pengguna. Hanya request LLM yang keluar ke internet (jika provider eksternal).
3. **Multi-Agent Orchestration** — Supervisor pattern + lead agent + agent delegation dalam satu chatroom.
4. **Pluggable Skills** — Built-in skills (terminal, web_fetch, file_system, http_request, dll) yang dapat diaktifkan per-agent.
5. **Custom LLM Provider** — Dukungan unlimited provider OpenAI-compatible (OpenAI, Ollama, LM Studio, OpenRouter, Groq, Together, Custom).
6. **Workspace-Aware** — Setiap team/agent memiliki working directory + file browser + terminal scoped.

---

## 2. Tujuan & Sasaran

### 2.1 Tujuan Utama

1. **Memberikan pengalaman AI assistant yang benar-benar personal** melalui memori persisten lintas sesi.
2. **Memungkinkan orkestrasi multi-agent** dalam satu chatroom dengan kolaborasi natural.
3. **Mendukung LLM lokal dan cloud** tanpa vendor lock-in.
4. **Menjaga privasi absolut** — semua data sensitif tetap di mesin lokal.

### 2.2 Key Performance Indicators (KPI)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Time-to-First-Token (streaming) | < 2 detik | Telemetry event `stream.start` |
| Memory retrieval overhead | < 100 ms (untuk 1K memories) | Profiling `MemoryManager.retrieveRelevant` |
| Memory extraction recall | ≥ 85% (manual eval) | User survey + memory review |
| First-launch setup completion | ≥ 80% | Onboarding funnel |
| API key compromise incidents | 0 | Security audit |
| Memory persistence reliability | 100% (no data loss across restart) | Crash test |

### 2.3 Success Metrics (90 hari post-launch)

- ≥ 1.000 active users dengan ≥ 5 chat sessions/minggu
- ≥ 50.000 memories tersimpan di seluruh user base
- NPS ≥ 45
- Crash-free rate ≥ 99.5%

---

## 3. User Personas

### 3.1 Persona 1 — "Devi, The Developer"

- **Demografi:** Backend engineer, 28 tahun, 5 tahun pengalaman
- **Goals:** Produktivitas coding, code review otomatis, debugging cepat
- **Pain Points:**
  - ChatGPT/HuggingChat lupa konteks tiap sesi baru
  - Tidak bisa minta 2 agent (coder + reviewer) di tempat yang sama
  - Tidak ada kontrol penuh atas LLM yang dipakai
- **Needs:** Local LLM (Ollama), terminal skill, file_system skill, memori preferensi (stack, gaya coding)

### 3.2 Persona 2 — "Rio, The Team Lead"

- **Demografi:** Engineering manager, 35 tahun, memimpin 6 developer
- **Goals:** Standarisasi codebase, onboarding cepat, automasi dokumentasi
- **Pain Points:**
  - Harus menjelaskan konteks proyek berulang-ulang ke AI
  - Butuh AI yang tahu *coding style* tim
  - Tidak mau data tim bocor ke cloud AI publik
- **Needs:** Team-scoped memory, lead agent yang bisa delegate, workspace terisolasi

### 3.3 Persona 3 — "Sasha, The Knowledge Worker"

- **Demografi:** Konsultan independen, 32 tahun, multi-klien
- **Goals:** Research, ringkasan artikel, catatan klien terstruktur
- **Pain Points:**
  - LLM tidak ingat klien mana yang butuh format apa
  - Harus copy-paste konteks tiap kali
- **Needs:** Memory per-agent, kategori memory (klien, proyek, preferensi), pin memory

### 3.4 Persona 4 — "Andi, The AI Enthusiast"

- **Demografi:** Hobbyist, 24 tahun, eksplorer LLM lokal
- **Goals:** Coba berbagai LLM, build custom agent, eksperimen prompt
- **Pain Points:**
  - Setup LM Studio/Ollama ribet
  - Tidak ada UI yang bagus untuk multi-agent
- **Needs:** Preset provider (Ollama, LM Studio), test connection, multi-provider

---

## 4. Fitur Utama

### 4.1 AI Agents dengan Skills

#### 4.1.1 Definisi Agent

Sebuah **Agent** adalah entitas AI otonom yang memiliki:

| Properti | Tipe | Deskripsi |
|----------|------|-----------|
| `id` | UUID | Identifier unik |
| `name` | string | Nama tampil (e.g., "CoderBot") |
| `description` | string | Deskripsi singkat |
| `avatar` | string (emoji/URL) | Avatar visual |
| `system_prompt` | string | Persona + expertise + instruksi |
| `provider_id` | UUID | LLM provider yang dipakai |
| `team_id` | UUID? | Tim tempat agent berada |
| `role` | enum (`lead`/`member`/`observer`) | Peran dalam tim |
| `is_lead` | bool | Apakah lead agent (satu per tim) |
| `temperature` | float? | Override temperature provider |
| `max_tokens` | int? | Override max tokens |
| `color` | string? | Warna pembeda di UI |

#### 4.1.2 Custom Agent Creation

Pengguna dapat membuat agent baru dengan flow:

```
[+ New Agent]
  ├── Nama: ___________
  ├── Avatar: 🧠
  ├── Deskripsi: ___________
  ├── System Prompt (multi-line textarea):
  │   ┌────────────────────────────────────────┐
  │   │ You are a senior backend engineer...   │
  │   │ Your expertise: Node.js, Postgres...   │
  │   │ Communication style: concise, technical│
  │   │ Always cite file paths in your answers │
  │   └────────────────────────────────────────┘
  ├── LLM Provider: [Pilih dari dropdown]
  ├── Temperature: [0.0 ──●───── 2.0]
  ├── Skills: [✓ terminal] [✓ file_system] [✓ http_request] ...
  └── [Simpan] [Simpan & Test]
```

#### 4.1.3 Pluggable Skill System

Skill adalah **function/tool** yang dapat dipanggil agent saat runtime. Arsitektur:

```typescript
interface Skill {
  name: string;                  // e.g., "terminal"
  description: string;           // Deskripsi untuk LLM
  parameters: JSONSchema;        // OpenAI function-call schema
  execute(args: any, context: SkillContext): Promise<SkillResult>;
}

interface SkillContext {
  agentId: string;
  workspacePath: string;
  abortSignal: AbortSignal;
}
```

**Built-in Skills (v1):**

| Skill | Deskripsi | Parameters |
|-------|-----------|------------|
| `terminal` | Eksekusi shell command di working directory agent | `{ command: string, timeout?: number }` |
| `web_fetch` | HTTP GET + ekstrak teks/HTML | `{ url: string, format?: 'text'|'html'\|'markdown' }` |
| `web_search` | Pencarian web (via provider) | `{ query: string, max_results?: number }` |
| `file_system` | Read/write/list files (scoped) | `{ op: 'read'\|'write'\|'list'\|'delete', path: string, content?: string }` |
| `http_request` | HTTP request generic | `{ method: string, url: string, headers?: object, body?: any }` |
| `code_exec` | Eksekusi kode (sandboxed subprocess) | `{ language: 'python'\|'node', code: string }` |
| `datetime` | Tanggal/waktu saat ini + timezone | `{ timezone?: string, format?: string }` |
| `calculator` | Evaluasi ekspresi matematika | `{ expression: string }` |
| `memory_ops` | CRUD memory (manual agent control) | `{ op: 'get'\|'store'\|'delete'\|'search', ... }` |
| `agent_delegate` | Delegasi tugas ke agent lain | `{ agentName: string, task: string }` |

#### 4.1.4 Per-Agent Skill Enablement

Setiap agent memiliki tabel `agent_skills` dengan flag enabled:

```sql
CREATE TABLE agent_skills (
  agent_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT,                  -- JSON per-skill config
  PRIMARY KEY (agent_id, skill_name)
);
```

Agen tertentu bisa punya skill `terminal` tapi tidak punya `web_fetch`. Konfigurasi per-skill juga didukung via kolom `config` (JSON).

#### 4.1.5 Skill Execution Lifecycle

```
LLM emits tool_call(name, args)
  ↓
SkillRegistry.lookup(name)
  ↓
Validate args against JSONSchema
  ↓
Check agent_skills(agent_id, name).enabled == 1
  ↓
Run execute(args, { agentId, workspacePath, abortSignal })
  ↓
Persist tool_execution row (status: pending → success/error)
  ↓
Return result to LLM as tool message
  ↓
LLM continues generation (or finalizes)
```

---

### 4.2 Sistem Memori Agent (CRITICAL) ⭐

> **⚠️ FITUR PALING PENTING.** Memori adalah *fondasi* yang membedakan Office AI Agent dari chatbot stateless biasa. Agent **harus** mengingat konteks, preferensi, dan pengetahuan lintas sesi, lintas restart, lintas waktu.

#### 4.2.1 Filosofi Memori

Office AI Agent mengadopsi **4-tier memory architecture** yang terinspirasi dari memori kognitif manusia:

```
┌──────────────────────────────────────────────────────────────┐
│                  AGENT MEMORY STACK                          │
├──────────────────────────────────────────────────────────────┤
│  1. SHORT-TERM MEMORY                                        │
│     • Konteks percakapan aktif (in-memory)                   │
│     • Sliding window N pesan terakhir                        │
│     • Reset saat chatroom ditutup / context penuh            │
│     • TIDAK persisten (sengaja)                              │
├──────────────────────────────────────────────────────────────┤
│  2. LONG-TERM MEMORY                                         │
│     • Fakta, preferensi, knowledge persisten                 │
│     • Disimpan di SQLite (table: memories)                  │
│     • Retrieval via importance + relevance scoring           │
│     • ⭐ TIDAK PERNAH DIHAPUS kecuali user request           │
├──────────────────────────────────────────────────────────────┤
│  3. EPISODIC MEMORY                                          │
│     • Ringkasan percakapan lampau (conversation_summaries)   │
│     • "Apa yang kita bicarakan minggu lalu tentang X?"       │
│     • Dibuat via LLM consolidation                           │
├──────────────────────────────────────────────────────────────┤
│  4. SEMANTIC MEMORY                                          │
│     • Pengetahuan terakumulasi hasil ekstraksi lintas waktu  │
│     • Bisa di-derive dari long-term via clustering           │
│     • Kategori: fact, preference, task_pattern, project      │
└──────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Tipe Memori — Detail

##### A. Short-Term Memory (Working Memory)

- **Scope:** Satu sesi chatroom aktif
- **Storage:** In-memory `Map<chatRoomId, Message[]>`
- **Capacity:** Sliding window 50 pesan terakhir (configurable)
- **Reset Trigger:** Chatroom ditutup, context window penuh, atau user command `/clear`
- **Use Case:** Menjaga koherensi percakapan dalam satu sesi

##### B. Long-Term Memory (Persistent Knowledge)

- **Scope:** Lintas sesi, lintas restart, lintas mesin (jika di-backup)
- **Storage:** SQLite table `memories`
- **Lifetime:** Persisten selamanya (kecuali user delete)
- **Source:** Auto-extraction via LLM/heuristic + manual user add
- **Use Case:** "Saya vegetarian", "Project ini pakai PostgreSQL", "Prefer pakai TypeScript strict mode"

##### C. Episodic Memory (Conversation History)

- **Scope:** Per-agent, per-chatroom
- **Storage:** SQLite table `conversation_summaries`
- **Trigger:** Konsolidasi periodik (setiap N pesan atau saat user menutup chatroom)
- **Format:** Ringkasan naratif 2-5 paragraf
- **Use Case:** "3 hari lalu kita diskusi refactor auth module, keputusannya pakai JWT dengan refresh token"

##### D. Semantic Memory (Derived Knowledge)

- **Scope:** Per-agent, lintas chatroom
- **Storage:** Derived dari `memories` via query aggregation
- **Computation:** On-demand (tidak pre-computed)
- **Use Case:** "Apa saja preferensi coding user?" → SELECT * FROM memories WHERE category='preference' AND agent_id=?

#### 4.2.3 Memory Operations

##### 4.2.3.1 Auto-Extraction

Setiap kali agent menghasilkan respons, sistem mengekstrak fakta/preferensi dari percakapan:

**Dua metode ekstraksi (keduanya diimplementasikan):**

**1. Heuristic-based (`extractMemoriesViaHeuristic`)**

Rule-based extraction tanpa LLM call tambahan:

```typescript
async function extractMemoriesViaHeuristic(
  agentId: string,
  text: string,
  sourceMessageId?: string
): Promise<Memory[]> {
  const candidates: Memory[] = [];

  // Pattern: "Saya/adalah/prefer... X"
  const preferencePatterns = [
    /saya\s+(?:adalah|seorang|lebih suka|prefer|tinggal di|bekerja di)\s+([^.!?]+)/gi,
    /i\s+(?:am|work|live|prefer|like|hate|use)\s+([^.!?]+)/gi,
    /my\s+(?:name|favorite|job|project|goal)\s+is\s+([^.!?]+)/gi,
  ];

  for (const pattern of preferencePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      candidates.push({
        content: match[0].trim(),
        importance: 0.6,
        category: 'preference',
        type: 'long_term',
      });
    }
  }

  // Pattern: "Pakai/gunakan/technology X"
  const techPatterns = [
    /(?:pakai|gunakan|menggunakan)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/g,
    /(?:use|using|with)\s+([A-Z][a-zA-Z0-9]+)/g,
  ];

  for (const pattern of techPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      candidates.push({
        content: `Uses ${match[1]}`,
        importance: 0.5,
        category: 'fact',
        type: 'long_term',
      });
    }
  }

  // Persist candidates with importance > threshold
  const persisted: Memory[] = [];
  for (const candidate of candidates) {
    if (candidate.importance >= settings.memoryThreshold) {
      const mem = await memoryStore.create(agentId, candidate);
      persisted.push(mem);
    }
  }
  return persisted;
}
```

**2. LLM-based (`extractAndStoreLLM`)**

Menggunakan LLM untuk ekstraksi cerdas:

```typescript
async function extractAndStoreLLM(
  agentId: string,
  text: string,
  sourceMessageId?: string
): Promise<Memory[]> {
  const provider = await getActiveProvider();
  const extractionPrompt = `
Analyze the following conversation and extract memorable facts, preferences, 
and knowledge about the user. Return a JSON array of objects:

[
  {
    "content": "User prefers TypeScript over JavaScript",
    "importance": 0.8,
    "category": "preference" | "fact" | "task_pattern" | "project" | "personal"
  },
  ...
]

Only extract information that is:
- Likely to be relevant in FUTURE conversations
- Stable facts (not transient context)
- Expressed explicitly by the user

Conversation:
"""
${text}
"""

Return ONLY valid JSON array. If nothing memorable, return [].
  `.trim();

  const response = await provider.chat({
    messages: [{ role: 'user', content: extractionPrompt }],
    temperature: 0.2,
    max_tokens: 1000,
  });

  try {
    const extracted = JSON.parse(response.content);
    const persisted: Memory[] = [];
    for (const item of extracted) {
      if (item.importance >= settings.memoryThreshold) {
        const mem = await memoryStore.create(agentId, {
          content: item.content,
          importance: item.importance,
          category: item.category,
          type: 'long_term',
          source_message_id: sourceMessageId,
        });
        persisted.push(mem);
      }
    }
    return persisted;
  } catch (err) {
    logger.error('Memory extraction LLM parse failed', err);
    return [];
  }
}
```

##### 4.2.3.2 Periodic Consolidation (`consolidate`)

Saat agent menyelesaikan turn atau chatroom ditutup:

```typescript
async function consolidate(agentId: string, chatRoomId: string): Promise<ConversationSummary> {
  const messages = await messageStore.list(chatRoomId, { limit: 50 });
  const provider = await getActiveProvider();

  const summaryPrompt = `
Summarize the following conversation between the user and an AI agent.
Focus on:
1. Key topics discussed
2. Decisions made
3. Action items / tasks
4. User preferences revealed
5. Problems solved

Conversation:
"""
${messages.map(m => `[${m.role}] ${m.content}`).join('\n')}
"""

Provide a 2-5 paragraph narrative summary in the same language as the conversation.
  `.trim();

  const summary = await provider.chat({
    messages: [{ role: 'user', content: summaryPrompt }],
    temperature: 0.3,
    max_tokens: 800,
  });

  return await summaryStore.create({
    agent_id: agentId,
    chatroom_id: chatRoomId,
    summary: summary.content,
    message_count: messages.length,
    start_message_id: messages[0]?.id,
    end_message_id: messages[messages.length - 1]?.id,
    created_at: new Date().toISOString(),
  });
}
```

##### 4.2.3.3 Top-K Retrieval dengan Scoring

Saat agent memulai turn baru:

```typescript
function scoreMemory(mem: Memory, query: string): number {
  // Simple TF-IDF + importance blend
  const queryTerms = query.toLowerCase().split(/\s+/);
  const content = mem.content.toLowerCase();
  let relevance = 0;
  for (const term of queryTerms) {
    if (content.includes(term)) relevance += 1;
  }
  relevance = relevance / Math.max(queryTerms.length, 1);

  // Normalize importance (0-1)
  const importanceNorm = Math.min(mem.importance, 1.0);

  // Boost for pinned
  const pinBoost = mem.is_pinned ? 0.3 : 0;

  // Boost for recent access
  const recencyBoost = mem.access_count > 0 ? 0.1 : 0;

  // Final: 50% importance + 50% relevance + bonuses
  return importanceNorm * 0.5 + relevance * 0.5 + pinBoost + recencyBoost;
}

async function retrieveRelevant(
  agentId: string,
  query: string,
  k: number = 10
): Promise<Memory[]> {
  const allMemories = await memoryStore.listByAgent(agentId);
  const scored = allMemories.map(m => ({ mem: m, score: scoreMemory(m, query) }));
  scored.sort((a, b) => b.score - a.score);

  const topK = scored.slice(0, k).map(s => s.mem);

  // Update access tracking
  const now = new Date().toISOString();
  for (const mem of topK) {
    await memoryStore.touch(mem.id, now);
  }

  return topK;
}
```

##### 4.2.3.4 Injeksi ke System Prompt

Memori yang retrieved **otomatis disisipkan** ke system prompt agent di section `## Memory`:

```typescript
async function getContextForPrompt(
  agentId: string,
  query: string
): Promise<string> {
  const relevant = await retrieveRelevant(agentId, query, 10);
  const pinned = await memoryStore.listPinned(agentId);
  const latestSummary = await summaryStore.getLatestForAgent(agentId);

  let contextBlock = '## Memory\n\n';

  if (pinned.length > 0) {
    contextBlock += '### Pinned (Always Relevant)\n';
    for (const mem of pinned) {
      contextBlock += `- ${mem.content}\n`;
    }
    contextBlock += '\n';
  }

  if (relevant.length > 0) {
    contextBlock += '### Relevant to Current Query\n';
    for (const mem of relevant) {
      contextBlock += `- [${mem.category}] ${mem.content}\n`;
    }
    contextBlock += '\n';
  }

  if (latestSummary) {
    contextBlock += '### Recent Conversation Context\n';
    contextBlock += latestSummary.summary + '\n';
  }

  return contextBlock.trim();
}
```

**Final system prompt yang dikirim ke LLM:**

```
[Provider system_prompt_prefix, if any]
+
[Agent system_prompt]
+
[Memory context block — auto-injected]
+
[Team instructions, if any]
```

#### 4.2.4 User Control

Pengguna memiliki kontrol penuh atas memori melalui halaman **Memory Manager**:

| Aksi | UI Element | API Endpoint |
|------|-------------|--------------|
| View all memories | Table/list dengan filter (category, type, pinned) | `GET /api/memories?agentId=` |
| Add memory manually | Form dengan importance slider | `POST /api/memories` |
| Edit memory | Inline editor atau modal | `PATCH /api/memories/:id` |
| Delete memory | Delete button + confirm | `DELETE /api/memories/:id` |
| Pin/Unpin memory | Star icon toggle | `PATCH /api/memories/:id` `{is_pinned}` |
| Toggle auto-extract | Settings toggle | `PATCH /api/settings` `{memoryAutoExtract}` |
| Set importance threshold | Settings slider (0.0-1.0) | `PATCH /api/settings` `{memoryThreshold}` |
| Clear all memories | Danger zone button + double confirm | `DELETE /api/memories?agentId=` |
| Export memories | JSON download | `GET /api/memories/export?agentId=` |
| Import memories | File picker + JSON | `POST /api/memories/import` |

#### 4.2.5 Settings

| Setting | Default | Range | Deskripsi |
|---------|---------|-------|-----------|
| `memoryAutoExtract` | `true` | bool | Auto-extract on every turn |
| `memoryExtractionMethod` | `'llm'` | `'llm'`\|`'heuristic'`\|`'both'` | Metode ekstraksi |
| `memoryThreshold` | `0.3` | 0.0-1.0 | Importance minimum untuk disimpan |
| `memoryTopK` | `10` | 1-50 | Jumlah memori yang di-inject per turn |
| `memoryConsolidationTrigger` | `'on_close'` | `'on_close'`\|`'every_50'`\|`'manual'` | Kapan consolidate |
| `memoryIncludeInPrompt` | `true` | bool | Master switch |

#### 4.2.6 Skema Database

Lengkap sesuai `src/main/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'long_term',
  content TEXT NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5,
  category TEXT,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  source_message_id TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (source_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_agent_importance ON memories(agent_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_agent_pinned ON memories(agent_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_memories_agent_type ON memories(agent_id, type);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(agent_id, category);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  chatroom_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  start_message_id TEXT,
  end_message_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (start_message_id) REFERENCES messages(id) ON DELETE SET NULL,
  FOREIGN KEY (end_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_summaries_agent ON conversation_summaries(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_chatroom ON conversation_summaries(chatroom_id, created_at DESC);
```

#### 4.2.7 Memory Manager API (Method Signatures)

```typescript
interface MemoryManager {
  // Retrieval
  retrieveRelevant(agentId: string, query: string, k?: number): Promise<Memory[]>;
  getContextForPrompt(agentId: string, query: string): Promise<string>;
  getLatestSummary(agentId: string): Promise<ConversationSummary | null>;

  // Extraction & Storage
  extractAndStore(
    agentId: string,
    text: string,
    sourceMessageId?: string
  ): Promise<Memory[]>;                      // heuristic

  extractAndStoreLLM(
    agentId: string,
    text: string,
    sourceMessageId?: string
  ): Promise<Memory[]>;                      // LLM-based

  // Consolidation
  consolidate(agentId: string, chatRoomId: string): Promise<ConversationSummary>;

  // CRUD
  create(agentId: string, data: Partial<Memory>): Promise<Memory>;
  update(id: string, data: Partial<Memory>): Promise<Memory>;
  delete(id: string): Promise<void>;
  list(agentId: string, filters?: MemoryFilters): Promise<Memory[]>;
  pin(id: string, pinned: boolean): Promise<void>;
  touch(id: string, accessedAt: string): Promise<void>;
  export(agentId: string): Promise<string>; // JSON
  import(agentId: string, json: string): Promise<number>;
}
```

#### 4.2.8 Memory Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEMORY LIFECYCLE                             │
└─────────────────────────────────────────────────────────────────┘

   User Message
        │
        ▼
   ┌─────────────────┐
   │ Orchestrator    │
   │ receives msg    │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Retrieve        │──── SQLite query ──────┐
   │ relevant        │                        │
   │ memories (topK) │                        │
   └────────┬────────┘                        │
            │                                 │
            ▼                                 ▼
   ┌─────────────────┐              ┌──────────────────┐
   │ Inject into     │◄────────────│ memories table   │
   │ system prompt   │              │ (long_term)      │
   └────────┬────────┘              └──────────────────┘
            │                                 ▲
            ▼                                 │
   ┌─────────────────┐                        │
   │ Send to LLM     │                        │
   │ (streaming)     │                        │
   └────────┬────────┘                        │
            │                                 │
            ▼                                 │
   ┌─────────────────┐                        │
   │ Agent response  │                        │
   └────────┬────────┘                        │
            │                                 │
            ├──── tool_calls? ────► Skill Exec │
            │                                 │
            ▼                                 │
   ┌─────────────────┐                        │
   │ Extract memories│                        │
   │ (LLM/heuristic) │──── create() ──────────┘
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Persist message │
   │ + tool_executions│
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Update UI       │
   │ (stream)        │
   └─────────────────┘

   [Periodic / On Close]
            │
            ▼
   ┌─────────────────┐
   │ consolidate()   │──── insert into ───► conversation_summaries
   │ (LLM summary)   │
   └─────────────────┘
```

#### 4.2.9 Contoh Konkret Memori Bekerja

**Sesi 1 (22 Juni 2026):**

```
User: "Saya pakai PostgreSQL 15 di semua project backend"
Agent: "Baik, saya catat preferensi Anda."
       → Memory tersimpan:
         { content: "User uses PostgreSQL 15 for all backend projects",
           importance: 0.8, category: "preference" }
```

**Restart aplikasi, buka chat baru (25 Juni 2026):**

```
User: "Bantu saya desain schema database baru"
Agent: [Memory retrieval triggered]
       System prompt includes:
         ## Memory
         - [preference] User uses PostgreSQL 15 for all backend projects

Agent: "Tentu! Karena Anda pakai PostgreSQL 15, saya sarankan 
        beberapa fitur spesifik seperti... [jawaban kontekstual]"
```

**Ini adalah kekuatan utama Office AI Agent.**

---

### 4.3 Agent Orchestrator

#### 4.3.1 Definisi

Orchestrator adalah komponen **backend** yang mengkoordinasikan banyak agent dalam satu chatroom dengan pola **supervisor + delegation**.

#### 4.3.2 Pola Arsitektur

```
                    ┌──────────────────┐
                    │   USER MESSAGE   │
                    └────────┬─────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │      ORCHESTRATOR            │
              │  (detect @mentions, lead)    │
              └──────────────┬───────────────┘
                             │
              ┌──────────────┴───────────────┐
              │                              │
              ▼                              ▼
   ┌────────────────────┐        ┌────────────────────┐
   │  LEAD AGENT        │        │  MENTIONED AGENTS  │
   │  (always first)    │        │  (@alice, @bob)    │
   └─────────┬──────────┘        └─────────┬──────────┘
             │                              │
             │    delegate?                 │
             ├──────────────►               │
             │                              │
             ▼                              ▼
   ┌──────────────────────────────────────────────┐
   │  AGENT RUNNER (per agent)                    │
   │  • Memory retrieve                           │
   │  • Build prompt                              │
   │  • Stream LLM                                │
   │  • Tool execution (max 8 iterations)         │
   │  • Memory extract & store                    │
   │  • Emit events                               │
   └──────────────────────────────────────────────┘
```

#### 4.3.3 Mention Detection

Pengguna dapat mention agent dengan syntax `@agent-name`:

```
User: "@coderbot tolong refactor file ini, @reviewer tolong cek"
       │         │                     │
       └─────────┴─────────────────────┴── detected via regex: /@([a-z0-9_-]+)/gi
```

Mentioned agents diprioritaskan. Lead agent tetap merespons duluan (kecuali tidak ada lead).

#### 4.3.4 Lead-First then Chime-In Flow

```
Step 1: Lead agent mulai generate (stream ke UI)
Step 2: Mentioned agents menerima pesan + konteks lead
Step 3: Mentioned agents generate paralel (setelah lead selesai atau YIELD event)
Step 4: Semua response di-broadcast ke UI sebagai message stream
Step 5: User bisa interject kapan saja
```

#### 4.3.5 Streaming Response

LLM response di-stream token-by-token via SSE (Server-Sent Events) atau IPC events:

```typescript
// Event bus pattern
eventBus.emit('agent:stream', {
  agentId,
  chatRoomId,
  messageId,
  delta: '...',          // incremental text
  done: false,
});

eventBus.emit('agent:tool_call', {
  agentId,
  messageId,
  toolName: 'terminal',
  args: { command: 'ls' },
});

eventBus.emit('agent:tool_result', {
  agentId,
  messageId,
  toolName: 'terminal',
  result: 'file1.txt\nfile2.txt',
});

eventBus.emit('agent:done', {
  agentId,
  messageId,
  fullContent: '...',
});
```

#### 4.3.6 Tool-Call Iteration Limit

Untuk mencegah infinite loop, setiap turn agent dibatasi **maksimal 8 tool-call iterations**:

```typescript
const MAX_TOOL_ITERATIONS = 8;
let iteration = 0;

while (iteration < MAX_TOOL_ITERATIONS) {
  const response = await provider.chat(messages, { tools, stream: true });
  if (!response.tool_calls || response.tool_calls.length === 0) break;

  for (const call of response.tool_calls) {
    const result = await skillRegistry.execute(call, context);
    messages.push({ role: 'tool', tool_call_id: call.id, content: result });
  }
  iteration++;
}

if (iteration >= MAX_TOOL_ITERATIONS) {
  logger.warn(`Agent ${agentId} hit max tool iterations`);
}
```

#### 4.3.7 Inter-Agent Messaging

Lead agent dapat mendelegasikan via `agent_delegate` skill:

```
LLM emits tool_call:
  agent_delegate({ agentName: "reviewer", task: "Cek kode ini untuk bug" })
                              ↓
Orchestrator invokes reviewer agent
                              ↓
Reviewer runs (with own memory + skills)
                              ↓
Result returned to lead agent as tool result
                              ↓
Lead agent continues generation with new context
```

---

### 4.4 Chatroom

#### 4.4.1 Definisi

Chatroom adalah **container percakapan** yang berisi user + beberapa agent.

#### 4.4.2 Properti

| Properti | Tipe | Deskripsi |
|----------|------|-----------|
| `id` | UUID | Identifier |
| `name` | string | Nama chatroom |
| `description` | string? | Deskripsi |
| `team_id` | UUID? | Tim terkait |
| `type` | enum (`team`/`dm`/`scratch`) | Tipe |
| `created_at` | ISO timestamp | Waktu dibuat |

#### 4.4.3 Partisipan

```sql
CREATE TABLE chatroom_agents (
  chatroom_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  PRIMARY KEY (chatroom_id, agent_id),
  FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
```

#### 4.4.4 UI Features

- **Real-time streaming** dengan token-by-token render
- **Markdown rendering** (marked) + syntax highlighting (highlight.js)
- **Code blocks** dengan copy button & language label
- **Tool call display** (collapsible card showing args + result)
- **Message status** (sending / streaming / done / error)
- **History persisted** di SQLite (table `messages`)
- **Search** dalam chatroom (full-text)
- **@mention autocomplete** saat user mengetik `@`
- **Multi-select message actions** (copy, delete, regenerate)
- **Regenerate response** dengan feedback (e.g., "lebih ringkas")
- **Stop generation** button (abort signal)

#### 4.4.5 Message Schema

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chatroom_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,    -- 'user' | 'agent' | 'system'
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  role TEXT,                    -- 'user' | 'assistant' | 'system' | 'tool'
  tool_calls TEXT,              -- JSON
  tool_call_id TEXT,
  parent_id TEXT,               -- for branching
  created_at TEXT NOT NULL,
  metadata TEXT,                -- JSON
  is_streaming INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_messages_chatroom_created ON messages(chatroom_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_messages_parent ON messages(parent_id);
```

---

### 4.5 Teams

#### 4.5.1 Definisi

Team adalah **grup agent** yang bekerja bersama. Setiap team bisa punya *lead agent*, *team instructions*, dan *default chatroom*.

#### 4.5.2 Properti

| Properti | Tipe | Deskripsi |
|----------|------|-----------|
| `id` | UUID | Identifier |
| `name` | string | Nama tim (e.g., "Engineering Team") |
| `description` | string? | Deskripsi |
| `instructions` | string? | Instruksi level tim (di-inject ke semua agent member) |
| `color` | string? | Warna UI |
| `avatar` | string? | Emoji/URL |

#### 4.5.3 Roles

- **`lead`** — Agent utama yang merespons duluan. Hanya 1 lead per team.
- **`member`** — Agent biasa, hanya merespons jika di-mention atau di-delegate.
- **`observer`** — Agent yang hanya mengamati (silent), bisa di-mention.

#### 4.5.4 Default Chatroom

Setiap team otomatis dibuatkan **default chatroom** saat pembuatan. User dapat membuat chatrooms tambahan.

---

### 4.6 Custom LLM Provider

#### 4.6.1 Konsep

Pengguna bebas menambahkan **unlimited** LLM provider yang OpenAI-compatible. Tidak ada hardcode pada vendor tertentu.

#### 4.6.2 Fields

| Field | Tipe | Wajib | Deskripsi |
|-------|------|-------|-----------|
| `name` | string | ✓ | Nama display (e.g., "My Ollama") |
| `baseUrl` | string | ✓ | Base URL API endpoint |
| `apiKey` | string | ✗ | API key (encrypted saat disimpan) |
| `model` | string | ✓ | Model name (e.g., `gpt-4o`, `llama3.1:70b`) |
| `temperature` | float | ✗ | Default 0.7 |
| `maxTokens` | int | ✗ | Default 4096 |
| `topP` | float | ✗ | Default 1.0 |
| `systemPromptPrefix` | string | ✗ | Prefix global |
| `headers` | JSON | ✗ | Custom HTTP headers |
| `isDefault` | bool | ✗ | Provider default |

#### 4.6.3 Preset Templates

```typescript
const PRESETS = [
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    defaultModel: 'gpt-4o-mini',
  },
  {
    name: 'Ollama (Local)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    requiresApiKey: false,
    defaultModel: 'llama3.1',
  },
  {
    name: 'LM Studio',
    baseUrl: 'http://127.0.0.1:1234/v1',
    requiresApiKey: false,
    defaultModel: 'loaded-model',
  },
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    defaultModel: 'llama-3.1-70b-versatile',
  },
  {
    name: 'Together',
    baseUrl: 'https://api.together.xyz/v1',
    requiresApiKey: true,
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  },
  {
    name: 'Custom',
    baseUrl: '',
    requiresApiKey: false,
    defaultModel: '',
  },
];
```

#### 4.6.4 Test Connection

Tombol **"Test Connection"** melakukan:

```typescript
async function testConnection(provider: LLMProvider): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${decryptApiKey(provider.api_key_encrypted)}`,
        ...JSON.parse(provider.headers || '{}'),
      },
      signal: AbortSignal.timeout(10_000),
    });
    const latency = Date.now() - start;

    if (!response.ok) {
      return { success: false, latency, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      success: true,
      latency,
      models: data.data?.map((m: any) => m.id) || [],
    };
  } catch (err) {
    return { success: false, latency: Date.now() - start, error: String(err) };
  }
}
```

UI menampilkan: ✅ "Connected in 234ms · 12 models available" atau ❌ error message.

#### 4.6.5 List Models

Memanggil `GET {baseUrl}/models` dan mengembalikan list model ID untuk dropdown.

#### 4.6.6 Encryption

API key **TIDAK PERNAH** disimpan plaintext. Dua lapis:

1. **Primary:** `safeStorage` (Electron) → OS keychain (DPAPI di Windows, Keychain di macOS)
2. **Fallback:** AES-256-GCM dengan key derived dari `scrypt(machineId + username)`

```typescript
async function encryptApiKey(plaintext: string): Promise<string> {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(plaintext);
    return `safe:${encrypted.toString('base64')}`;
  }
  // Fallback: AES-256-GCM
  const key = deriveKey(); // scrypt(secret, salt)
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `aes:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}
```

---

### 4.7 Localhost Server

#### 4.7.1 Tujuan

- Memungkinkan **external integration** (script, browser, automation tools) berinteraksi dengan Office AI Agent via HTTP.
- **Read-only safety**: server hanya listen di `127.0.0.1` (localhost), tidak bisa diakses dari jaringan.

#### 4.7.2 Konfigurasi

| Setting | Default | Deskripsi |
|---------|---------|-----------|
| `serverEnabled` | `false` | Master switch |
| `serverHost` | `127.0.0.1` | Bind address (hanya loopback) |
| `serverPort` | `3939` | Port |

#### 4.7.3 Endpoints

```
GET  /health
  → { status: "ok", version: "1.0.0", uptime: 12345 }

GET  /api/info
  → { agents: 5, teams: 2, chatrooms: 8, memories: 142, ... }

GET  /api/agents
  → [{ id, name, description, role, team_id, ... }]

GET  /api/teams
  → [{ id, name, description, ... }]

GET  /api/chatrooms
  → [{ id, name, team_id, ... }]

GET  /api/chatrooms/:id/messages
  → [{ id, sender_type, content, created_at, ... }]

GET  /api/memories?agentId=xxx
  → [{ id, content, importance, category, ... }]

POST /api/chatrooms/:id/messages
  Body: { content: "...", mentions: ["agent-id-1"] }
  → { messageId, agentResponses: [...] }

GET  /workspace/*
  → Static file serving dari default workspace
  ⛔ Path traversal protection: reject `..`, encoded variants, absolute paths
```

#### 4.7.4 Path Traversal Protection

```typescript
function safeResolvePath(rootDir: string, requested: string): string | null {
  const normalized = path.normalize(requested).replace(/^(\.\.[\/\\])+/, '');
  const resolved = path.resolve(rootDir, normalized);
  if (!resolved.startsWith(path.resolve(rootDir))) {
    return null; // Attempted escape
  }
  return resolved;
}

// In handler:
const safe = safeResolvePath(WORKSPACE_ROOT, req.url);
if (!safe) return res.status(403).send('Forbidden');
```

---

### 4.8 Workspace

#### 4.8.1 Konsep

Workspace adalah **working directory** yang terasosiasi dengan team atau agent. File di workspace dapat diakses oleh agent melalui `file_system` skill.

#### 4.8.2 Properti

```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

#### 4.8.3 Features

- **File browser** (1 level deep, non-recursive untuk v1)
- **File read** dengan limit **1 MB** per file
- **Open in OS** — klik kanan → "Open in Explorer/Finder"
- **Set as default workspace** (satu aktif pada satu waktu)
- **Per-team workspace assignment** (di `teams.path` atau via relasi terpisah)

---

## 5. Arsitektur Teknis

### 5.1 Tech Stack

| Layer | Technology | Versi |
|-------|------------|-------|
| **Desktop Runtime** | Electron | 31.x |
| **Main Process** | Node.js | 20.x LTS |
| **Renderer Process** | React | 18.x |
| **Language** | TypeScript | 5.x (strict mode) |
| **Build Tool (Renderer)** | Vite | 5.x |
| **Build Tool (Main)** | esbuild | 0.23.x |
| **Styling** | TailwindCSS | 3.x |
| **State Management** | Zustand | 4.x |
| **Routing** | React Router | v6 |
| **Database** | better-sqlite3 | 11.x |
| **Markdown** | marked | 12.x |
| **Code Highlight** | highlight.js | 11.x |
| **Icons** | lucide-react | latest |
| **Terminal** | xterm.js | 5.x |
| **Packaging** | electron-builder | 24.x |
| **Target Platforms** | Windows 10+ (NSIS), macOS 11+ (DMG x64+arm64) | — |

### 5.2 Process Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ELECTRON MAIN PROCESS (Node.js)                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Database   │  │ LLM Provider │  │     Orchestrator Engine  │  │
│  │  (SQLite)    │  │   Manager    │  │  ┌────────────────────┐  │  │
│  │              │  │              │  │  │   Agent Runner     │  │  │
│  │ • agents     │  │ • OpenAI     │  │  │   (per agent)      │  │  │
│  │ • memories   │  │ • Ollama     │  │  └────────────────────┘  │  │
│  │ • messages   │  │ • LM Studio  │  │  ┌────────────────────┐  │  │
│  │ • teams      │  │ • Custom     │  │  │  Memory Manager    │  │  │
│  │ • settings   │  │              │  │  │  (⭐ CRITICAL)     │  │  │
│  └──────────────┘  └──────────────┘  │  └────────────────────┘  │  │
│                                       │  ┌────────────────────┐  │  │
│  ┌──────────────┐  ┌──────────────┐  │  │   Event Bus        │  │  │
│  │   Skills     │  │  Localhost   │  │  │   (pub/sub)        │  │  │
│  │  Registry    │  │   Server     │  │  └────────────────────┘  │  │
│  │              │  │              │  └──────────────────────────┘  │
│  │ • terminal   │  │ • /health    │                                │
│  │ • web_fetch  │  │ • /api/*     │  ┌──────────────────────────┐  │
│  │ • file_sys   │  │ • /workspace │  │  Security (crypto)       │  │
│  │ • http_req   │  │              │  │  • safeStorage          │  │
│  │ • memory_ops │  └──────────────┘  │  • AES-256-GCM fallback │  │
│  │ • agent_del  │                    └──────────────────────────┘  │
│  └──────────────┘                                                   │
│                                                                     │
│  ┌──────────────┐  ┌────────────────────────────────────────────┐  │
│  │   Window     │  │           IPC Handlers                      │  │
│  │   Manager    │  │  ipcMain.handle('chatroom:send', ...)       │  │
│  │              │  │  ipcMain.handle('agents:list', ...)         │  │
│  └──────────────┘  │  ipcMain.handle('memories:search', ...)     │  │
│                    └────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ contextBridge
                               ▼
                    ┌──────────────────────────┐
                    │    PRELOAD SCRIPT        │
                    │   (officeAPI global)    │
                    └──────────────┬───────────┘
                                   │ window.officeAPI.*
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS (React)                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  PAGES                                                       │  │
│  │  • Dashboard     • ChatRoom      • Agents                     │  │
│  │  • Teams         • Skills        • Settings                   │  │
│  │  • Memory        • Workspace                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  COMPONENTS                                                   │  │
│  │  • MessageList, MessageBubble, ToolCallCard                  │  │
│  │  • AgentCard, TeamCard, SkillToggle                           │  │
│  │  • ProviderForm, MemoryRow, FileTree                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  STORES (Zustand)                                             │  │
│  │  • useChatStore    • useAgentStore   • useProviderStore       │  │
│  │  • useMemoryStore  • useSettingsStore • useWorkspaceStore     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  HOOKS                                                        │  │
│  │  • useStreamingChat  • useMemoryContext  • useEventBus        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Data Flow Diagram

```
   ┌──────────┐
   │   USER   │
   └────┬─────┘
        │ types message
        ▼
   ┌──────────────────────────────────────────┐
   │  ChatRoom Component (React)              │
   │  • Update optimistic UI                  │
   │  • Call officeAPI.chatroom.send()        │
   └────────────┬─────────────────────────────┘
                │ IPC
                ▼
   ┌──────────────────────────────────────────┐
   │  IPC Handler (Main)                      │
   │  • Persist user message to DB            │
   │  • Call orchestrator.handleUserMessage() │
   └────────────┬─────────────────────────────┘
                │
                ▼
   ┌──────────────────────────────────────────┐
   │  Orchestrator                            │
   │  • Detect @mentions                      │
   │  • Determine participating agents        │
   │  • For each agent:                       │
   └────────────┬─────────────────────────────┘
                │
                ▼
   ┌──────────────────────────────────────────┐
   │  AgentRunner                             │
   │  1. retrieveRelevant(agentId, query) ◄──── Memory Manager
   │  2. Build prompt:                        │
   │     [systemPromptPrefix]                 │
   │     + [agent.systemPrompt]               │
   │     + [## Memory block]                  │
   │     + [team instructions]                │
   │     + [conversation history]             │
   │  3. Call provider.chat(stream=true)      │
   └────────────┬─────────────────────────────┘
                │ SSE / fetch stream
                ▼
   ┌──────────────────────────────────────────┐
   │  LLM Provider (OpenAI-compatible)        │
   │  • Stream tokens back                    │
   └────────────┬─────────────────────────────┘
                │
                ▼
   ┌──────────────────────────────────────────┐
   │  AgentRunner (continued)                 │
   │  • Emit 'agent:stream' events            │
   │  • If tool_call: execute skill, loop     │
   │  • Max 8 iterations                      │
   │  • On done: extractAndStoreLLM()         │
   └────────────┬─────────────────────────────┘
                │ emit events
                ▼
   ┌──────────────────────────────────────────┐
   │  Event Bus → IPC → Renderer              │
   │  • 'agent:stream' → append token         │
   │  • 'agent:tool_call' → render card       │
   │  • 'agent:done' → finalize message       │
   └──────────────────────────────────────────┘
```

### 5.4 Build & Distribution

```bash
# Development
npm run dev          # Vite + Electron with HMR
npm run dev:main     # Watch main process only

# Production
npm run build        # Bundle renderer + main
npm run dist:win     # electron-builder --win nsis
npm run dist:mac     # electron-builder --mac dmg --x64 --arm64

# Output
dist/Office AI Agent-1.0.0.exe          (~150 MB)
dist/Office AI Agent-1.0.0-arm64.dmg    (~140 MB)
```

### 5.5 Project Structure

```
teamai/
├── package.json
├── tsconfig.json
├── electron-builder.yml
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── main/                       # Electron main process
│   │   ├── index.ts                # Entry point
│   │   ├── db/
│   │   │   ├── schema.sql          # ⭐ Source of truth
│   │   │   ├── migrations.ts
│   │   │   └── index.ts            # Database singleton
│   │   ├── llm/
│   │   │   ├── provider.ts         # OpenAI-compatible client
│   │   │   └── manager.ts          # Provider registry
│   │   ├── orchestrator/
│   │   │   ├── orchestrator.ts
│   │   │   ├── agent-runner.ts
│   │   │   └── event-bus.ts
│   │   ├── memory/                 # ⭐ CRITICAL MODULE
│   │   │   ├── memory-manager.ts
│   │   │   ├── extraction.ts       # LLM + heuristic
│   │   │   ├── retrieval.ts        # Scoring & ranking
│   │   │   └── consolidation.ts    # Conversation summaries
│   │   ├── skills/
│   │   │   ├── registry.ts
│   │   │   ├── terminal.ts
│   │   │   ├── web_fetch.ts
│   │   │   ├── file_system.ts
│   │   │   ├── http_request.ts
│   │   │   ├── code_exec.ts
│   │   │   ├── memory_ops.ts
│   │   │   └── agent_delegate.ts
│   │   ├── server/                 # Localhost HTTP server
│   │   │   └── index.ts
│   │   ├── security/
│   │   │   └── crypto.ts           # safeStorage + AES-256-GCM
│   │   ├── workspace/
│   │   │   └── index.ts
│   │   └── ipc/                    # IPC handlers
│   ├── preload/
│   │   └── index.ts                # contextBridge: officeAPI
│   ├── renderer/                   # React app
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   ├── stores/                 # Zustand
│   │   ├── hooks/
│   │   └── styles/
│   └── shared/
│       └── types.ts                # Shared types
├── assets/
│   ├── icons/
│   └── locales/
└── docs/
    └── PRD.md                      # This document
```

---

## 6. Data Models

### 6.1 Full SQLite Schema (dari `src/main/db/schema.sql`)

```sql
-- ============================================================
-- Office AI Agent — SQLite Schema (v1)
-- All IDs are TEXT (UUIDs). Timestamps are ISO 8601 TEXT.
-- ============================================================

-- LLM PROVIDERS
CREATE TABLE IF NOT EXISTS llm_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  model TEXT NOT NULL,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  top_p REAL DEFAULT 1.0,
  system_prompt_prefix TEXT,
  is_default INTEGER DEFAULT 0,
  headers TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_llm_providers_default ON llm_providers(is_default);

-- TEAMS
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  color TEXT,
  avatar TEXT,
  created_at TEXT NOT NULL
);

-- AGENTS
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT,
  system_prompt TEXT NOT NULL DEFAULT '',
  provider_id TEXT NOT NULL,
  team_id TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  color TEXT,
  is_lead INTEGER NOT NULL DEFAULT 0,
  temperature REAL,
  max_tokens INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES llm_providers(id) ON DELETE RESTRICT,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);
CREATE INDEX idx_agents_team ON agents(team_id);
CREATE INDEX idx_agents_provider ON agents(provider_id);

-- AGENT SKILLS (many-to-many with config)
CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT,
  PRIMARY KEY (agent_id, skill_name),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
CREATE INDEX idx_agent_skills_agent ON agent_skills(agent_id);

-- CHATROOMS
CREATE TABLE IF NOT EXISTS chatrooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  team_id TEXT,
  type TEXT NOT NULL DEFAULT 'team',
  created_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);
CREATE INDEX idx_chatrooms_team ON chatrooms(team_id);

-- CHATROOM ↔ AGENTS (many-to-many)
CREATE TABLE IF NOT EXISTS chatroom_agents (
  chatroom_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  PRIMARY KEY (chatroom_id, agent_id),
  FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
CREATE INDEX idx_chatroom_agents_agent ON chatroom_agents(agent_id);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chatroom_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  role TEXT,
  tool_calls TEXT,
  tool_call_id TEXT,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  metadata TEXT,
  is_streaming INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
);
CREATE INDEX idx_messages_chatroom_created ON messages(chatroom_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_messages_parent ON messages(parent_id);

-- ⭐ MEMORIES (LONG-TERM) — CRITICAL
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'long_term',
  content TEXT NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5,
  category TEXT,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  source_message_id TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (source_message_id) REFERENCES messages(id) ON DELETE SET NULL
);
CREATE INDEX idx_memories_agent_importance ON memories(agent_id, importance DESC);
CREATE INDEX idx_memories_agent_pinned ON memories(agent_id, is_pinned);
CREATE INDEX idx_memories_agent_type ON memories(agent_id, type);
CREATE INDEX idx_memories_category ON memories(agent_id, category);

-- ⭐ CONVERSATION SUMMARIES (EPISODIC MEMORY) — CRITICAL
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  chatroom_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  start_message_id TEXT,
  end_message_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (start_message_id) REFERENCES messages(id) ON DELETE SET NULL,
  FOREIGN KEY (end_message_id) REFERENCES messages(id) ON DELETE SET NULL
);
CREATE INDEX idx_summaries_agent ON conversation_summaries(agent_id, created_at DESC);
CREATE INDEX idx_summaries_chatroom ON conversation_summaries(chatroom_id, created_at DESC);

-- TOOL EXECUTIONS
CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  arguments TEXT,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
CREATE INDEX idx_tool_exec_message ON tool_executions(message_id);
CREATE INDEX idx_tool_exec_status ON tool_executions(status);

-- SETTINGS (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

-- WORKSPACES
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_workspaces_default ON workspaces(is_default);

-- TRIGGERS (single default invariants)
CREATE TRIGGER IF NOT EXISTS trg_llm_providers_single_default
BEFORE UPDATE OF is_default ON llm_providers
WHEN NEW.is_default = 1
BEGIN
  UPDATE llm_providers SET is_default = 0
   WHERE id != NEW.id AND is_default = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_llm_providers_single_default_insert
BEFORE INSERT ON llm_providers
WHEN NEW.is_default = 1
BEGIN
  UPDATE llm_providers SET is_default = 0 WHERE is_default = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_workspaces_single_default
BEFORE UPDATE OF is_default ON workspaces
WHEN NEW.is_default = 1
BEGIN
  UPDATE workspaces SET is_default = 0 WHERE id != NEW.id AND is_default = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_workspaces_single_default_insert
BEFORE INSERT ON workspaces
WHEN NEW.is_default = 1
BEGIN
  UPDATE workspaces SET is_default = 0 WHERE is_default = 1;
END;
```

### 6.2 TypeScript Type Definitions

```typescript
// shared/types.ts

export type UUID = string;
export type ISOTimestamp = string;

export interface LLMProvider {
  id: UUID;
  name: string;
  base_url: string;
  api_key_encrypted?: string;
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  system_prompt_prefix?: string;
  is_default: boolean;
  headers?: Record<string, string>;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface Team {
  id: UUID;
  name: string;
  description?: string;
  instructions?: string;
  color?: string;
  avatar?: string;
  created_at: ISOTimestamp;
}

export interface Agent {
  id: UUID;
  name: string;
  description?: string;
  avatar?: string;
  system_prompt: string;
  provider_id: UUID;
  team_id?: UUID;
  role: 'lead' | 'member' | 'observer';
  color?: string;
  is_lead: boolean;
  temperature?: number;
  max_tokens?: number;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface AgentSkill {
  agent_id: UUID;
  skill_name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface Chatroom {
  id: UUID;
  name: string;
  description?: string;
  team_id?: UUID;
  type: 'team' | 'dm' | 'scratch';
  created_at: ISOTimestamp;
}

export interface Message {
  id: UUID;
  chatroom_id: UUID;
  sender_type: 'user' | 'agent' | 'system';
  sender_id: UUID;
  content: string;
  role?: 'user' | 'assistant' | 'system' | 'tool';
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  parent_id?: UUID;
  created_at: ISOTimestamp;
  metadata?: Record<string, any>;
  is_streaming: boolean;
}

// ⭐ CRITICAL TYPE
export interface Memory {
  id: UUID;
  agent_id: UUID;
  type: 'short_term' | 'long_term' | 'episodic' | 'semantic';
  content: string;
  importance: number; // 0.0 - 1.0
  category?: 'preference' | 'fact' | 'task_pattern' | 'project' | 'personal';
  created_at: ISOTimestamp;
  last_accessed_at: ISOTimestamp;
  access_count: number;
  is_pinned: boolean;
  source_message_id?: UUID;
}

export interface ConversationSummary {
  id: UUID;
  agent_id: UUID;
  chatroom_id: UUID;
  summary: string;
  message_count: number;
  start_message_id?: UUID;
  end_message_id?: UUID;
  created_at: ISOTimestamp;
}

export interface ToolExecution {
  id: UUID;
  message_id: UUID;
  tool_name: string;
  arguments?: string;
  result?: string;
  status: 'pending' | 'success' | 'error';
  started_at: ISOTimestamp;
  completed_at?: ISOTimestamp;
  error?: string;
}

export interface Workspace {
  id: UUID;
  name: string;
  path: string;
  is_default: boolean;
  created_at: ISOTimestamp;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
```

### 6.3 Entity Relationship Diagram

```
┌────────────────┐         ┌────────────────┐         ┌────────────────┐
│ llm_providers  │◄────────│    agents      │────────►│    teams       │
│                │  1   N  │                │  N    1 │                │
│ id (PK)        │         │ id (PK)        │         │ id (PK)        │
│ name           │         │ name           │         │ name           │
│ base_url       │         │ system_prompt  │         │ instructions   │
│ model          │         │ provider_id(FK)│         └────────┬───────┘
│ ...            │         │ team_id (FK)   │                  │
└────────────────┘         │ role           │                  │
                           │ is_lead        │                  │
                           └────┬───────────┘                  │
                                │                              │
                                │ 1                            │
                                ▼ N                            │
                    ┌─────────────────────┐                    │
                    │  agent_skills       │                    │
                    │  agent_id (PK,FK)   │                    │
                    │  skill_name (PK)    │                    │
                    │  enabled            │                    │
                    │  config             │                    │
                    └─────────────────────┘                    │
                                                              │
   ┌─────────────────┐         ┌──────────────────┐           │
   │   messages      │◄────────│   chatrooms      │◄──────────┘
   │                 │  N    1 │                  │   N    1
   │ id (PK)         │         │ id (PK)          │
   │ chatroom_id(FK) │         │ team_id (FK)     │
   │ sender_type     │         │ name             │
   │ content         │         │ type             │
   │ tool_calls      │         └────────┬─────────┘
   │ ...             │                  │
   └────┬────────────┘                  │ 1
        │                               ▼ N
        │ N                ┌──────────────────────┐
        │                  │ chatroom_agents      │
        ▼ 1                │ chatroom_id (PK,FK)  │
   ┌─────────────────┐     │ agent_id (PK,FK)     │
   │ tool_executions │     └──────────────────────┘
   │ id (PK)         │
   │ message_id (FK) │
   │ tool_name       │
   │ status          │
   └─────────────────┘

   ┌─────────────────┐
   │ ⭐ memories     │  (Per-agent long-term memory)
   │ id (PK)         │
   │ agent_id (FK) ──┼──────► agents.id
   │ content         │
   │ importance      │
   │ category        │
   │ is_pinned       │
   │ source_msg_id   │
   └─────────────────┘

   ┌──────────────────────────┐
   │ ⭐ conversation_summaries│  (Episodic memory)
   │ id (PK)                  │
   │ agent_id (FK) ───────────┼──► agents.id
   │ chatroom_id (FK) ────────┼──► chatrooms.id
   │ summary                  │
   │ message_count            │
   └──────────────────────────┘
```

---

## 7. Security

### 7.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| API key leak ke disk | Encryption via `safeStorage` + AES-256-GCM fallback |
| XSS di renderer (markdown injection) | DOMPurify sanitization, CSP header |
| Renderer compromise | `contextIsolation=true`, `nodeIntegration=false`, sandboxed preload |
| Remote code execution via server | Localhost-only bind (127.0.0.1), firewall rules |
| Path traversal via /workspace/* | `path.resolve` + prefix check |
| Arbitrary command execution via terminal skill | Scoped to agent workspace path, optional command whitelist |
| Man-in-the-middle ke LLM API | HTTPS required untuk semua base_url preset (Ollama/LMStudio HTTP allowed karena localhost) |
| Memory injection (user menginput prompt yang membuat agent menyimpan memori palsu) | Importance threshold, user review UI, optional manual approval |

### 7.2 API Key Encryption (Detail)

```typescript
// src/main/security/crypto.ts
import { safeStorage } from 'electron';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { machineIdSync } from 'node-machine-id';
import { username } from 'os';

const ALGO = 'aes-256-gcm';

function deriveKey(): Buffer {
  const machineId = machineIdSync();
  const user = username();
  const salt = Buffer.from('office-ai-agent-v1', 'utf8');
  return scryptSync(`${machineId}:${user}`, salt, 32);
}

export function encryptApiKey(plaintext: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(plaintext);
    return `safe:${enc.toString('base64')}`;
  }
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `aes:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptApiKey(encrypted: string): string {
  if (encrypted.startsWith('safe:')) {
    return safeStorage.decryptString(Buffer.from(encrypted.slice(5), 'base64'));
  }
  if (encrypted.startsWith('aes:')) {
    const [, ivB64, tagB64, dataB64] = encrypted.split(':');
    const key = deriveKey();
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
  throw new Error('Unknown encryption format');
}
```

### 7.3 Electron Security Configuration

```typescript
// src/main/index.ts
const win = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,      // ✅ Isolasi JS context
    nodeIntegration: false,      // ✅ Tidak expose Node ke renderer
    sandbox: false,              // ⚠️ Sandbox=false karena preload butuh require
    preload: path.join(__dirname, '../preload/index.js'),
  },
});

// CSP Header
win.webContents.session.webRequest.onHeadersReceived((details, cb) => {
  cb({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self';",
        "script-src 'self';",
        "style-src 'self' 'unsafe-inline';",
        "connect-src 'self' http://127.0.0.1:* https://*;",
        "img-src 'self' data: blob:;",
      ].join(' '),
    },
  });
});
```

### 7.4 Localhost Server Hardening

- Bind ke `127.0.0.1` saja (bukan `0.0.0.0`)
- Tidak ada CORS (same-origin only)
- Rate limiting: max 100 req/min per IP
- Path traversal protection (lihat 4.7.4)
- Optional API key untuk endpoints `/api/*`

### 7.5 Terminal Skill Sandboxing

```typescript
// src/main/skills/terminal.ts
async function execute(args: { command: string }, ctx: SkillContext) {
  // Restrict to workspace
  const cwd = ctx.workspacePath;
  if (!cwd || !existsSync(cwd)) {
    throw new Error('No valid workspace');
  }

  // Optional: whitelist commands
  const whitelist = settings.terminalCommandWhitelist; // e.g., ['ls', 'cat', 'grep']
  const firstToken = args.command.split(/\s+/)[0];
  if (whitelist.length > 0 && !whitelist.includes(firstToken)) {
    throw new Error(`Command "${firstToken}" not in whitelist`);
  }

  return new Promise((resolve, reject) => {
    exec(args.command, { cwd, timeout: 30_000, maxBuffer: 1_024_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve({ stdout, stderr });
    });
  });
}
```

### 7.6 IPC Validation

Setiap IPC handler melakukan validasi input via Zod schema:

```typescript
import { z } from 'zod';

const SendMessageSchema = z.object({
  chatRoomId: z.string().uuid(),
  content: z.string().min(1).max(100_000),
  mentions: z.array(z.string().uuid()).optional(),
});

ipcMain.handle('chatroom:send', async (_evt, raw) => {
  const parsed = SendMessageSchema.parse(raw); // throws if invalid
  return await orchestrator.handleUserMessage(parsed);
});
```

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Metric | Target | Catatan |
|--------|--------|---------|
| First streaming token | < 2 detik | Dari klik "send" ke token pertama tampil |
| Memory retrieval (1K memories) | < 100 ms | `retrieveRelevant()` end-to-end |
| Memory extraction | < 3 detik | LLM-based extraction per turn |
| Database query (chatroom list) | < 50 ms | Untuk 100 chatrooms |
| App cold start | < 3 detik | Splash → main window ready |
| App memory footprint | < 500 MB | Idle, dengan 1 chatroom terbuka |
| Disk usage | < 200 MB | Excluding LLM provider data |

### 8.2 Compatibility

| Platform | Minimum |
|----------|---------|
| Windows | Windows 10 (build 19041+), 64-bit |
| macOS | macOS 11 Big Sur, Intel + Apple Silicon |
| Linux | Best-effort (Ubuntu 22.04+ tested) — **not officially supported v1** |
| Node.js | 20.x LTS (bundled in app) |

### 8.3 Reliability

- Crash-free rate: ≥ 99.5%
- Auto-save chat state setiap 5 detik
- SQLite WAL mode untuk concurrent reads
- Graceful shutdown: save in-flight messages sebelum quit

### 8.4 Privacy & Data Sovereignty

- **100% data lokal** — semua agent, memori, pesan ada di SQLite lokal
- Zero telemetry (no analytics SDK)
- Zero remote API calls kecuali ke LLM provider yang user tambahkan
- Backup/export user-controlled

### 8.5 Offline Capability

- App dapat berjalan offline **selama** provider LLM lokal (Ollama, LM Studio) digunakan
- External providers (OpenAI, dll) membutuhkan internet

### 8.6 Accessibility

- Keyboard navigation lengkap (Tab, Enter, Esc, Arrow keys)
- Screen reader support (ARIA labels)
- High-contrast mode
- Font size scaling
- Focus indicators jelas

### 8.7 Internationalization

- UI strings di-extract ke `locales/en.json`, `locales/id.json`
- Default: English
- Bahasa Indonesia fully supported (matching user style)
- Date/time formatting via `Intl`

---

## 9. User Flows

### 9.1 Flow 1 — First Launch

```
┌─────────────────────────────────────────────────────────┐
│  1. User double-clicks Office AI Agent.exe              │
│                                                         │
│  2. Splash screen dengan logo + loading                 │
│                                                         │
│  3. Setup Wizard muncul (jika belum ada LLM provider):  │
│     ┌──────────────────────────────────────────┐        │
│     │  Welcome to Office AI Agent!             │        │
│     │                                          │        │
│     │  To get started, add an LLM provider:    │        │
│     │  • OpenAI (cloud)                        │        │
│     │  • Ollama (local, recommended for dev)   │        │
│     │  • LM Studio (local GUI)                 │        │
│     │  • Custom (OpenAI-compatible)            │        │
│     │                                          │        │
│     │  [Get OpenAI Key]  [Setup Ollama Guide]  │        │
│     │                                          │        │
│     │  [Continue →]                            │        │
│     └──────────────────────────────────────────┘        │
│                                                         │
│  4. User pilih preset → fill form → Test Connection     │
│                                                         │
│  5. Success: "Connected! 12 models available"           │
│                                                         │
│  6. Welcome tour (3 slides):                            │
│     • Create your first agent                           │
│     • Start a chatroom                                  │
│     • ⭐ Your agent will remember everything            │
│                                                         │
│  7. Redirect ke Dashboard                               │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Flow 2 — Add LLM Provider

```
Settings → LLM Providers → [+ Add Provider]

Form:
  Preset: [Ollama ▼]
  Name: [My Local Ollama]
  Base URL: [http://127.0.0.1:11434/v1]
  API Key: (kosongkan untuk Ollama)
  Model: [llama3.1 ▼]  ← fetched via GET /models
  Temperature: [0.7]
  Max Tokens: [4096]
  ☑ Set as default

[Test Connection] → ✅ Connected in 45ms · 23 models
[Save]
```

### 9.3 Flow 3 — Create Agent

```
Dashboard → Agents → [+ New Agent]

Form:
  Name: [CoderBot]
  Avatar: [🤖]
  Description: [Senior backend engineer, Node.js & PostgreSQL]
  System Prompt:
    ┌──────────────────────────────────────────────────┐
    │ You are a senior backend engineer specializing  │
    │ in Node.js, TypeScript, and PostgreSQL.          │
    │                                                  │
    │ Communication style:                             │
    │ - Concise and technical                          │
    │ - Always cite file paths                         │
    │ - Prefer TypeScript strict mode                  │
    │                                                  │
    │ When writing code:                               │
    │ - Include proper error handling                  │
    │ - Add JSDoc comments                             │
    │ - Follow SOLID principles                        │
    └──────────────────────────────────────────────────┘

  LLM Provider: [My Local Ollama ▼]
  Team: [Engineering ▼]
  Role: ( ) Lead  (•) Member  ( ) Observer

  Skills:
    ☑ terminal        (execute shell commands)
    ☑ file_system     (read/write files)
    ☐ web_fetch       (fetch URLs)
    ☑ code_exec       (run code snippets)
    ☐ http_request
    ☑ memory_ops      (manual memory control)

  [Save & Test] → "Hello, I'm CoderBot. Ready to code!"
```

### 9.4 Flow 4 — Create Team & Chatroom

```
Teams → [+ New Team]
  Name: [Engineering Team]
  Description: [Backend dev crew]
  Instructions: [Always follow coding standards. Use English in responses.]
  Color: [#3B82F6]

  Members:
    ☑ CoderBot (lead)
    ☑ ReviewerBot (member)
    ☐ TesterBot (member)

  Default Chatroom: ✅ (auto-created: "Engineering Team #general")

[Create]
```

### 9.5 Flow 5 — Start Chatroom

```
ChatRoom view:
  ┌────────────────────────────────────────────────────┐
  │  Engineering Team #general                  [⋯]   │
  ├────────────────────────────────────────────────────┤
  │  Participants:                                     │
  │    🧑 You                                          │
  │    🤖 CoderBot (lead)                              │
  │    👀 ReviewerBot (member)                         │
  │                                                    │
  │  ┌──────────────────────────────────────────────┐  │
  │  │ 🧑 You:                                      │  │
  │  │ Tolong buatkan REST API untuk user CRUD      │  │
  │  │ pakai Express + TypeScript.                   │  │
  │  │                                              │  │
  │  │ @reviewer tolong stand by buat review ya    │  │
  │  └──────────────────────────────────────────────┘  │
  │                                                    │
  │  ┌──────────────────────────────────────────────┐  │
  │  │ 🤖 CoderBot:                                 │  │
  │  │ Sure! I'll create a REST API with Express... │  │
  │  │ [streaming...]                               │  │
  │  │ ```typescript                                │  │
  │  │ // src/routes/user.routes.ts                 │  │
  │  │ ...                                          │  │
  │  │ ```                                          │  │
  │  │ [✓ Done in 4.2s · 312 tokens]                │  │
  │  └──────────────────────────────────────────────┘  │
  │                                                    │
  │  ┌──────────────────────────────────────────────┐  │
  │  │ [Type your message...        ]    [Send ↑]    │  │
  │  └──────────────────────────────────────────────┘  │
  └────────────────────────────────────────────────────┘
```

### 9.6 Flow 6 — Multi-Agent Orchestration

```
User: "@coderbot implementasi feature X, @reviewer audit setelahnya"

Orchestrator:
  1. Detect mentions: ["coderbot", "reviewer"]
  2. Lead agent (CoderBot) mulai generate
  3. CoderBot selesai dengan implementasi
  4. ReviewerBot dipicu (via mention + completion event)
  5. ReviewerBot mengaudit code, memberikan feedback

UI menampilkan:
  - Bubble 1: User message
  - Bubble 2: CoderBot response (dengan code)
  - Bubble 3: ReviewerBot audit (referencing CoderBot's code)
```

### 9.7 Flow 7 — Memory Persistence (CRITICAL) ⭐

```
┌────────────────────────────────────────────────────────────┐
│  TANGGAL 1: User mention preference                        │
├────────────────────────────────────────────────────────────┤
│  User: "Saya vegetarian ya, jangan saranin daging"          │
│  Agent: "Siap, saya catat."                                │
│                                                            │
│  Background:                                               │
│    extractAndStoreLLM(agentId, userMsg) →                  │
│      → Memory: {                                          │
│          content: "User is vegetarian",                    │
│          importance: 0.9,                                  │
│          category: "personal"                              │
│        }                                                   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  TANGGAL 30: User buka chat baru (aplikasi sudah restart)  │
├────────────────────────────────────────────────────────────┤
│  User: "Mau dinner nanti, rekomen dong"                    │
│                                                            │
│  Background:                                               │
│    1. retrieveRelevant(agentId, "dinner rekomen") →        │
│       → [{content: "User is vegetarian", score: 0.85}]     │
│                                                            │
│    2. getContextForPrompt(agentId, query) →                │
│       → "## Memory\n- [personal] User is vegetarian"       │
│                                                            │
│    3. System prompt sekarang termasuk memory tersebut      │
│                                                            │
│  Agent: "Untuk dinner, saya sarankan beberapa resto        │
│          vegetarian di Jakarta:                            │
│          1. Burgreens - plant-based burgers                │
│          2. Loving Hut - vegetarian buffet                 │
│          ..."                                              │
│                                                            │
│  ⭐ AGENT TIDAK LUPA WALAU APLIKASI SUDAH RESTART         │
└────────────────────────────────────────────────────────────┘
```

### 9.8 Flow 8 — Memory Manager UI

```
Sidebar → Memory

┌────────────────────────────────────────────────────────────┐
│  Memory Manager                              [+ Add]       │
├────────────────────────────────────────────────────────────┤
│  Filters:                                                  │
│    Agent: [CoderBot ▼]                                     │
│    Category: [All ▼]                                       │
│    Type: [Long-term ▼]                                     │
│    ☑ Pinned only                                           │
│                                                            │
│  [🔍 Search memories...]                                   │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 📌 User is vegetarian                                │  │
│  │    [personal] · importance: 0.9 · accessed 12 times  │  │
│  │    [Edit] [Unpin] [Delete]                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ User uses PostgreSQL 15 for all backend projects     │  │
│  │    [preference] · importance: 0.8 · accessed 5 times  │  │
│  │    [Edit] [Pin] [Delete]                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Prefers TypeScript strict mode                       │  │
│  │    [preference] · importance: 0.7 · accessed 3 times  │  │
│  │    [Edit] [Pin] [Delete]                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [Export JSON] [Import JSON] [⚠ Clear All Memories]       │
└────────────────────────────────────────────────────────────┘
```

---

## 10. Roadmap

### 10.1 Milestones

| Milestone | Status | Scope |
|-----------|--------|-------|
| **M1 — Foundation** | ✅ Done | Electron shell, SQLite schema, IPC, basic UI |
| **M2 — LLM + Memory** | ✅ Done | LLM provider manager, Memory Manager (extraction, retrieval, injection) |
| **M3 — Skills** | ✅ Done | Skill registry, all 10 built-in skills |
| **M4 — Orchestrator** | ✅ Done | Agent runner, event bus, lead-first flow, inter-agent delegation |
| **M5 — Chatroom + Teams** | 🚧 In Progress | Multi-participant chat, team management, mentions, UI polish |
| **M6 — Polish + Packaging** | 📅 Planned | electron-builder, NSIS+DMG, installer, auto-update, telemetry opt-in |

### 10.2 Future Backlog (Post v1)

| Feature | Priority | Quarter |
|---------|----------|---------|
| Memory semantic search (embeddings) | P1 | Q3 2026 |
| Memory visualization graph | P2 | Q3 2026 |
| Plugin SDK untuk custom skills | P1 | Q4 2026 |
| Voice input/output | P3 | Q1 2027 |
| Cloud sync (opt-in, E2E encrypted) | P2 | Q2 2027 |
| Mobile companion app | P3 | Q3 2027 |
| Marketplace untuk agent templates | P2 | Q3 2027 |
| Multi-modal (image input) | P1 | Q2 2027 |

### 10.3 Success Criteria per Milestone

- **M5 complete when:** User dapat membuat team dengan 3+ agent, menjalankan chatroom dengan multi-agent orchestration, memories ter-extract dan visible di Memory Manager.
- **M6 complete when:** Build artifact `.exe` dan `.dmg` tersedia, installer mulus, auto-update berfungsi, crash-free rate ≥ 99.5% dalam beta testing.

---

## 11. Out of Scope (v1)

Fitur-fitur berikut **tidak** termasuk dalam v1 release:

- ❌ **Mobile app** (iOS/Android) — planned post-v1
- ❌ **Cloud sync** — fokus 100% local-first
- ❌ **Voice input/output** — TTS/STT belum termasuk
- ❌ **Marketplace** untuk agent template publik
- ❌ **Plugin store** eksternal
- ❌ **Multi-user collaboration** (v1 single-user)
- ❌ **Web-based version** — desktop only
- ❌ **Image generation** (DALL-E, Stable Diffusion) — text-only v1
- ❌ **Real-time internet search** (kecuali via web_search skill + provider)
- ❌ **Custom skill marketplace**

---

## 12. Glossary

| Istilah | Definisi |
|---------|----------|
| **Agent** | Entitas AI otonom dengan persona, system prompt, skills, dan memori |
| **Orchestrator** | Komponen yang mengkoordinasikan banyak agent dalam satu chatroom |
| **Skill** | Function/tool yang dapat dipanggil agent saat runtime (e.g., terminal) |
| **Memory** | Persistent knowledge yang disimpan agent lintas sesi — ⭐ **fitur kritikal** |
| **Long-term Memory** | Fakta/preferensi persisten di SQLite (table `memories`) |
| **Episodic Memory** | Ringkasan percakapan lampau (table `conversation_summaries`) |
| **Semantic Memory** | Pengetahuan ter-derive dari agregasi memories |
| **Short-term Memory** | Konteks percakapan aktif (in-memory, sliding window) |
| **Consolidation** | Proses membuat ringkasan percakapan menjadi episodic memory |
| **Retrieval** | Proses mencari memories yang relevan dengan query saat ini |
| **Importance Score** | Nilai 0.0-1.0 yang menunjukkan seberapa penting sebuah memory |
| **Pinned Memory** | Memory yang selalu di-inject ke system prompt |
| **Lead Agent** | Agent utama dalam tim yang merespons duluan |
| **@mention** | Syntax `@agent-name` untuk invoke agent tertentu |
| **Provider** | LLM backend (OpenAI, Ollama, LM Studio, dll) |
| **Chatroom** | Container percakapan dengan user + beberapa agent |
| **Team** | Grup agent yang bekerja bersama |
| **Workspace** | Working directory yang diasosiasikan dengan team/agent |
| **Tool Call** | Function call yang di-emit LLM untuk eksekusi skill |
| **Streaming** | Token-by-token delivery dari LLM response |
| **safeStorage** | Electron API untuk OS-level encryption (DPAPI/Keychain) |
| **AES-256-GCM** | Fallback encryption untuk API key |
| **Localhost Server** | HTTP server bind ke 127.0.0.1 untuk external integration |

---

## Lampiran A — Acceptance Criteria Summary

### ✅ Fitur Wajib (Must Have)

- [x] Custom LLM provider (unlimited, OpenAI-compatible)
- [x] Encryption API key (safeStorage + AES-256-GCM)
- [x] Test connection endpoint dengan latency display
- [x] Custom agent dengan system prompt + skills
- [x] Built-in skills: terminal, web_fetch, file_system, http_request, code_exec, datetime, calculator, memory_ops, agent_delegate
- [x] ⭐ **Persistent memory system (long-term + episodic)**
- [x] ⭐ **Memory extraction via LLM + heuristic**
- [x] ⭐ **Memory retrieval dengan importance + relevance scoring**
- [x] ⭐ **Auto-injection memory ke system prompt**
- [x] Memory Manager UI (view, edit, delete, pin)
- [x] Teams dengan lead/member/observer roles
- [x] Chatroom multi-participant dengan @mention
- [x] Streaming response token-by-token
- [x] Tool call display dengan args + result
- [x] Multi-agent orchestration (lead-first + delegation)
- [x] Localhost server dengan /api/* endpoints
- [x] Path traversal protection
- [x] SQLite schema dengan proper indexes
- [x] Cross-platform: Windows + macOS

### 🌟 Fitur Nice-to-Have (v1.x)

- [ ] Memory export/import (JSON)
- [ ] Semantic memory aggregation
- [ ] Memory category auto-classification
- [ ] Chatroom search (full-text)
- [ ] Message regeneration with feedback
- [ ] Theme: dark/light mode
- [ ] Bahasa Indonesia UI translation
- [ ] Keyboard shortcuts panel
- [ ] Auto-update via electron-updater

---

## Lampiran B — Risiko & Mitigasi

| Risiko | Dampak | Probabilitas | Mitigasi |
|--------|--------|--------------|----------|
| Memory extraction LLM hallucination | Memory palsu tersimpan | Medium | Importance threshold, user review UI, manual delete |
| Memory DB membengkak | Performance degrade | Medium | Auto-prune low-importance memories setelah N hari (configurable) |
| LLM API rate limit | Gagal generate | Medium | Retry with backoff, fallback ke provider lain, user notification |
| Terminal skill escape | Arbitrary code execution | Low | Workspace scoping, optional command whitelist, audit log |
| Streaming lag dengan model besar | UX buruk | Medium | Abort signal, partial token UI indicator |
| SQLite corruption saat crash | Data loss | Low | WAL mode, regular VACUUM, backup suggestion |

---

## Lampiran C — Contoh Prompt Templates

### C.1 System Prompt untuk CoderBot

```
You are CoderBot, a senior backend engineer with 10+ years of experience
in Node.js, TypeScript, and PostgreSQL.

## Your Expertise
- RESTful API design (OpenAPI 3.1)
- Database schema design & optimization
- Authentication (JWT, OAuth2, session)
- Testing (Jest, Supertest)
- Docker & CI/CD pipelines

## Communication Style
- Concise and technical
- Always include file paths in answers
- Provide code examples with proper TypeScript types
- Explain trade-offs when relevant

## Workflow
1. Understand the requirement fully before coding
2. Plan the solution (mention key decisions)
3. Write clean, well-documented code
4. Suggest tests for new functionality
5. Flag potential security issues

## Memory Usage
You have access to long-term memory about the user. Use it to personalize
your responses and remember their preferences across sessions.

When you learn something memorable about the user (preferences, facts,
project context), it will be automatically stored for future reference.
```

### C.2 Memory Extraction Prompt (internal)

```
Analyze the conversation and extract memorable information.

For each item, provide:
- content: The fact/preference/knowledge (string, concise)
- importance: 0.0-1.0 (higher = more memorable)
- category: 'preference' | 'fact' | 'task_pattern' | 'project' | 'personal'

Rules:
- Only extract stable, likely-relevant information
- Skip transient context (current task details)
- Be conservative — false positives pollute memory
- Output valid JSON array, or [] if nothing notable

Conversation:
{conversation}

JSON:
```

### C.3 Consolidation Prompt (internal)

```
Summarize this conversation in 2-5 paragraphs.

Focus on:
1. Main topics discussed
2. Decisions and conclusions
3. Action items or follow-ups
4. User preferences revealed
5. Problems and solutions

Write in the same language as the conversation.
Be concise but capture key context for future reference.

Conversation:
{messages}
```

---

**Dokumen ini adalah living document. Update setiap sprint atau ada perubahan feature scope.**

**Last updated:** 22 Juni 2026
**Next review:** Setiap akhir milestone
