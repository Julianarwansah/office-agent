# State Management (Zustand Stores)

Semua store ada di `src/renderer/stores/`. Diekspor via `src/renderer/stores/index.ts`.

Zustand tidak memerlukan Provider — store bisa diakses langsung di mana saja.

## Pola Penggunaan Umum

```ts
// ✅ Akses state (re-render jika berubah)
const agents = useAgentsStore((s) => s.agents);

// ✅ Akses action (tidak re-render, action tidak berubah)
const loadAgents = useAgentsStore((s) => s.loadAgents);

// ✅ Akses getState() tanpa subscribe (dalam event handler atau di luar komponen)
const { agents } = useAgentsStore.getState();
await useAgentsStore.getState().createAgent(data);

// ✅ Akses beberapa field sekaligus (akan re-render jika salah satu berubah)
const { agents, loading } = useAgentsStore((s) => ({ agents: s.agents, loading: s.loadingAgents }));
```

---

## `useAppStore` — `stores/app.ts`

State global aplikasi: sidebar, tema, settings, info sistem.

### State
```ts
{
  sidebarOpen: boolean;           // false = collapsed (68px), true = expanded (256px)
  theme: AppTheme;                // 'light' | 'dark' | 'system'
  localhostUrl: string | null;    // URL server lokal (misal http://localhost:4317)
  systemInfo: SystemInfo | null;  // platform, arch, versions
  settings: AppSettings | null;   // semua app settings dari DB
}
```

### Actions
```ts
toggleSidebar(): void
setTheme(theme: AppTheme): void
toggleTheme(): void
loadSystemInfo(): Promise<void>        // panggil system:get-info IPC
loadLocalhostUrl(): Promise<void>      // panggil system:get-localhost-url IPC
loadSettings(): Promise<void>          // panggil settings:get-app IPC
saveSettings(settings: AppSettings): Promise<void>  // panggil settings:save-app IPC
```

### Dimana dipakai
- `Sidebar.tsx` — `sidebarOpen`, `toggleSidebar`, `localhostUrl`
- `AppShell.tsx` — `sidebarOpen` (untuk margin kiri)
- `TopBar.tsx` — `theme`, `toggleTheme`, `localhostUrl`
- `Settings.tsx` — `settings`, `saveSettings`
- `App.tsx` — `loadSystemInfo`, `loadLocalhostUrl`, `loadSettings`

---

## `useAgentsStore` — `stores/agents.ts`

State agents dan teams.

### State
```ts
{
  agents: Agent[];
  teams: Team[];
  loadingAgents: boolean;
  loadingTeams: boolean;
  error: string | null;
}
```

### Actions
```ts
loadAgents(): Promise<void>
loadTeams(): Promise<void>
createAgent(data: Partial<Agent>): Promise<Agent>
updateAgent(id: string, data: Partial<Agent>): Promise<Agent | null>
deleteAgent(id: string): Promise<void>
duplicateAgent(id: string): Promise<Agent>
setAgentSkills(agentId: string, skills: AgentSkill[]): Promise<void>
createTeam(data: Partial<Team>): Promise<Team>
updateTeam(id: string, data: Partial<Team>): Promise<Team | null>
deleteTeam(id: string): Promise<void>
addAgentToTeam(teamId: string, agentId: string): Promise<void>
removeAgentFromTeam(teamId: string, agentId: string): Promise<void>
```

### Dimana dipakai
- `AgentChats.tsx` — `agents`, `teams`, `loadingAgents`
- `ChatRoom.tsx` — `agents` (untuk info agent di room)
- `Agents.tsx` — CRUD lengkap
- `Teams.tsx` — CRUD tim + manage members
- `AgentEditor.tsx` — form create/edit agent

---

## `useChatRoomsStore` — `stores/chatrooms.ts`

Store paling kompleks. Mengelola chatrooms, pesan, dan streaming.

