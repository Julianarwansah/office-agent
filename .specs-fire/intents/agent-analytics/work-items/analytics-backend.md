---
id: analytics-backend
title: Backend Analytics Aggregation
status: completed
complexity: medium
mode: confirm
intent: agent-analytics
run_id: run-office-agent-002
completed_at: 2026-06-25T02:47:59.038Z
---

## Description

Create backend IPC handlers untuk aggregasi data analytics.

## Acceptance Criteria

- [ ] New IPC channel: `analytics:agent` — Get stats for single agent
- [ ] New IPC channel: `analytics:overview` — Get overview stats untuk semua agents
- [ ] Repository methods untuk aggregasi:
  - `countMessagesByAgent(agentId, timeRange)`
  - `countToolExecutionsByAgent(agentId, timeRange)`
  - `getSuccessRateByAgent(agentId, timeRange)`
  - `getMostUsedSkills(agentId, limit)`
- [ ] Time range support: 7d, 30d, 90d, all
- [ ] Return aggregated data dalam format JSON

## Data Structure

```ts
interface AgentAnalytics {
  agentId: string;
  messageCount: number;
  toolExecutionCount: number;
  successRate: number; // 0-100
  mostUsedSkills: { skillName: string; count: number }[];
  averageResponseTime?: number; // optional
}

interface AnalyticsOverview {
  totalMessages: number;
  totalToolExecutions: number;
  agentStats: AgentAnalytics[];
}
```

## Technical Notes

- Add methods ke existing repositories (messages, toolExecutions)
- Use SQL COUNT, GROUP BY untuk aggregation
- Cache results jika perlu (optional)

## Estimated Effort

2-3 hours
