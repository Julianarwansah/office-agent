---
id: agent-analytics
title: Agent Performance Analytics
status: in_progress
created: 2026-06-23T00:00:00Z
---

# Intent: Agent Performance Analytics

## Goal

Menampilkan statistik dan metrik performa untuk setiap agent, membantu user memahami efektivitas dan usage pattern agent.

## Users

User yang ingin menganalisis performa agent mereka di Office AI Agent.

## Problem

Saat ini tidak ada visibilitas ke:
- Berapa banyak pesan yang dikirim oleh setiap agent
- Skill/tool apa yang paling sering digunakan
- Response time atau latency
- Success rate dari tool executions
- Agent mana yang paling aktif

## Success Criteria

- [ ] Analytics page/tab di Agents page
- [ ] Statistik per agent:
  - Total messages sent
  - Total tool executions
  - Success rate (% tool calls yang berhasil)
  - Most used skills
- [ ] Time range filter (7 days, 30 days, all time)
- [ ] Visual charts (bar chart, pie chart)
- [ ] Dark mode support
- [ ] Agent comparison (optional)

## Constraints

- Data dari existing database (messages, tool_executions)
- Backend aggregation untuk performance
- Frontend visualization dengan recharts atau chart.js
- Tidak perlu real-time, load on demand

## Notes

- Use existing repositories: messages, tool_executions
- Consider caching aggregated data
- Charts: recharts (lightweight, React-friendly)
