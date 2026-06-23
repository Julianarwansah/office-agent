# TypeScript Types Reference

Semua shared types ada di `src/shared/types.ts` dan digunakan di main process maupun renderer.

## Core Entity Types

### `Agent`
```ts
interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  systemPrompt: string;
  providerId: string;         // FK ke LLMProvider.id
  teamId?: string;            // FK ke Team.id
  role: AgentRole;            // 'lead' | 'member' | 'observer'
  color?: string;             // HEX warna avatar
  isLead?: boolean;
  enabledSkills: AgentSkill[];
  temperature?: number;       // null = pakai default provider
  maxTokens?: number;
  createdAt: number;          // Unix timestamp (ms)
  updatedAt: number;
}

type AgentRole = 'lead' | 'member' | 'observer';

interface AgentSkill {
  name: string;
  enabled: boolean;
  config?: SkillParameterValue;
}
```

### `Team`
```ts
interface Team {
  id: string;
  name: string;
  description?: string;
  instructions?: string;  // dimasukkan ke system prompt semua agent dalam tim
  color?: string;
  avatar?: string;
  createdAt: number;
}
```

### `ChatRoom`
```ts
type ChatRoomType = 'team' | 'direct' | 'global';

interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  teamId?: string;
  type: ChatRoomType;
  agentIds: string[];    // list agent yang ada di room ini
  createdAt: number;
}
```

### `Message`
```ts
type SenderType = 'user' | 'agent' | 'system';
type LLMChatRole = 'system' | 'user' | 'assistant' | 'tool';

interface Message {
  id: string;
  chatRoomId: string;
  senderType: SenderType;
  senderId: string;         // 'user' atau agent.id
  content: string;
  role?: LLMChatRole;       // untuk LLM context
  toolCalls?: LLMToolCall[];
  toolCallId?: string;      // untuk tool result messages
  parentId?: string;        // threading
  createdAt: number;
  isStreaming?: boolean;
  metadata?: MessageMetadata;
}
```

### `Memory`
```ts
type MemoryType = 'short_term' | 'long_term' | 'episodic' | 'semantic';
type MemoryCategory = 'user_preference' | 'fact' | 'instruction' | 'context' | 'task';

interface Memory {
  id: string;
  agentId: string;
  type: MemoryType;
  content: string;
  importance: number;         // 0.0 - 1.0
  category: MemoryCategory;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  isPinned: boolean;
  sourceMessageId?: string;
}
```

### `LLMProvider`
```ts
interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;           // plaintext (sudah didekripsi dari DB)
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemPromptPrefix?: string;
  isDefault?: boolean;
  headers?: LLMProviderHeaders;  // Record<string, string>
}
```

## LLM Types

### `LLMMessage`
```ts
interface LLMMessage {
  role: LLMChatRole;
  content: string | null;
  name?: string;             // untuk tool messages
  toolCallId?: string;       // untuk tool result
  toolCalls?: LLMToolCall[];
}
```

### `LLMTool` (OpenAI format)
```ts
interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;  // JSON Schema
  };
}
```

### `LLMToolCall`
```ts
interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;  // JSON string
  };
}
```

## Kanban Types

```ts
type KanbanTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
type KanbanTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface KanbanBoard {
  id: string;
  name: string;
  description?: string;
  color?: string;
  teamId?: string;
  ownerAgentId?: string;
  createdAt: number;
  updatedAt: number;
}

interface KanbanColumn {
  id: string;
  boardId: string;
  name: string;
  position: number;
  status: KanbanTaskStatus;
  wipLimit?: number;
  createdAt: number;
}

interface KanbanTask {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  status: KanbanTaskStatus;
  priority: KanbanTaskPriority;
  assigneeAgentId?: string;
  creatorAgentId?: string;
  dueDate?: number;
  position: number;
  parentTaskId?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
```

## App Settings

```ts
type AppTheme = 'light' | 'dark' | 'system';

interface AppSettings {
  theme: AppTheme;
  localhostPort: number;
  defaultProviderId?: string;
  terminalShell: string;
  workingDirectory: string;
  maxMemoryItems: number;              // max memori per agent
  memoryImportanceThreshold: number;  // 0.0-1.0, filter memori
  autoCreateMemories: boolean;
  streamResponses: boolean;            // streaming atau non-streaming LLM
  saveHistory: boolean;
}
```

## API Response Wrapper

```ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Semua IPC handler mengembalikan `ApiResponse<T>`. Di renderer, `unwrap(response)` dipakai untuk extract data atau throw error:
```ts
const agents = unwrap(await api.agents.list());
// throws ApiError jika success=false
```

## Orchestrator Events

```ts
interface OrchestratorEventMap {
  'agent:start':    { chatRoomId: string; messageId: string; agentId: string };
  'agent:thinking': { chatRoomId: string; agentId: string; messageId: string };
  'agent:content':  { chatRoomId: string; messageId: string; agentId: string; content: string; delta: string };
  'agent:tool_call': { chatRoomId: string; messageId: string; agentId: string; toolCall: LLMToolCall };
  'agent:tool_result': { chatRoomId: string; messageId: string; toolCallId: string; toolName: string; result: string; ok: boolean };
  'agent:done':     { chatRoomId: string; messageId: string; agentId: string; finalContent: string };
  'agent:error':    { chatRoomId: string; messageId?: string; agentId?: string; error: string };
  'memory:used':    { agentId: string; memories: Memory[] };
  'memory:created': { agentId: string; memory: Memory };
}
```

## Renderer-only Types — `src/renderer/lib/types.ts`

```ts
// Form data untuk create chatroom
interface ChatRoomFormData {
  name: string;
  description?: string;
  type: ChatRoomType;
  agentIds: string[];
}

// State streaming message di Zustand store
interface StreamingMessageState {
  agentId: string;
  messageId: string;
  content: string;
  toolCalls: LLMToolCall[];
  toolResults: Array<{ toolCallId: string; toolName: string; result: string; ok: boolean }>;
  status: 'pending' | 'streaming' | 'tool_call' | 'done' | 'error';
  startedAt: number;
  error?: string;
}

// Parameter untuk sendMessage di store
interface ChatSendParams {
  chatRoomId: string;
  userMessage: string;
  mentionedAgentIds?: string[];
  agentId?: string;           // override agent spesifik
  parentMessageId?: string;
}
```
