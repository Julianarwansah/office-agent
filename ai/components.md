# React Components Reference

## Layout Components

### `AppShell` — `src/renderer/components/AppShell.tsx`
Wrapper utama yang menyatukan sidebar, topbar, dan konten halaman.
- Margin kiri otomatis menyesuaikan state collapse sidebar: `sidebarOpen ? 256px : 68px`
- Semua halaman dirender sebagai children-nya

### `Sidebar` — `src/renderer/components/Sidebar.tsx`
Navigasi kiri yang bisa di-collapse.
- State collapse dari `useAppStore().sidebarOpen`
- Active route highlight dengan gradient + border indicator kiri
- Status server (Online/Offline) di bagian bawah
- Nav items: Dashboard, Chatrooms, Chat Agent, Kanban, Agents, Teams, Skills, Memories, Workspace
- Bottom: Settings

### `TopBar` — `src/renderer/components/TopBar.tsx`
Header atas global.
- Breadcrumb / judul halaman aktif
- Search (Cmd+K / Ctrl+K)
- Toggle dark mode
- Server URL badge
- Platform indicator

## UI Components (`src/renderer/components/ui/`)

### `Modal` — `ui/Modal.tsx`
Dialog modal yang reusable.
```tsx
<Modal
  open={boolean}
  onClose={() => void}
  title="Judul Modal"
  size="sm" | "md" | "lg" | "xl"
  footer={<>...</>}
>
  {/* konten */}
</Modal>
```

### `Button` — `ui/Button.tsx`
Tombol dengan variant, loading state, dan icon.
```tsx
<Button
  variant="primary" | "secondary" | "ghost" | "danger"
  size="sm" | "md" | "lg"
  loading={boolean}
  disabled={boolean}
  leftIcon={<Icon />}
  rightIcon={<Icon />}
  onClick={handler}
>
  Label
</Button>
```

### `Input` — `ui/Input.tsx`
Input, Textarea, dan Select components.
```tsx
// Input
<Input
  label="Label *"
  value={string}
  onChange={(val: string) => void}
  placeholder="..."
  required={boolean}
  error="Pesan error"
/>

// Textarea
<Textarea
  label="Label"
  value={string}
  onChange={(val: string) => void}
  rows={3}
/>

// Select
<Select
  label="Label"
  value={string}
  onChange={(val: string) => void}
  options={[{ value: 'x', label: 'X' }]}
/>
```

## Domain Components

### `MessageBubble` — `src/renderer/components/MessageBubble.tsx`
Satu bubble pesan dalam chat.

Props:
```ts
{
  message: Message;
  agentName?: string;
  agentColor?: string;
  agentAvatar?: string;
  isStreaming?: boolean;
}
```

Tampilan:
- User message: aligned kanan, warna primary
- Agent message: aligned kiri, avatar agent
- Tool call: tampilkan tool name + arguments (collapsible)
- Tool result: tampilkan hasil eksekusi
- Streaming: animasi typing indicator

### `InputArea` — `src/renderer/components/InputArea.tsx`
Area input chat di bawah area pesan.

Props:
```ts
{
  onSend: (text: string, mentionedAgentIds: string[]) => void;
  onCancel: () => void;
  isStreaming: boolean;
  agents: Agent[];          // untuk @mention autocomplete
  placeholder?: string;
}
```

Fitur:
- Auto-resize textarea
- `@mention` autocomplete untuk mention agent
- Tombol Send / Cancel (saat streaming)
- Keyboard: Enter untuk send, Shift+Enter untuk newline

### `AgentEditor` — `src/renderer/components/AgentEditor.tsx`
Form edit/create agent.
- Field: name, description, avatar, system prompt, provider, team, role, color
- Skill picker (toggle enabled skills)
- Temperature/maxTokens override

### `TeamEditor` — `src/renderer/components/TeamEditor.tsx`
Form edit/create tim.
- Field: name, description, instructions, color, avatar
- List agent dalam tim

### `SkillEditor` — `src/renderer/components/SkillEditor.tsx`
Form edit/create user skill.
- Field: name, displayName, description, category
- Code editor untuk implementation (JavaScript)
- Parameter definition
- Toggle requires_approval, dangerous

### `MemoryCard` — `src/renderer/components/MemoryCard.tsx`
Card untuk menampilkan satu memori agent.
- Importance score
- Category badge
- Pin/unpin
- Delete

### `LLMProviderEditor` — `src/renderer/components/LLMProviderEditor.tsx`
Form konfigurasi LLM provider.
- Field: name, baseUrl, model, apiKey, temperature, maxTokens
- Test connection button

### `TestConnectionButton` — `src/renderer/components/TestConnectionButton.tsx`
Tombol untuk test koneksi ke LLM provider dengan latency indicator.

### `AgentTemplatePicker` — `src/renderer/components/AgentTemplatePicker.tsx`
Picker template agent preset untuk mempercepat pembuatan agent baru.

## Styling Conventions

- **Tailwind CSS** untuk semua styling
- **Dark mode**: semua component pakai class `dark:` variant
- **Color scheme**: primary color = indigo/violet (via `primary-*` custom classes di `tailwind.config.js`)
- **Badge classes**: `.badge`, `.badge-primary`, `.badge-warning`, `.badge-neutral` (dari global CSS)
- **Card class**: `.card` untuk kontainer dengan shadow dan rounded border
- **Shimmer/skeleton**: `.shimmer` class untuk loading skeleton
- **cn()**: utility dari `src/renderer/lib/utils.ts` untuk conditional class merging (wraps `clsx` + `tailwind-merge`)

## Utility Functions — `src/renderer/lib/utils.ts`

```ts
cn(...classes)              // merge Tailwind classes (clsx + tailwind-merge)
getInitial(name: string)    // "John Doe" → "J"
formatRelative(timestamp)   // timestamp → "2 hours ago", "yesterday", dll
formatDate(timestamp)       // timestamp → "Jun 22, 2026"
```

## Hooks & Patterns

### Zustand selector pattern
```tsx
// Hanya re-render jika data berubah
const agents = useAgentsStore((s) => s.agents);
const loadAgents = useAgentsStore((s) => s.loadAgents);
```

### Loading states
```tsx
{loading ? (
  <div className="grid gap-4">
    {[0,1,2].map(i => <div key={i} className="card h-32 shimmer" />)}
  </div>
) : (
  <ActualContent />
)}
```

### Modal pattern
```tsx
const [createOpen, setCreateOpen] = useState(false);

<Button onClick={() => setCreateOpen(true)}>Create</Button>
<SomeModal open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleCreate} />
```
