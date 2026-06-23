# IPC Communication (Electron)

## Bridge Architecture

Renderer **tidak boleh** mengakses `ipcRenderer` langsung. Semua komunikasi lewat bridge yang di-expose oleh preload script:

```
Renderer → window.officeAPI.xxx() → preload contextBridge → ipcRenderer.invoke() → Main ipcMain.handle()
```

Type preload terdapat di `src/preload/index.d.ts` dan `src/preload/api.ts`.

Di renderer, akses via `src/renderer/lib/api.ts`:
```ts
export const api: OfficeAPI = window.officeAPI;

// Helper untuk unwrap ApiResponse<T>
export function unwrap<T>(response: ApiResponse<T>): T { ... }
```

## Pola Request-Response (invoke)

Semua IPC pakai pattern `ApiResponse<T>`:
```ts
// Main process (handler)
ipcMain.handle('chatroom:list', async () => {
  try {
    const data = repos.chatrooms.findAll();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Renderer (store)
const chatrooms = unwrap(await api.chatrooms.list());
```

## Pola Push Event (main → renderer)

Untuk streaming dan real-time events, main process push ke renderer:
```ts
// Main process
windowManager.sendToRenderer('orchestrator:event', {
  type: 'agent:content',
  payload: { chatRoomId, messageId, agentId, content, delta }
});

// Renderer (di Zustand store chatrooms.ts)
api.events.onOrchestrator('agent:content', (payload) => {
  // update streamingMessages state
});
```

## Semua IPC Channels

Defined di `src/shared/types.ts` → `IPC_CHANNELS`:

### AGENT
| Channel | Deskripsi |
|---|---|
| `agent:list` | List semua agent |
| `agent:get` | Get agent by id |
| `agent:create` | Create agent baru |
| `agent:update` | Update agent |
| `agent:delete` | Delete agent |
| `agent:duplicate` | Duplicate agent |
| `agent:export` | Export agent ke JSON |
| `agent:import` | Import agent dari JSON |
| `agent:set-skills` | Set skills yang diaktifkan untuk agent |

### TEAM
| Channel | Deskripsi |
|---|---|
| `team:list` | List semua tim |
| `team:get` | Get tim by id |
| `team:create` | Create tim baru |
| `team:update` | Update tim |
| `team:delete` | Delete tim |
| `team:add-agent` | Tambah agent ke tim |
| `team:remove-agent` | Hapus agent dari tim |

### CHATROOM
| Channel | Deskripsi |
|---|---|
| `chatroom:list` | List semua chatroom |
| `chatroom:get` | Get chatroom by id |
| `chatroom:create` | Create chatroom baru |
| `chatroom:update` | Update chatroom |
| `chatroom:delete` | Delete chatroom |
| `chatroom:add-agent` | Tambah agent ke chatroom |
| `chatroom:remove-agent` | Hapus agent dari chatroom |
| `chatroom:set-agents` | Set ulang semua agent di chatroom |
| `chatroom:get-or-create-direct` | Cari atau buat direct chatroom untuk agent |

### MESSAGE
| Channel | Deskripsi |
|---|---|
| `message:list` | List pesan di chatroom |
| `message:get` | Get pesan by id |
| `message:send` | Kirim pesan (simpan saja) |
| `message:delete` | Hapus pesan |
| `message:clear` | Hapus semua pesan di chatroom |

### CHAT (Orchestrator triggers)
| Channel | Deskripsi |
|---|---|
| `chat:send` | Kirim pesan + trigger orchestrator (fire-and-forget, non-streaming) |
| `chat:stream` | Kirim pesan + trigger orchestrator streaming |
| `chat:cancel` | Cancel streaming yang sedang berjalan |

### LLM
| Channel | Deskripsi |
|---|---|
| `llm:list` | List semua LLM provider |
| `llm:get` | Get provider by id |
| `llm:create` | Tambah provider baru |
| `llm:update` | Update provider |
| `llm:delete` | Hapus provider |
| `llm:set-default` | Set provider sebagai default |
| `llm:test` | Test koneksi ke provider |
| `llm:list-models` | List model yang tersedia dari provider |
| `llm:presets` | List preset LLM bawaan |