### State
```ts
{
  chatrooms: ChatRoom[];
  currentChatRoomId: string | null;
  messagesByRoom: Record<string, Message[]>;        // chatRoomId → Message[]
  streamingMessages: Record<string, StreamingMessageState[]>; // chatRoomId → StreamingMessageState[]
  loading: boolean;
  loadingMessages: boolean;
  error: string | null;
  sendError: string | null;
  unsubscribers: Array<() => void>;  // cleanup functions untuk event listeners
}
```

### `StreamingMessageState`
```ts
{
  agentId: string;
  messageId: string;
  content: string;                  // akumulasi konten
  toolCalls: LLMToolCall[];
  toolResults: Array<{ toolCallId, toolName, result, ok }>;
  status: 'pending' | 'streaming' | 'tool_call' | 'done' | 'error';
  startedAt: number;
  error?: string;
}
```

### Actions
```ts
loadChatrooms(): Promise<void>
setCurrentChatRoom(id: string | null): void
createChatRoom(data: ChatRoomFormData): Promise<ChatRoom>
updateChatRoom(id: string, data: Partial<ChatRoomFormData>): Promise<ChatRoom | null>
deleteChatRoom(id: string): Promise<void>
addAgentToChatRoom(chatRoomId: string, agentId: string): Promise<void>
removeAgentFromChatRoom(chatRoomId: string, agentId: string): Promise<void>
getOrCreateDirect(agentId: string): Promise<ChatRoom>  // ← dipakai AgentChats

loadMessages(chatRoomId: string): Promise<void>
appendMessage(chatRoomId: string, msg: Message | null): void

sendMessage(params: ChatSendParams): Promise<void>  // trigger chat:stream IPC + subscribe events
cancelStream(): Promise<void>                        // trigger chat:cancel IPC + cleanup

clearError(): void
```

### Event Subscription (Internal)

Saat `sendMessage()` dipanggil, store subscribe ke 6 orchestrator events:
- `agent:start` → tambah entry baru di `streamingMessages`
- `agent:content` → update `content` di streaming state
- `agent:tool_call` → tambah tool call ke streaming state
- `agent:tool_result` → tambah tool result
- `agent:done` → hapus dari streaming, fetch pesan final dari DB via `message:get`, masukkan ke `messagesByRoom`, sort by `createdAt`
- `agent:error` → set `sendError` atau update streaming state ke 'error'

Unsubscribe otomatis saat `cancelStream()` atau `window.beforeunload`.

### Dimana dipakai
- `ChatRoom.tsx` — semua field + actions
- `AgentChats.tsx` — `chatrooms`, `getOrCreateDirect`
- `App.tsx` — `loadChatrooms` (initial load)

---

## `useLLMStore` — `stores/llm.ts`

Konfigurasi LLM providers dan presets.

### State
```ts
{
  providers: LLMProvider[];
  presets: LLMProviderPreset[];  // bawaan app (OpenAI, Anthropic, Groq, dll)
  loading: boolean;
  error: string | null;
}
```

### Actions
```ts
loadProviders(): Promise<void>
loadPresets(): Promise<void>
createProvider(data: Partial<LLMProvider>): Promise<LLMProvider>
updateProvider(id: string, data: Partial<LLMProvider>): Promise<LLMProvider | null>
deleteProvider(id: string): Promise<void>
setDefault(id: string): Promise<void>
testConnection(id: string): Promise<{ success: boolean; message: string; latencyMs: number }>
listModels(id: string): Promise<string[]>
```

---

## `useSkillsStore` — `stores/skills.ts`

Skills yang tersedia (builtin + user-defined).

### State
```ts
{
  skills: Skill[];           // builtin skills (dari registry)
  userSkills: UserSkill[];   // user-defined skills (dari DB)
  loading: boolean;
  error: string | null;
}
```

