---
id: analytics-ui-page
title: Analytics Page UI
status: completed
complexity: medium
mode: confirm
intent: agent-analytics
run_id: run-office-agent-003
completed_at: 2026-06-25T06:28:08.201Z
---

## Description

Create Analytics page dengan charts dan statistik.

## Acceptance Criteria

- [ ] New route/page: `/analytics` atau tab di Agents page
- [ ] Agent selector (dropdown atau list)
- [ ] Time range filter: 7 days, 30 days, 90 days, All time
- [ ] Stat cards: Messages, Tool Calls, Success Rate
- [ ] Bar chart: Messages per day/week
- [ ] Pie chart: Skill usage distribution
- [ ] Table: Most used skills dengan counts
- [ ] Empty state saat tidak ada data
- [ ] Loading state

## Technical Notes

- Use recharts untuk charts (lightweight, React-friendly)
- Install: `npm install recharts`
- Layout: grid dengan cards dan charts
- Responsive design

## Estimated Effort

3-4 hours
