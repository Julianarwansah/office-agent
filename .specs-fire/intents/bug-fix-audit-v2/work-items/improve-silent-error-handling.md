---
id: improve-silent-error-handling
title: Improve Silent Error Handling in Stores
intent: bug-fix-audit-v2
complexity: low
mode: autopilot
status: completed
depends_on: []
created: 2026-06-25T07:00:00Z
run_id: run-office-agent-004
completed_at: 2026-06-25T08:30:56.794Z
---

# Work Item: Improve Silent Error Handling in Stores

## Description

Beberapa `.catch(() => {})` dan `catch { /* ignore */ }` di stores dan komponen menelan error tanpa logging. Ini membuat debugging sulit. Tambah `console.error` atau minimal log ke silent catch blocks yang penting.

## Acceptance Criteria

- [ ] `.catch(() => {})` di `stores/app.ts:44` log error
- [ ] `.catch(() => null)` di `stores/skills.ts:75` log error
- [ ] `catch { /* ignore */ }` di `main/llm/client.ts:143,339` log error
- [ ] `catch { /* ignore */ }` di `main/llm/provider-manager.ts:70,104,142` log error

## Technical Notes

Ganti `catch { }` atau `.catch(() => {})` dengan `catch (err) { console.error('...', err); }`. Jangan ubah behavior — tambah logging saja.

## Dependencies

(none)
