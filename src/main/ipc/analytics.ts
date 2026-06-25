/**
 * IPC handlers for analytics data.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ApiResponse } from '../../shared/types';
import type { MessageRepository, ToolExecutionRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:analytics');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }

export interface AnalyticsHandlerDeps {
  messages: MessageRepository;
  toolExecutions: ToolExecutionRepository;
}

export interface AgentAnalytics {
  agentId: string;
  messageCount: number;
  toolExecutionCount: number;
  successRate: number;
  mostUsedSkills: Array<{ skillName: string; count: number }>;
  messageCountsByDay: Array<{ date: string; count: number }>;
}

export interface AnalyticsOverview {
  totalMessages: number;
  totalToolExecutions: number;
  agentStats: AgentAnalytics[];
}

function getSince(timeRange: string): number | undefined {
  const now = Date.now();
  switch (timeRange) {
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000;
    case '90d':
      return now - 90 * 24 * 60 * 60 * 1000;
    case 'all':
    default:
      return undefined;
  }
}

export function registerAnalyticsHandlers(deps: AnalyticsHandlerDeps): void {
  const { messages, toolExecutions } = deps;

  ipcMain.handle(IPC_CHANNELS.ANALYTICS.AGENT, async (
    _evt,
    args: { agentId: string; timeRange?: string },
  ): Promise<ApiResponse<AgentAnalytics>> => {
    try {
      if (!args?.agentId) return fail('agentId is required');
      const since = getSince(args.timeRange ?? '30d');

      const messageCount = messages.countByAgent(args.agentId, since);
      const toolCount = toolExecutions.countByAgent(args.agentId, since);
      const { rate } = toolExecutions.getSuccessRateByAgent(args.agentId, since);
      const mostUsedSkills = toolExecutions.getMostUsedSkills(args.agentId, 10, since);
      const days = args.timeRange === '7d' ? 7 : args.timeRange === '30d' ? 30 : args.timeRange === '90d' ? 90 : 30;
      const messageCountsByDay = messages.getMessageCountsByDay(args.agentId, days);

      const analytics: AgentAnalytics = {
        agentId: args.agentId,
        messageCount,
        toolExecutionCount: toolCount,
        successRate: rate,
        mostUsedSkills,
        messageCountsByDay,
      };

      return ok(analytics);
    } catch (err) {
      log.error('ANALYTICS.AGENT failed', err);
      return fail(err instanceof Error ? err.message : String(err));
    }
  });

  ipcMain.handle(IPC_CHANNELS.ANALYTICS.OVERVIEW, async (
    _evt,
    args: { agentIds: string[]; timeRange?: string },
  ): Promise<ApiResponse<AnalyticsOverview>> => {
    try {
      const since = getSince(args?.timeRange ?? '30d');
      const agentStats: AgentAnalytics[] = [];

      for (const agentId of args?.agentIds ?? []) {
        const messageCount = messages.countByAgent(agentId, since);
        const toolCount = toolExecutions.countByAgent(agentId, since);
        const { rate } = toolExecutions.getSuccessRateByAgent(agentId, since);
        const mostUsedSkills = toolExecutions.getMostUsedSkills(agentId, 5, since);
        const messageCountsByDay = messages.getMessageCountsByDay(agentId, args?.timeRange === '7d' ? 7 : 30);

        agentStats.push({
          agentId,
          messageCount,
          toolExecutionCount: toolCount,
          successRate: rate,
          mostUsedSkills,
          messageCountsByDay,
        });
      }

      const totalMessages = agentStats.reduce((sum, s) => sum + s.messageCount, 0);
      const totalToolExecutions = agentStats.reduce((sum, s) => sum + s.toolExecutionCount, 0);

      const overview: AnalyticsOverview = {
        totalMessages,
        totalToolExecutions,
        agentStats,
      };

      return ok(overview);
    } catch (err) {
      log.error('ANALYTICS.OVERVIEW failed', err);
      return fail(err instanceof Error ? err.message : String(err));
    }
  });
}
