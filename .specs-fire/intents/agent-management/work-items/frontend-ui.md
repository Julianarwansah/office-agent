---
id: frontend-ui
title: Frontend UI — tombol duplicate, export, import di halaman Agents
intent: agent-management
complexity: low
mode: autopilot
status: pending
depends_on: [backend-ipc-handlers]
created: 2026-06-23T00:00:00Z
---

# Work Item: Frontend UI — tombol duplicate, export, import di halaman Agents

## Description

Tambah tiga tombol di halaman `src/renderer/pages/Agents.tsx`:
- Per-agent card: tombol **Duplicate** dan **Export**
- Header halaman: tombol **Import** (buka file picker JSON)

## Acceptance Criteria

- [ ] Setiap agent card punya tombol Duplicate (icon Copy) dan Export (icon Download)
- [ ] Klik Duplicate → buat agent baru "Copy of X" → reload list → tampil di UI
- [ ] Klik Export → unduh file `{agent-name}.json` via `downloadFile()` dari utils
- [ ] Tombol Import di header → input type=file accept=".json" → parse → buat agent → reload
- [ ] Error handling: tampilkan alert jika import gagal (JSON invalid / field kurang)
- [ ] Loading state saat proses berlangsung

## Technical Notes

- Gunakan `downloadFile(json, `${agent.name}.json`, 'application/json')` dari `src/renderer/lib/utils.ts`
- File picker: `<input type="file" accept=".json" style={{ display: 'none' }}> + ref.click()`
- Tambah di baris action button setiap agent card (setelah Edit, sebelum Delete)

## Dependencies

- backend-ipc-handlers
