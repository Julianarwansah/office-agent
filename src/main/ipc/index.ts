/**
 * Aggregate entry point for all IPC handler registration.
 *
 * Pass the fully-initialized dependencies from `main/index.ts` after the
 * database, providers, registry, executor, memory manager, orchestrator
 * and window manager are constructed.
 */

import { BrowserWindow } from 'electron';
import { registerAgentHandlers, type AgentHandlerDeps } from './agents';
import { registerLLMHandlers, type LLMHandlerDeps } from './llm';
import { registerChatRoomHandlers, type ChatRoomHandlerDeps } from './chatrooms';
import { registerMessageHandlers, type MessageHandlerDeps } from './messages';
import { registerChatHandlers, type ChatHandlerDeps } from './chat';
import { registerMemoryHandlers, type MemoryHandlerDeps } from './memories';
import { registerSkillHandlers, type SkillHandlerDeps } from './skills';
import { registerSettingsHandlers, type SettingsHandlerDeps } from './settings';
import { registerWorkspaceHandlers, type WorkspaceHandlerDeps } from './workspace';
import { registerSystemHandlers, type SystemHandlerDeps } from './system';
import { registerTerminalHandlers, type TerminalHandlerDeps } from './terminal';
import { registerAppHandlers, type AppHandlerDeps } from './app';
import { registerKanbanHandlers, type KanbanHandlerDeps } from './kanban';
import { registerAnalyticsHandlers, type AnalyticsHandlerDeps } from './analytics';

import type { App as ElectronApp } from 'electron';
import type { ProviderManager } from '../llm';
import type { MemoryManager } from '../orchestrator/memory-manager';
import type { Orchestrator } from '../orchestrator/orchestrator';
import type { SkillRegistry } from '../skills';
import type { WindowManager } from '../window/window';
import type { LocalServer } from '../server/localhost';
import type { Repositories } from '../db/repositories';
import type {
  SkillExecutorLike,
  SkillAgentDelegate,
} from '../orchestrator/types';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc');

export interface RegisterAllIpcDeps {
  repos: Repositories;
  providerManager: ProviderManager;
  skillRegistry: SkillRegistry;
  skillExecutor: SkillExecutorLike;
  memoryManager: MemoryManager;
  orchestrator: Orchestrator;
  windowManager: WindowManager;
  localServer: LocalServer;
  getWindow: () => BrowserWindow | null;
  app: ElectronApp;
}

export function registerAllIpcHandlers(deps: RegisterAllIpcDeps): void {
  const {
    repos,
    providerManager,
    skillRegistry,
    skillExecutor,
    memoryManager,
    orchestrator,
    windowManager,
    localServer,
    getWindow,
    app,
  } = deps;

  log.info('registering IPC handlers');

  const agentDeps: AgentHandlerDeps = {
    agents: repos.agents,
    teams: repos.teams,
  };
  registerAgentHandlers(agentDeps);

  const llmDeps: LLMHandlerDeps = {
    providers: repos.llmProviders,
    providerManager,
  };
  registerLLMHandlers(llmDeps);

  const chatRoomDeps: ChatRoomHandlerDeps = {
    chatrooms: repos.chatrooms,
    agents: repos.agents,
  };
  registerChatRoomHandlers(chatRoomDeps);

  const messageDeps: MessageHandlerDeps = { messages: repos.messages };
  registerMessageHandlers(messageDeps);

  const chatDeps: ChatHandlerDeps = {
    orchestrator,
    messages: repos.messages,
    chatrooms: repos.chatrooms,
    agents: repos.agents,
    window: windowManager,
  };
  registerChatHandlers(chatDeps);

  const memoryDeps: MemoryHandlerDeps = {
    memories: repos.memories,
    memoryManager,
    agents: repos.agents,
  };
  registerMemoryHandlers(memoryDeps);

  const skillDeps: SkillHandlerDeps = {
    skillRegistry,
    agents: repos.agents,
    userSkills: repos.userSkills,
  };
  registerSkillHandlers(skillDeps);

  const settingsDeps: SettingsHandlerDeps = { settings: repos.settings };
  registerSettingsHandlers(settingsDeps);

  const workspaceDeps: WorkspaceHandlerDeps = { workspaces: repos.workspaces };
  registerWorkspaceHandlers(workspaceDeps);

  const systemDeps: SystemHandlerDeps = { localServer };
  registerSystemHandlers(systemDeps);

  const terminalDeps: TerminalHandlerDeps = {
    sendToRenderer: (channel, payload) => windowManager.sendToRenderer(channel, payload),
  };
  registerTerminalHandlers(terminalDeps);

  const appDeps: AppHandlerDeps = { app, getWindow };
  registerAppHandlers(appDeps);

  const kanbanDeps: KanbanHandlerDeps = { kanban: repos.kanban };
  registerKanbanHandlers(kanbanDeps);

  const analyticsDeps: AnalyticsHandlerDeps = {
    messages: repos.messages,
    toolExecutions: repos.toolExecutions,
  };
  registerAnalyticsHandlers(analyticsDeps);

  // Suppress unused-var warning for skillExecutor — the orchestrator
  // already has a reference, but we keep this in the deps bag so the
  // wiring is symmetric.
  void skillExecutor;

  log.info('all IPC handlers registered');
}

// Re-export the skill delegate type for callers.
export type { SkillAgentDelegate };
