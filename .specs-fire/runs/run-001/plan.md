# Run Plan: analytics-backend

## Work Item
- **ID:** analytics-backend
- **Title:** Backend Analytics Aggregation
- **Intent:** agent-analytics
- **Complexity:** medium
- **Mode:** confirm

## Implementation Plan

### Phase 1: Database Layer
**Files to modify:**
- `src/main/db/repositories/messages.ts`
- `src/main/db/repositories/tool-executions.ts`

**Changes:**
1. Add `countMessagesByAgent(agentId, timeRange)` - SQL COUNT with date filter
2. Add `countToolExecutionsByAgent(agentId, timeRange)` - SQL COUNT with date filter  
3. Add `getSuccessRateByAgent(agentId, timeRange)` - SQL success/total ratio calculation
4. Add `getMostUsedSkills(agentId, limit)` - SQL GROUP BY skill name, ORDER BY count DESC

Time range filter: 7d, 30d, 90d, all (convert to epoch milliseconds)

### Phase 2: IPC Layer
**Files to create/modify:**
- `src/main/ipc/analytics.ts` (new file)
- `src/main/ipc/index.ts` (register handlers)
- `src/shared/types.ts` (IPC channel names + types)
- `src/preload/api.ts` (expose to renderer)
- `src/preload/preload.ts` (bridge registration)

**New IPC Channels:**
1. `analytics:agent` - returns AgentAnalytics for single agent
2. `analytics:overview` - returns AnalyticsOverview for all agents

### Phase 3: Type Definitions
**File:** `src/shared/types.ts`

Add:
```ts
interface AgentAnalytics {
  agentId: string;
  messageCount: number;
  toolExecutionCount: number;
  successRate: number;
  mostUsedSkills: { skillName: string; count: number }[];
  averageResponseTime?: number;
}

interface AnalyticsOverview {
  totalMessages: number;
  totalToolExecutions: number;
  agentStats: AgentAnalytics[];
}
```

## Acceptance Criteria Verification
- [ ] IPC channel `analytics:agent` implemented
- [ ] IPC channel `analytics:overview` implemented
- [ ] Repository methods for aggregation working
- [ ] Time range support (7d, 30d, 90d, all)
- [ ] Proper TypeScript types

## Estimated Effort
2-3 hours

---
**Checkpoint:** User confirmation required before execution (confirm mode).
