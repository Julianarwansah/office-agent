---
id: backend-ipc-handlers
title: IPC handlers — duplicate, export, import agent
intent: agent-management
complexity: low
mode: autopilot
status: pending
depends_on: []
created: 2026-06-23T00:00:00Z
---

# Work Item: IPC handlers — duplicate, export, import agent

## Description

Implementasi tiga IPC handler baru di `src/main/ipc/agents.ts`:
- `agent:duplicate` — copy agent, beri nama "Copy of {name}", ID baru
- `agent:export` — return config agent sebagai JSON string
- `agent:import` — terima JSON string, validasi, buat agent baru

Expose semua tiga di preload (`src/preload/preload.ts` + `src/preload/api.ts`).
Tambah store actions di `src/renderer/stores/agents.ts`.

## Acceptance Criteria

- [ ] `agent:duplicate` handler terdaftar dan return Agent baru
- [ ] `agent:export` handler return `{ json: string }` berisi JSON konfigurasi agent
- [ ] `agent:import` handler terima JSON string, validasi field wajib, return Agent baru
- [ ] Semua tiga di-expose di `window.officeAPI.agents.*`
- [ ] Store actions `duplicateAgent`, `exportAgent`, `importAgent` tersedia
- [ ] `tsc` bersih

## Technical Notes

- Duplicate: buat agent baru via `agentRepo.create(...)` dengan field yang sama kecuali id, name = "Copy of X", createdAt/updatedAt baru
- Export: `agentRepo.findById(id)` → JSON.stringify seluruh Agent object
- Import: JSON.parse → validasi `name` dan `providerId` ada → `agentRepo.create(...)`
- Skills ikut di-duplicate dan di-import via `agentRepo.setSkills`

## Dependencies

(none)
