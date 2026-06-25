# Implementation Plan: analytics-ui-page

## Approach

1. Install `recharts` dependency
2. Add agent selector dropdown to Analytics page (filter single agent)
3. Replace custom bar div chart with recharts BarChart
4. Add PieChart for skill usage distribution
5. Add AgentDetailModal charts (use recharts BarChart + PieChart)
6. Ensure responsive layout

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `recharts` dep |
| `src/renderer/pages/Analytics.tsx` | Add agent selector, bar chart, pie chart |

## Acceptance Criteria Check

| # | Criteria | Status |
|---|----------|--------|
| 1 | Route `/analytics` exists | ✅ Already done |
| 2 | Agent selector | ⬜ Add dropdown |
| 3 | Time range filter | ✅ Already done |
| 4 | Stat cards | ✅ Already done |
| 5 | Bar chart (recharts) | ⬜ Replace custom bars |
| 6 | Pie chart | ⬜ Add PieChart |
| 7 | Skills table | ✅ Already done |
| 8 | Empty state | ✅ Already done |
| 9 | Loading state | ✅ Already done |

---
*Approve plan? [Y/n]*
