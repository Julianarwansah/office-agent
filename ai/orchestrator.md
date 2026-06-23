# Orchestrator & Agent Execution

## Overview

Orchestrator adalah koordinator utama eksekusi agent. Terdiri dari tiga layer:

```
Orchestrator          ← API publik, koordinasi multi-agent
  └── AgentRunner     ← Eksekusi single agent turn end-to-end
        └── MemoryManager  ← Retrieval, extraction, konsolidasi memori
```

File utama:
- `src/main/orchestrator/orchestrator.ts` — `Orchestrator` class
- `src/main/orchestrator/agent-runner.ts` — `AgentRunner` class
- `src/main/orchestrator/memory-manager.ts` — `MemoryManager` class
- `src/main/orchestrator/event-bus.ts` — `TypedEventEmitter`
- `src/main/orchestrator/prompt-builder.ts` — `PromptBuilder`
- `src/main/orchestrator/prompts.ts` — prompt templates
- `src/main/orchestrator/tool-accumulator.ts` — `ToolCallAccumulator` (streaming tool calls)
- `src/main/orchestrator/types.ts` — interfaces

## Orchestrator API

### `runAgent(opts)`
Jalankan single agent untuk satu user message. Returns `AgentRunResult`.

### `streamChat(chatRoomId, agentId, userMessage, onChunk, options)`
Versi streaming dari `runAgent`. `onChunk` dipanggil untuk setiap delta konten.

### `runTeamChat(chatRoomId, userMessage, options)`
Multi-agent turn:
1. Deteksi mention `@AgentName` dalam pesan
2. Jika ada mention → hanya agent yang di-mention yang respond
3. Jika tidak ada → lead agent respond pertama
4. Jika `letOthersRespond: true` → agent lain bisa ikut respond (max `maxFollowUps`)

**Lead detection** (urutan prioritas):
1. Agent dengan `isLead === true`
2. Agent dengan `role === 'lead'`
3. Agent pertama di list

**Chime-in detection** (non-lead agent respond jika):
- Di-mention langsung (`@name`)
- Pesan mengandung kata: "team", "everyone", "all agents"
- Agent berada di tim yang sama dengan lead

### `delegateToAgent(targetAgentId, task, context)`
Dipakai oleh skill `agent_delegate`. Menjalankan agent target secara synchronous dan mengembalikan final content-nya sebagai string untuk dimasukkan ke context agent pemanggil.

### `consolidateMemory(agentId, chatRoomId)`
Trigger konsolidasi: ambil 20 pesan terakhir, minta LLM merangkum, simpan ke DB.

### `extractMemories(agentId, text, sourceMessageId?)`
Extract memori heuristik dari teks.

## AgentRunner — Satu Turn End-to-End

File: `src/main/orchestrator/agent-runner.ts`

Konstan:
- `DEFAULT_HISTORY_LIMIT = 20` — berapa pesan terakhir diambil sebagai history
- `DEFAULT_MEMORY_LIMIT = 10` — berapa memori relevan diambil
- `MAX_TOOL_ITERATIONS = 8` — max iterasi tool call loop

### Langkah Eksekusi

```
1. Load agent + team dari DB
2. Retrieve memories relevan (MemoryManager.getContextForPrompt)
3. Build system prompt (PromptBuilder.buildSystemPrompt):
   - agent.systemPrompt
   - memories (diformat sebagai konteks)
   - team instructions
   - conversation summary (jika ada)
4. Load history pesan terbaru (findRecent)
5. Build LLM messages array (system + history + user message)
6. Buat assistant message shell di DB (content = '', isStreaming = true)
7. Emit 'agent:start' + 'agent:thinking' events
8. Buat LLM client dari providerId agent
9. TOOL CALL LOOP (max 8 iterasi):
   a. Panggil LLM (stream atau non-stream)
   b. Jika ada tool_calls:
      - Emit 'agent:tool_call' per tool
      - Execute setiap tool via SkillExecutor
      - Emit 'agent:tool_result' per tool
      - Append tool result ke messages, lanjut iterasi
   c. Jika tidak ada tool_calls → keluar loop
10. Update assistant message di DB (content = finalContent, isStreaming = false)
11. Extract memories dari finalContent (heuristik)
12. Emit 'memory:created' jika ada memori baru
13. Emit 'agent:done'
14. Return AgentRunResult
```

### Streaming vs Non-streaming

Diputuskan oleh `settings.streamResponses` (default: true).

