---
id: error-handling-audit
title: Error Handling & Silent Error Audit
intent: comprehensive-audit-clean-code
complexity: medium
mode: confirm
status: completed
depends_on:
  - compile-and-type-audit
created: 2026-06-26T00:00:00Z
run_id: run-office-agent-006
completed_at: 2026-06-26T02:33:16.568Z
---

# Work Item: Error Handling & Silent Error Audit

## Description

Audit semua jalur error handling di codebase — pastikan tidak ada silent error, swallowed exception, atau error handling yang tidak tepat. Termasuk IPC handlers, store operations, orchestrator, dan UI error states.

## Acceptance Criteria

- [ ] Tidak ada `catch {}` kosong atau `catch (e) { /* silent */ }`
- [ ] Semua IPC handler return error response yang benar (bukan throw ke renderer)
- [ ] Semua `.unwrap()` calls di renderer punya error handling yang sesuai
- [ ] Orchestrator error handling graceful — tidak crash整个app
- [ ] LLM error handling: timeout, API error, invalid response — semua di-handle
- [ ] Store operations punya error feedback ke user
- [ ] Database query errors di-handle dan logged
- [ ] Network errors (fetch/HTTP) punya retry atau graceful degradation

## Technical Notes

- Periksa `src/main/ipc/` — semua handler harus return `ApiResponse<T>`
- Periksa `src/renderer/stores/` — semua store actions harus handle errors
- Periksa `src/main/orchestrator/` — agent runner error paths
- Periksa `src/main/llm/` — LLM client error scenarios
- Cek pattern `unwrap()` di renderer — pastikan user dapat feedback saat error

## Dependencies

- compile-and-type-audit (type errors harus fix dulu sebelum trace error paths)