### MEMORY
| Channel | Deskripsi |
|---|---|
| `memory:list` | List memori agent |
| `memory:get` | Get memori by id |
| `memory:create` | Buat memori baru |
| `memory:update` | Update memori |
| `memory:delete` | Hapus memori |
| `memory:delete-all` | Hapus semua memori agent |
| `memory:pin` | Pin memori |
| `memory:unpin` | Unpin memori |
| `memory:search` | Cari memori by query |
| `memory:consolidate` | Trigger konsolidasi memori dari conversation |
| `memory:extract` | Extract memori dari teks |
| `memory:clear` | Clear semua memori |

### SKILL
| Channel | Deskripsi |
|---|---|
| `skill:list` | List semua builtin skills |
| `skill:list-user` | List user-defined skills |
| `skill:get-user` | Get user skill by name |
| `skill:create` | Buat user skill baru |
| `skill:update` | Update user skill |
| `skill:delete` | Hapus user skill |
| `skill:test` | Test eksekusi skill |
| `skill:execute` | Eksekusi skill |
| `skill:toggle` | Enable/disable skill |
| `skill:get-tools` | Get tool definitions untuk agent |

### SETTINGS
| Channel | Deskripsi |
|---|---|
| `settings:get-app` | Get semua app settings |
| `settings:save-app` | Simpan app settings |
| `settings:get` | Get setting by key |
| `settings:set` | Set setting by key |
| `settings:update` | Update setting |
| `settings:delete` | Hapus setting |
| `settings:reset` | Reset ke default |

### SYSTEM
| Channel | Deskripsi |
|---|---|
| `system:get-info` | Get info platform/OS/versi |
| `system:open-external` | Buka URL di browser eksternal |
| `system:get-localhost-url` | Get URL server lokal yang berjalan |

### WORKSPACE
| Channel | Deskripsi |
|---|---|
| `workspace:list` | List semua workspace |
| `workspace:get-default` | Get workspace default |
| `workspace:create` | Tambah workspace |
| `workspace:update` | Update workspace |
| `workspace:delete` | Hapus workspace |
| `workspace:set-default` | Set workspace default |
| `workspace:list-files` | List file dalam workspace |
| `workspace:read-file` | Baca isi file |
| `workspace:search` | Cari file di workspace |
| `workspace:open` | Buka workspace di file manager |

### KANBAN
| Channel | Deskripsi |
|---|---|
| `kanban:list-boards` | List semua board |
| `kanban:create-board` | Buat board baru |
| `kanban:update-board` | Update board |
| `kanban:delete-board` | Hapus board |
| `kanban:list-columns` | List kolom dalam board |
| `kanban:create-column` | Tambah kolom |
| `kanban:update-column` | Update kolom |
| `kanban:delete-column` | Hapus kolom |
| `kanban:reorder-columns` | Reorder kolom |
| `kanban:list-tasks` | List task dalam board/kolom |
| `kanban:create-task` | Buat task baru |
| `kanban:update-task` | Update task |
| `kanban:move-task` | Pindah task ke kolom lain |
| `kanban:delete-task` | Hapus task |
| `kanban:list-events` | List event history task |
| `kanban:add-event` | Tambah event ke task |

### TERMINAL
| Channel | Deskripsi |
|---|---|
| `terminal:create` | Buat terminal session baru |
| `terminal:write` | Kirim input ke terminal |
| `terminal:resize` | Resize terminal (cols/rows) |
| `terminal:kill` | Kill terminal session |
| `terminal:data` | Push event: terminal output (main→renderer) |
| `terminal:exit` | Push event: terminal exit (main→renderer) |

### Push Event Channels (`RENDERER_EVENT_CHANNELS`)
| Channel | Deskripsi |
|---|---|
| `orchestrator:event` | Semua orchestrator events (agent:start, agent:content, agent:done, dll) |
| `terminal:data` | Output data dari terminal |
| `terminal:exit` | Terminal session ended |

## IPC Handler Registration

File: `src/main/ipc/index.ts` → `registerAllIpcHandlers(deps)`

Dipanggil sekali saat startup dari `main/index.ts` setelah semua dependency siap:
```ts
registerAllIpcHandlers({
  repos,           // semua DB repositories
  providerManager, // LLM provider manager
  skillRegistry,   // skill registry
  skillExecutor,   // skill executor
  memoryManager,   // memory manager
  orchestrator,    // orchestrator instance
  windowManager,   // window manager (untuk push events)
  localServer,     // server lokal
  getWindow,       // getter BrowserWindow aktif
  app,             // Electron app instance
});
```