### Actions
```ts
loadSkills(): Promise<void>                // load builtin + user skills
createSkill(data: Partial<UserSkill>): Promise<UserSkill>
updateSkill(name: string, data: Partial<UserSkill>): Promise<UserSkill | null>
deleteSkill(name: string): Promise<void>
testSkill(name: string, args: Record<string, unknown>): Promise<string>
toggleSkill(name: string, enabled: boolean): Promise<void>
```

---

## `useMemoriesStore` — `stores/memories.ts`

Memori per agent.

### State
```ts
{
  memories: Memory[];
  loading: boolean;
  error: string | null;
}
```

### Actions
```ts
loadMemories(agentId: string): Promise<void>
createMemory(data: Partial<Memory>): Promise<Memory>
updateMemory(id: string, data: Partial<Memory>): Promise<Memory | null>
deleteMemory(id: string): Promise<void>
deleteAllMemories(agentId: string): Promise<void>
pinMemory(id: string): Promise<void>
unpinMemory(id: string): Promise<void>
searchMemories(agentId: string, query: string): Promise<Memory[]>
consolidateMemories(agentId: string, chatRoomId: string): Promise<ConversationSummary | null>
```

---

## `useKanbanStore` — `stores/kanban.ts`

Boards, columns, tasks kanban.

### State
```ts
{
  boards: KanbanBoard[];
  columnsByBoard: Record<string, KanbanColumn[]>;   // boardId → columns
  tasksByBoard: Record<string, KanbanTask[]>;       // boardId → tasks
  eventsByTask: Record<string, KanbanTaskEvent[]>;  // taskId → events
  loading: boolean;
  error: string | null;
}
```

### Actions
```ts
loadBoards(): Promise<void>
createBoard(data: Partial<KanbanBoard>): Promise<KanbanBoard>
updateBoard(id: string, data: Partial<KanbanBoard>): Promise<KanbanBoard | null>
deleteBoard(id: string): Promise<void>

loadColumns(boardId: string): Promise<void>
createColumn(boardId: string, data: Partial<KanbanColumn>): Promise<KanbanColumn>
updateColumn(id: string, data: Partial<KanbanColumn>): Promise<KanbanColumn | null>
deleteColumn(id: string): Promise<void>
reorderColumns(boardId: string, columnIds: string[]): Promise<void>

loadTasks(boardId: string): Promise<void>
createTask(boardId: string, columnId: string, data: Partial<KanbanTask>): Promise<KanbanTask>
updateTask(id: string, data: Partial<KanbanTask>): Promise<KanbanTask | null>
moveTask(taskId: string, toColumnId: string, position: number): Promise<void>
deleteTask(id: string): Promise<void>
```

---

## `useWorkspaceStore` — `stores/workspace.ts`

Workspace folder yang bisa diakses agent.

### State
```ts
{
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  files: WorkspaceFile[];       // tree file dari workspace aktif
  loading: boolean;
  error: string | null;
}
```

### Actions
```ts
loadWorkspaces(): Promise<void>
createWorkspace(data: Partial<Workspace>): Promise<Workspace>
updateWorkspace(id: string, data: Partial<Workspace>): Promise<Workspace | null>
deleteWorkspace(id: string): Promise<void>
setDefault(id: string): Promise<void>
openWorkspace(id: string): Promise<void>      // list files di workspace
listFiles(path?: string): Promise<void>
readFile(path: string): Promise<string>
searchFiles(query: string): Promise<WorkspaceFile[]>
openInOS(path: string): Promise<void>         // buka di file explorer OS
```

---

## Inisialisasi Store di App.tsx

Saat app start, `App.tsx` trigger load semua data:

```ts
useEffect(() => {
  void loadSystemInfo();
  void loadLocalhostUrl();
  void loadSettings();
  void loadSkills();
  void loadProviders();
  void loadPresets();
  void loadAgents();
  void loadTeams();
  void loadChatrooms();
  void loadKanbanBoards();
}, [/* dependency array dari semua action functions */]);
```

Semua load berjalan paralel (tidak sequential).
