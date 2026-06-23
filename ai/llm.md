# LLM Provider System

## Overview

File: `src/main/llm/`

```
llm/
  client.ts         ← LLMClient (OpenAI-compatible HTTP client)
  provider-manager.ts ← ProviderManager (load provider + create client)
  prompt-builder.ts ← PromptBuilder (build system prompt, chat messages, memory extraction)
  streaming.ts      ← Stream parser (SSE/NDJSON → StreamChunk)
  types.ts          ← ChatRequest, ChatResult, StreamChunk, LLMError, ResolvedProvider
  index.ts          ← re-exports
```

## LLMClient

File: `src/main/llm/client.ts`

Client HTTP universal yang compatible dengan API OpenAI (juga digunakan oleh provider lain seperti Anthropic via `openai` mode, Groq, Ollama, dll.).

### Constructor
```ts
const client = new LLMClient(resolvedProvider);
// resolvedProvider: provider dari DB + apiKey sudah didekripsi
```

### Methods

#### `chat(req: ChatRequest): Promise<ChatResult>`
Non-streaming call ke `{baseUrl}/chat/completions`. Response diparse sebagai `OpenAIResponse`.

#### `chatStream(req: ChatRequest): AsyncGenerator<StreamChunk>`
Streaming SSE. Yield `StreamChunk` per event:
- `{ type: 'start', model }` — stream mulai
- `{ type: 'content', contentDelta }` — delta teks
- `{ type: 'tool_call', toolCall }` — tool call delta
- `{ type: 'done', finishReason }` — stream selesai
- `{ type: 'error', error }` — error

#### `testConnection(): Promise<{ success, message, latencyMs }>`
Kirim pesan "Hi" dengan `maxTokens: 5` untuk cek konektivitas.

#### `buildHeaders()`
Buat headers: `Content-Type: application/json`, `Authorization: Bearer {apiKey}`, + custom headers dari provider config.

### ChatRequest
```ts
interface ChatRequest {
  provider: ResolvedProvider;
  messages: LLMMessage[];
  tools?: LLMTool[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  signal?: AbortSignal;
}
```

### Error Handling
`LLMError` dilempar untuk semua error LLM:
- `401` → "Authentication failed: invalid API key"
- `403` → "Access forbidden"
- `404` → "Model or endpoint not found"
- `429` → "Rate limited"
- `500/502/503/504` → "Server error"
- Network error → "Network error contacting ..."

## ProviderManager

File: `src/main/llm/provider-manager.ts`

Singleton manager yang mengurusi load provider dari DB dan factory untuk `LLMClient`.

### `createClient(providerId): Promise<LLMClient>`
1. Load provider dari DB by id
2. Dekripsi apiKey (jika ada, disimpan encrypted di DB)
3. Return `new LLMClient(resolvedProvider)`

### `getDefaultProvider(): LLMProvider | null`
Ambil provider dengan `isDefault = true`.

## PromptBuilder

File: `src/main/llm/prompt-builder.ts`

### `buildSystemPrompt(opts)`
Build system prompt agent:
```ts
PromptBuilder.buildSystemPrompt({
  agent,            // Agent object
  memories,         // Memory[] yang relevan
  teamInstructions, // string dari Team.instructions
  systemPromptPrefix, // string tambahan di awal
})
```

Output: string system prompt yang menggabungkan:
- system prompt agent
- team instructions (jika ada)
- memories yang relevan (diformat sebagai list)
- prefix tambahan

### `buildChatMessages(opts)`
Build array `LLMMessage[]` untuk dikirim ke LLM:
```ts
PromptBuilder.buildChatMessages({
  systemPrompt, // string
  history,      // Message[] dari DB
  userMessage,  // string (pesan terbaru user)
})
```
Output: `[{ role: 'system', content }, ...historyMessages, { role: 'user', content: userMessage }]`

### `extractMemoriesViaHeuristic(text)`
Heuristic-based memory extraction dari teks (tanpa LLM). Return list candidates `{ content, importance, category }`.

## LLM Provider Config

Disimpan di tabel `llm_providers`. Field:

| Field | Deskripsi |
|---|---|
| `id` | UUID |
| `name` | Nama tampilan |
| `baseUrl` | URL base API (misal `https://api.openai.com/v1`) |
| `apiKey` | API key (dienkripsi di DB via `src/main/security/crypto.ts`) |
| `model` | Model ID (misal `gpt-4o`, `claude-3-5-sonnet`) |
| `temperature` | Default temperature (0.0 - 2.0) |
| `maxTokens` | Max token output |
| `topP` | Top-p sampling |
| `systemPromptPrefix` | Prefix yang ditambahkan ke semua system prompt |
| `isDefault` | Boolean, hanya satu default |
| `headers` | Custom HTTP headers (JSON object) |

## Provider yang Didukung

Karena menggunakan OpenAI-compatible API, bisa digunakan dengan:
- **OpenAI**: `https://api.openai.com/v1`
- **Anthropic** (via openai-compat): `https://api.anthropic.com/v1` (perlu header `anthropic-version`)
- **Groq**: `https://api.groq.com/openai/v1`
- **Ollama** (lokal): `http://localhost:11434/v1`
- **LM Studio** (lokal): `http://localhost:1234/v1`
- **Azure OpenAI**: URL custom
- Provider lain yang support OpenAI chat completions format

## Security: Enkripsi API Key

File: `src/main/security/crypto.ts`

API key dienkripsi sebelum disimpan ke DB menggunakan AES-256-GCM dengan key yang di-derive dari user data path. Didekripsi saat provider di-load oleh ProviderManager.
