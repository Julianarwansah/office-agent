# Skills System

## Apa itu Skill?

Skill adalah tool/fungsi yang bisa dipanggil oleh agent saat merespons. Diimplementasikan sebagai OpenAI-compatible tool (function calling). Saat LLM mengeluarkan `tool_calls`, `AgentRunner` mengeksekusi skill yang sesuai dan memasukkan hasilnya ke context LLM.

## Jenis Skill

### 1. Builtin Skills
File: `src/main/skills/builtin/`

Ditulis dalam TypeScript, diregister di startup.

| Skill | File | Deskripsi |
|---|---|---|
| `terminal` | `terminal.ts` | Eksekusi command di terminal/shell |
| `web_fetch` | `web-fetch.ts` | Ambil konten dari URL (HTTP GET) |
| `web_search` | `web-search.ts` | Cari di web |
| `datetime` | `datetime.ts` | Operasi tanggal/waktu |
| `memory_ops` | `memory-ops.ts` | Baca/tulis memori agent |
| `http_request` | `http-request.ts` | HTTP request custom (GET/POST/PUT/DELETE) |
| `file_system` | `file-system.ts` | Baca/tulis/list file dalam workspace |
| `code_exec` | `code-exec.ts` | Eksekusi kode (Python/Node) |
| `agent_delegate` | `agent-delegate.ts` | Delegasikan task ke agent lain |

### 2. User Skills
File: `src/main/skills/user-skills.ts`, `src/main/db/repositories/user-skills.ts`

Skill yang dibuat pengguna melalui UI. Disimpan di tabel `user_skills` di DB. Implementasinya berupa kode JavaScript yang dieksekusi via sandbox.

## Skill Registry

File: `src/main/skills/registry.ts`

```ts
class SkillRegistry {
  register(definition: SkillDefinition): void
  unregister(name: string): void
  get(name: string): SkillDefinition | undefined
  getAll(): SkillDefinition[]
  getEnabledForAgent(agent: Agent): SkillDefinition[]
  getToolsForAgent(agent: Agent): LLMTool[]  // dipakai AgentRunner
}
```

Singleton: `getSkillRegistry()` mengembalikan instance global.

### `getToolsForAgent(agent)`
1. Ambil `agent.enabledSkills` (list `{ name, enabled, config }`)
2. Filter skill yang `enabled === true`
3. Map ke `LLMTool` (OpenAI tool format)

Output dimasukkan ke `ChatRequest.tools` saat memanggil LLM.

## SkillDefinition Interface

```ts
interface SkillDefinition {
  manifest: SkillManifest;     // metadata skill
  toTool(): LLMTool;          // konversi ke OpenAI tool format
  execute(args, context): Promise<SkillExecutionResult>;
}

interface SkillManifest {
  name: string;              // unik, slug
  displayName: string;       // nama tampilan
  description: string;       // untuk LLM tool description
  category: SkillCategory;
  parameters?: SkillParameterSchema;
  requiresApproval?: boolean; // user harus confirm sebelum eksekusi
  dangerous?: boolean;
}

interface SkillExecutionResult {
  ok: boolean;
  output: string;    // string yang dikembalikan ke LLM sebagai tool result
  error?: string;
}
```

## Skill Executor

File: `src/main/skills/executor.ts`

`SkillExecutor` mengeksekusi tool call yang dipilih agent:

```ts
class SkillExecutor {
  async execute(
    agent: Agent,
    toolCall: LLMToolCall,
    context: { chatRoomId, messageId, signal? }
  ): Promise<SkillExecutionResult>

  async record(
    messageId: string,
    toolCall: LLMToolCall,
    result: SkillExecutionResult,
    status: ToolExecutionStatus,
  ): Promise<ToolExecution>
}
```

Alur eksekusi:
1. Cari `SkillDefinition` di registry by `toolCall.function.name`
2. Parse arguments dari JSON string
3. Panggil `definition.execute(parsedArgs, context)`
4. Return `SkillExecutionResult`
5. Record ke tabel `tool_executions` via `record()`

## Menambah Skill Baru (Builtin)

1. Buat file baru di `src/main/skills/builtin/new-skill.ts`
2. Implementasikan interface `SkillDefinition`:
```ts
import type { SkillDefinition, SkillExecutionResult } from '../types';

export const newSkillDefinition: SkillDefinition = {
  manifest: {
    name: 'new_skill',
    displayName: 'New Skill',
    description: 'Deskripsi untuk LLM',
    category: 'productivity',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input data' },
      },
      required: ['input'],
    },
  },
  toTool() {
    return {
      type: 'function',
      function: {
        name: this.manifest.name,
        description: this.manifest.description,
        parameters: this.manifest.parameters ?? {},
      },
    };
  },
  async execute(args, _context): Promise<SkillExecutionResult> {
    try {
      const result = doSomething(args.input);
      return { ok: true, output: JSON.stringify(result) };
    } catch (err) {
      return { ok: false, output: '', error: String(err) };
    }
  },
};
```

3. Register di `src/main/skills/index.ts`:
```ts
registry.register(newSkillDefinition);
```

## User Skills (Custom)

User bisa membuat skill sendiri melalui halaman `/skills`. Implementasi berupa JavaScript yang dieksekusi via `src/main/skills/user-script.ts`.

Schema parameter user skill:
```ts
interface UserSkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
}
```

## Agent ↔ Skill Flow

```
1. User/admin enable skill X untuk agent A (via /agents UI → agent:set-skills)
   → Tersimpan di tabel agent_skills: (agent_id=A, skill_name=X, enabled=1)

2. Agent A merespons → AgentRunner:
   → skillRegistry.getToolsForAgent(agentA) → [tool X definition]
   → tools dimasukkan ke LLM request

3. LLM memutuskan pakai tool X → output tool_call
   → AgentRunner: executeToolCall(agent, toolCall, ...)
   → SkillExecutor.execute(agent, { function: { name: 'X', arguments: '...' } }, context)
   → SkillDefinition.execute(parsedArgs, context)
   → return result

4. Result dimasukkan ke messages sebagai tool result
   → LLM merespons lagi dengan hasil tool → finalContent
```

## Skill Categories

| Category | Deskripsi |
|---|---|
| `productivity` | Tools umum produktivitas |
| `data` | Manipulasi data |
| `communication` | Integrasi komunikasi |
| `development` | Tools development (terminal, code exec) |
| `search` | Web search, fetch |
| `memory` | Operasi memori agent |
| `coordination` | Koordinasi antar-agent (delegate) |