**Streaming**: `chatStream()` → `AsyncGenerator<StreamChunk>`. Setiap delta dikirim ke renderer via `agent:content` event. Tool calls diakumulasi via `ToolCallAccumulator`.

**Non-streaming**: `chat()` → langsung dapat full response. Emit satu `agent:content` event dengan seluruh konten.

### `AgentRunResult`
```ts
interface AgentRunResult {
  messageId: string;
  agentMessage: Message;
  toolExecutions: ToolExecution[];
  memoriesUsed: Memory[];
  memoriesCreated: Memory[];
  finalContent: string;
}
```

## MemoryManager

File: `src/main/orchestrator/memory-manager.ts`

### Retrieval: `retrieveRelevant(agentId, query, k)`
- Panggil `memoryRepo.getTopRelevant(agentId, query, limit, threshold)`
- Filter oleh `settings.memoryImportanceThreshold`
- Touch access count untuk setiap memori yang diambil

### Extraction: `extractAndStore(agentId, text, sourceMessageId?)`
- Gunakan `PromptBuilder.extractMemoriesViaHeuristic(text)` — heuristik berbasis regex/pattern
- Filter candidates di bawah importance threshold
- Simpan ke DB (max 5 per call default)

### LLM Extraction: `extractAndStoreLLM(agentId, providerId, text)` (future)
- Gunakan LLM untuk extract memori lebih akurat
- Parse JSON response dari LLM

### Konsolidasi: `consolidate(agentId, chatRoomId, providerId)`
- Minimal 10 pesan baru sebelum konsolidasi
- Ambil 20 pesan terakhir, join jadi transcript
- Minta LLM merangkum (`CONSOLIDATION_SYSTEM` + `CONSOLIDATION_USER(transcript)`)
- Simpan ke tabel `conversation_summaries`

### `getContextForPrompt(agentId, query, k)`
Kombinasi memories + summary untuk dimasukkan ke prompt:
```ts
const { memories, summary } = await memoryManager.getContextForPrompt(agentId, query, 10);
```

## Orchestrator Events

Semua event di-emit via `TypedEventEmitter<OrchestratorEventMap>` (EventBus).

Di main process, events diteruskan ke renderer via IPC channel `orchestrator:event`.

| Event | Payload | Deskripsi |
|---|---|---|
| `agent:start` | `{ chatRoomId, messageId, agentId }` | Agent mulai merespons |
| `agent:thinking` | `{ chatRoomId, agentId, messageId }` | Agent sedang memproses |
| `agent:content` | `{ chatRoomId, messageId, agentId, content, delta }` | Delta konten streaming |
| `agent:tool_call` | `{ chatRoomId, messageId, agentId, toolCall }` | Agent memanggil tool |
| `agent:tool_result` | `{ chatRoomId, messageId, toolCallId, toolName, result, ok }` | Hasil eksekusi tool |
| `agent:done` | `{ chatRoomId, messageId, agentId, finalContent }` | Agent selesai |
| `agent:error` | `{ chatRoomId, messageId?, agentId?, error }` | Error terjadi |
| `memory:used` | `{ agentId, memories }` | Memori digunakan dalam prompt |
| `memory:created` | `{ agentId, memory }` | Memori baru dibuat |

## Event Flow: Satu Pesan dari User Terkirim

```
Renderer: api.chat.stream({ chatRoomId, userMessage, ... })
    ↓ IPC: chat:stream
Main: registerChatHandlers → CHAT.STREAM handler
    ↓ simpan user message ke DB
    ↓ pilih agentId (dari args atau room.agentIds[0])
    ↓ buat AbortController
    ↓ orchestrator.streamChat(...) (fire-and-forget)
        ↓ runner.run(...)
            ↓ emit 'agent:start'   → renderer: streamingMessages[chatRoomId] dibuat
            ↓ LLM streaming...
            ↓ emit 'agent:content' → renderer: update content di streamingMessages
            [jika tool_call]
            ↓ emit 'agent:tool_call' → renderer: update toolCalls
            ↓ execute tool
            ↓ emit 'agent:tool_result' → renderer: update toolResults
            [lanjut streaming]
            ↓ emit 'agent:done'    → renderer: hapus dari streamingMessages, fetch pesan final, masukkan ke messagesByRoom
Renderer: IPC return langsung (messageId) ← sebelum agent selesai
```

## Cancellation

`chat:cancel` → `AbortController.abort()` → `AbortSignal` diteruskan ke setiap `client.chatStream()` via `chatReq.signal` → fetch di `LLMClient.chatStream()` akan throw `AbortError`.
